import type { ReservationData, ReservationFieldErrors, ReservationValidationResult } from './types.ts';

const fields = new Set(['name', 'phone', 'email', 'reservationDate', 'reservationTime', 'guestCount', 'message']);
const amsterdamDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
});

function todayInAmsterdam(now: Date): string {
  const parts = amsterdamDate.formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function validateReservation(input: unknown, now = new Date()): ReservationValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, fields: { _form: 'Verstuur een JSON-object met reserveringsgegevens.' } };
  }

  const values = input as Record<string, unknown>;
  const errors: ReservationFieldErrors = {};
  if (Object.keys(values).some((key) => !fields.has(key))) {
    errors._form = 'Het verzoek bevat niet-toegestane velden.';
  }

  function text(field: keyof ReservationData, maximum: number, required = false): string {
    const value = values[field];
    if (value === undefined || value === null) {
      if (required) errors[field] = 'Dit veld is verplicht.';
      return '';
    }
    if (typeof value !== 'string') {
      errors[field] = 'Vul een tekstwaarde in.';
      return '';
    }
    const normalized = value.trim();
    if (required && !normalized) errors[field] = 'Dit veld is verplicht.';
    else if (normalized.length > maximum) errors[field] = `Gebruik maximaal ${maximum} tekens.`;
    else if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
      errors[field] = 'De tekst bevat ongeldige tekens.';
    }
    return normalized;
  }

  const name = text('name', 120, true);
  const phone = text('phone', 32, true);
  const email = text('email', 254).toLowerCase();
  const message = text('message', 1000);
  const reservationDate = text('reservationDate', 10, true);
  const reservationTime = text('reservationTime', 5, true);
  const guestCount = values.guestCount;

  if (!errors.phone && (!/^[+\d\s()./\-]+$/.test(phone) || (phone.match(/\d/g)?.length ?? 0) < 6)) {
    errors.phone = 'Vul een geldig telefoonnummer in.';
  }
  if (email && !errors.email && !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)) {
    errors.email = 'Vul een geldig e-mailadres in.';
  }
  if (typeof guestCount !== 'number' || !Number.isInteger(guestCount) || guestCount < 1) {
    errors.guestCount = 'Vul een geheel aantal personen van minimaal 1 in.';
  } else if (guestCount > 65535) {
    // Dit is de technische SMALLINT-grens, geen restaurantcapaciteit.
    errors.guestCount = 'Het aantal personen overschrijdt de technische limiet van 65535.';
  }

  if (!errors.reservationDate) {
    const date = new Date(`${reservationDate}T12:00:00Z`);
    if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(reservationDate)
      || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== reservationDate) {
      errors.reservationDate = 'Vul een geldige datum in (JJJJ-MM-DD).';
    } else if (reservationDate < todayInAmsterdam(now)) {
      errors.reservationDate = 'Kies vandaag of een toekomstige datum.';
    } else if (date.getUTCDay() === 1) {
      errors.reservationDate = 'Turuncu is op maandag gesloten.';
    } else if (date.getUTCDay() === 0) {
      errors.reservationDate = 'Turuncu is op zondag gesloten.';
    }
  }

  if (!errors.reservationTime) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reservationTime)) {
      errors.reservationTime = 'Vul een geldige tijd in (UU:MM).';
    } else if (reservationTime < '10:00' || reservationTime >= '16:30') {
      errors.reservationTime = 'Kies een tijd vanaf 10:00 en vóór 16:30.';
    }
  }

  if (Object.keys(errors).length) return { success: false, fields: errors };
  return {
    success: true,
    data: { name, phone, email: email || null, message: message || null,
      reservationDate, reservationTime, guestCount: guestCount as number },
  };
}
