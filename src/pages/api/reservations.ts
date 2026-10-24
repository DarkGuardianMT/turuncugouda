import type { APIRoute } from 'astro';
import { createReservation } from '../../server/reservations/reservationService';
import { sendReservationNotification } from '../../server/reservations/notificationEmail';
import { validateReservation } from '../../server/reservations/validation';
import { DatabaseConfigurationError } from '../../server/db/config.mjs';
import { isAllowedReservationOrigin, preparePublicReservationInput } from '../../server/reservations/requestGuards';
import { consumeRateLimit } from '../../server/rateLimit/service';

export const prerender = false;
const maximumBodyBytes = 16 * 1024;

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

function error(status: number, code: string, message: string): Response {
  return json({ success: false, error: { code, message } }, status);
}

export const POST: APIRoute = async (context) => {
  const { request } = context;
  if (!isAllowedReservationOrigin(request)) {
    return error(403, 'INVALID_ORIGIN', 'De aanvraag kon niet worden verwerkt. Gebruik het formulier op onze website.');
  }
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    return error(415, 'UNSUPPORTED_MEDIA_TYPE', 'Verstuur de gegevens als application/json.');
  }

  // Na goedkope protocolcontroles, vóór lezen/parsen: ook ongeldige JSON, honeypot en validatiefouten tellen mee.
  try {
    const limit = await consumeRateLimit({ scope: 'reservation', subject: context.clientAddress });
    if (!limit.allowed) return json({ success: false, error: {
      code: 'RATE_LIMITED', message: 'Te veel aanvragen. Probeer het later opnieuw.',
    } }, 429, { 'Retry-After': String(limit.retryAfterSeconds) });
  } catch {
    console.error('Reservation rate limit failed:', 'RATE_LIMIT_UNAVAILABLE');
    return error(503, 'SERVICE_UNAVAILABLE', 'Reserveren is tijdelijk niet mogelijk. Probeer het later opnieuw.');
  }

  let input: unknown;
  const reader = request.body?.getReader();
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maximumBodyBytes) {
          await reader.cancel();
          return error(413, 'PAYLOAD_TOO_LARGE', 'Het verzoek is te groot.');
        }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return error(400, 'INVALID_JSON', 'Verstuur geldige JSON.');
  } finally {
    reader?.releaseLock();
  }

  const prepared = preparePublicReservationInput(input);
  if (prepared.blocked) {
    return error(400, 'INVALID_REQUEST', 'De aanvraag kon niet worden verwerkt. Neem telefonisch contact met ons op.');
  }
  const validated = validateReservation(prepared.input);
  if (!validated.success) {
    return json({ success: false, error: {
      code: 'VALIDATION_ERROR', message: 'Controleer de ingevoerde gegevens.', fields: validated.fields,
    } }, 400);
  }

  let reservation: Awaited<ReturnType<typeof createReservation>>;
  try {
    reservation = await createReservation(validated.data);
  } catch (cause) {
    // Driverberichten kunnen SQL en persoonsgegevens bevatten; log alleen een foutcode.
    const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
    console.error('Reservation creation failed:', cause instanceof DatabaseConfigurationError
      ? cause.message : /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'INTERNAL_ERROR');
    return error(500, 'INTERNAL_ERROR', 'Reserveren is tijdelijk niet mogelijk. Probeer het later opnieuw.');
  }

  try {
    await sendReservationNotification(validated.data);
  } catch {
    // De aanvraag is al opgeslagen; log nooit providerberichten of persoonsgegevens.
    console.error('Reservation notification failed:', 'SMTP_NOTIFICATION_FAILED');
  }
  return json({ success: true, reservationId: reservation.id, status: reservation.status }, 201);
};

export const ALL: APIRoute = () => json({ success: false, error: {
  code: 'METHOD_NOT_ALLOWED', message: 'Gebruik POST om een reserveringsaanvraag te versturen.',
} }, 405, { Allow: 'POST' });
