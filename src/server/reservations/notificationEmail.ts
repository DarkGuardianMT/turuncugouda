import { getSecret } from 'astro:env/server';
import nodemailer from 'nodemailer';
import type { ReservationData } from './types';

function requiredSecret(name: string): string {
  const value = getSecret(name);
  if (!value?.trim()) throw new Error('SMTP_CONFIGURATION_INVALID');
  return value;
}

export async function sendReservationNotification(input: ReservationData): Promise<void> {
  // Lees en controleer configuratie pas na opslag, nooit tijdens het renderen van pagina's.
  const host = requiredSecret('SMTP_HOST').trim();
  const portValue = requiredSecret('SMTP_PORT').trim();
  const user = requiredSecret('SMTP_USER').trim();
  const password = requiredSecret('SMTP_PASSWORD');
  const from = requiredSecret('SMTP_FROM').trim();
  const to = requiredSecret('RESERVATION_NOTIFICATION_TO').trim();
  const port = Number(portValue);
  const mailbox = /^[^\s@<>,;]+@[^\s@<>,;.]+(?:\.[^\s@<>,;.]+)+$/;
  if (!/^[\w.-]+$/.test(host) || !/^\d+$/.test(portValue)
    || !Number.isInteger(port) || port < 1 || port > 65535
    || !mailbox.test(from) || !mailbox.test(to)) {
    throw new Error('SMTP_CONFIGURATION_INVALID');
  }

  const transport = nodemailer.createTransport({
    host, port, secure: true,
    auth: { user, pass: password },
    connectionTimeout: 5_000, greetingTimeout: 5_000, dnsTimeout: 5_000, socketTimeout: 10_000,
    logger: false, debug: false,
    disableFileAccess: true, disableUrlAccess: true,
  });
  const text = [
    'Er is een nieuwe reserveringsaanvraag ontvangen.',
    '',
    `Naam: ${input.name}`,
    `Datum: ${input.reservationDate.split('-').reverse().join('-')}`,
    `Tijd: ${input.reservationTime}`,
    `Aantal personen: ${input.guestCount}`,
    `Telefoon: ${input.phone}`,
    ...(input.email ? [`E-mailadres: ${input.email}`] : []),
    'Status: In afwachting',
    ...(input.message ? ['', 'Bericht:', input.message] : []),
    '',
    'Deze aanvraag is nog niet bevestigd. Neem contact op met de gast om de aanvraag af te handelen.',
  ].join('\n');

  await transport.sendMail({ from, to, subject: 'Nieuwe reserveringsaanvraag', text });
}
