import assert from 'node:assert/strict';
import { after, beforeEach, test, type TestContext } from 'node:test';
import { createServer } from 'vite';
import type { SendMailOptions } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { todayInAmsterdam } from '../src/lib/reservationDate.ts';

// Test de echte route, INSERT-service en mailservice zonder database, secrets of SMTP-verkeer.
const poolId = '\0reservation-notification-test-pool';
const envId = '\0reservation-notification-test-env';
const mailerId = '\0reservation-notification-test-mailer';
const limiterId = '\0reservation-notification-test-limiter';
const server = await createServer({
  configFile: false, envDir: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  ssr: { noExternal: ['nodemailer'] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  plugins: [{
    name: 'reservation-notification-test-dependencies', enforce: 'pre',
    resolveId(source) {
      if (source === '../db/pool') return poolId;
      if (source === 'astro:env/server') return envId;
      if (source === 'nodemailer') return mailerId;
      if (source === '../../server/rateLimit/service') return limiterId;
    },
    load(id) {
      if (id === limiterId) return `export async function consumeRateLimit() { return { allowed: true }; }`;
      if (id === poolId) return `
        export const pool = { async execute() { throw new Error('Database stub not configured'); } };
        export function getDatabasePool() { return pool; }
      `;
      if (id === envId) return `
        export const environment = {};
        export function getSecret(name) { return environment[name]; }
      `;
      if (id === mailerId) return `
        export default { createTransport() { throw new Error('SMTP stub not configured'); } };
      `;
    },
  }],
});
after(() => server.close());
const { pool } = await server.ssrLoadModule(poolId) as {
  pool: { execute(sql: string, parameters: unknown[]): Promise<[{ insertId: number }, unknown]> };
};
const { environment } = await server.ssrLoadModule(envId) as { environment: Record<string, string | undefined> };
const { default: mailer } = await server.ssrLoadModule(mailerId) as {
  default: { createTransport(options: SMTPTransport.Options): { sendMail(message: SendMailOptions): Promise<unknown> } };
};
// Laden zonder configuratie moet veilig zijn; validatie gebeurt uitsluitend bij verzenden.
const { POST } = await server.ssrLoadModule('/src/pages/api/reservations.ts') as
  typeof import('../src/pages/api/reservations.ts');

const smtp = {
  SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_USER: 'sender@example.com',
  SMTP_PASSWORD: 'synthetic-password', SMTP_FROM: 'sender@example.com',
  RESERVATION_NOTIFICATION_TO: 'owner@example.com',
};
beforeEach(() => {
  for (const key of Object.keys(environment)) delete environment[key];
  Object.assign(environment, smtp);
});

// Gebruik een toekomstige dinsdag, onafhankelijk van de datum waarop de tests draaien.
const date = new Date(`${todayInAmsterdam()}T12:00:00Z`);
date.setUTCDate(date.getUTCDate() + ((2 - date.getUTCDay() + 7) % 7) + 7);
const valid = {
  name: ' Example Guest ', phone: '+31612345678', email: ' GUEST@EXAMPLE.COM ',
  reservationDate: date.toISOString().slice(0, 10), reservationTime: '13:31', guestCount: 4,
  message: ' Een kinderstoel graag.\nDank u! ',
};
const expectedSuccess = { success: true, reservationId: 42, status: 'pending' };

function post(payload: unknown = valid): Promise<Response> {
  const request = new Request('http://localhost:4321/api/reservations', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4321' },
    body: JSON.stringify(payload),
  });
  return Promise.resolve(POST({ request } as Parameters<typeof POST>[0]));
}

function dependencies(context: TestContext) {
  const events: string[] = [];
  const execute = context.mock.method(pool, 'execute', async () => {
    events.push('insert');
    return [{ insertId: 42 }, []] as [{ insertId: number }, unknown];
  });
  const transport = { async sendMail(_message: SendMailOptions): Promise<unknown> { return {}; } };
  const sendMail = context.mock.method(transport, 'sendMail', async () => {
    events.push('send');
    return { accepted: [smtp.RESERVATION_NOTIFICATION_TO] };
  });
  const createTransport = context.mock.method(mailer, 'createTransport', () => transport);
  const log = context.mock.method(console, 'error', () => {});
  return { events, execute, sendMail, createTransport, log };
}

async function assertSuccess(response: Response) {
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), expectedSuccess);
}

test('successful INSERT is followed by exactly one Dutch notification with normalized fields', async (context) => {
  const mocks = dependencies(context);
  await assertSuccess(await post());
  assert.deepEqual(mocks.events, ['insert', 'send']);
  assert.equal(mocks.execute.mock.callCount(), 1);
  const [sql, parameters] = mocks.execute.mock.calls[0].arguments;
  assert.ok(typeof sql === 'string');
  assert.match(sql, /INSERT INTO reservations/);
  assert.match(sql, /VALUES \(\?, \?, \?, \?, \?, \?, \?, 'pending'\)/);
  assert.deepEqual(parameters, ['Example Guest', 'guest@example.com', valid.phone,
    valid.reservationDate, '13:31', 4, 'Een kinderstoel graag.\nDank u!']);
  assert.equal(mocks.createTransport.mock.callCount(), 1);
  assert.equal(mocks.sendMail.mock.callCount(), 1);
  assert.deepEqual(mocks.sendMail.mock.calls[0].arguments[0], {
    from: smtp.SMTP_FROM, to: smtp.RESERVATION_NOTIFICATION_TO, subject: 'Nieuwe reserveringsaanvraag',
    text: [
      'Er is een nieuwe reserveringsaanvraag ontvangen.', '', 'Naam: Example Guest',
      `Datum: ${valid.reservationDate.split('-').reverse().join('-')}`, 'Tijd: 13:31',
      'Aantal personen: 4', `Telefoon: ${valid.phone}`, 'E-mailadres: guest@example.com',
      'Status: In afwachting', '', 'Bericht:', 'Een kinderstoel graag.\nDank u!', '',
      'Deze aanvraag is nog niet bevestigd. Neem contact op met de gast om de aanvraag af te handelen.',
    ].join('\n'),
  });
  assert.deepEqual(mocks.createTransport.mock.calls[0].arguments[0], {
    host: smtp.SMTP_HOST, port: 465, secure: true,
    auth: { user: smtp.SMTP_USER, pass: smtp.SMTP_PASSWORD },
    connectionTimeout: 5_000, greetingTimeout: 5_000, dnsTimeout: 5_000, socketTimeout: 10_000,
    logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
  });
  assert.equal(mocks.log.mock.callCount(), 0);
});

test('SMTP success leaves the public API success contract unchanged and hides provider details', async (context) => {
  const mocks = dependencies(context);
  mocks.sendMail.mock.mockImplementation(async () => ({
    messageId: 'private-provider-id', response: 'private-provider-response', accepted: [smtp.RESERVATION_NOTIFICATION_TO],
  }));
  await assertSuccess(await post());
  assert.equal(mocks.log.mock.callCount(), 0);
});

test('SMTP failure preserves the inserted reservation and success response with only a fixed safe log', async (context) => {
  const mocks = dependencies(context);
  mocks.sendMail.mock.mockImplementation(async () => {
    throw Object.assign(new Error(`${smtp.SMTP_PASSWORD} ${valid.phone} ${valid.email}`), {
      code: 'PROVIDER_PRIVATE_DATA', response: valid.message,
    });
  });
  await assertSuccess(await post());
  assert.equal(mocks.execute.mock.callCount(), 1);
  assert.equal(mocks.sendMail.mock.callCount(), 1);
  assert.deepEqual(mocks.log.mock.calls.map((call) => call.arguments), [
    ['Reservation notification failed:', 'SMTP_NOTIFICATION_FAILED'],
  ]);
});

for (const [label, optional] of [
  ['absent', {}], ['null', { email: null, message: null }], ['blank', { email: ' ', message: ' ' }],
  ['email only', { email: ' GUEST@EXAMPLE.COM ' }], ['message only', { message: ' Een vraag\nmet twee regels ' }],
] as const) {
  test(`notification supports ${label} optional fields`, async (context) => {
    const mocks = dependencies(context);
    const { email: _email, message: _message, ...required } = valid;
    await assertSuccess(await post({ ...required, ...optional }));
    const mail = mocks.sendMail.mock.calls[0].arguments[0];
    assert.ok(mail);
    const text = mail.text;
    assert.equal(typeof text, 'string');
    assert.ok(typeof text === 'string');
    const email = 'email' in optional ? optional.email?.trim().toLowerCase() : '';
    const message = 'message' in optional ? optional.message?.trim() : '';
    assert.equal(text.includes('E-mailadres:'), Boolean(email));
    assert.equal(text.includes('Bericht:'), Boolean(message));
    if (email) assert.ok(text.includes(`E-mailadres: ${email}`));
    if (message) assert.ok(text.includes(`Bericht:\n${message}`));
    assert.ok(!/null|undefined/.test(text));
  });
}

for (const key of Object.keys(smtp)) {
  test(`missing ${key} is handled after INSERT without SMTP traffic or sensitive logs`, async (context) => {
    const mocks = dependencies(context);
    delete environment[key];
    await assertSuccess(await post());
    assert.equal(mocks.execute.mock.callCount(), 1);
    assert.equal(mocks.createTransport.mock.callCount(), 0);
    assert.deepEqual(mocks.log.mock.calls.map((call) => call.arguments), [
      ['Reservation notification failed:', 'SMTP_NOTIFICATION_FAILED'],
    ]);
  });
}

test('invalid SMTP configuration fails safely and is re-read on the next use', async (context) => {
  const mocks = dependencies(context);
  for (const [key, value] of [
    ['SMTP_PASSWORD', ' '], ['SMTP_HOST', 'smtp://example.com'],
    ['SMTP_PORT', '0'], ['SMTP_PORT', '65536'], ['SMTP_PORT', '465x'], ['SMTP_PORT', '4.65e2'],
    ['SMTP_FROM', 'sender@example.com\r\nBcc: other@example.com'],
    ['RESERVATION_NOTIFICATION_TO', 'owner@example.com,other@example.com'],
  ]) {
    Object.assign(environment, smtp, { [key]: value });
    await assertSuccess(await post());
  }
  assert.equal(mocks.createTransport.mock.callCount(), 0);
  Object.assign(environment, smtp);
  await assertSuccess(await post());
  assert.equal(mocks.createTransport.mock.callCount(), 1);
});

test('synchronous mail setup errors cannot turn an inserted reservation into an API error', async (context) => {
  const mocks = dependencies(context);
  mocks.createTransport.mock.mockImplementation(() => { throw new Error(smtp.SMTP_PASSWORD); });
  await assertSuccess(await post());
  assert.equal(mocks.execute.mock.callCount(), 1);
  assert.deepEqual(mocks.log.mock.calls.map((call) => call.arguments), [
    ['Reservation notification failed:', 'SMTP_NOTIFICATION_FAILED'],
  ]);
});

test('mail configuration and SMTP are never used before an INSERT has completed', async (context) => {
  const mocks = dependencies(context);
  let completeInsert: ((result: [{ insertId: number }, unknown]) => void) | undefined;
  mocks.execute.mock.mockImplementation(() => new Promise<[{ insertId: number }, unknown]>((resolve) => {
    completeInsert = resolve;
  }));
  const response = post();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(completeInsert);
  assert.equal(mocks.createTransport.mock.callCount(), 0);
  completeInsert([{ insertId: 42 }, []]);
  await assertSuccess(await response);
  assert.equal(mocks.sendMail.mock.callCount(), 1);
});

test('failed INSERT never attempts notification and retains the existing generic database error', async (context) => {
  const mocks = dependencies(context);
  mocks.execute.mock.mockImplementation(async () => { throw new Error('Synthetic database failure'); });
  const response = await post();
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { success: false, error: {
    code: 'INTERNAL_ERROR', message: 'Reserveren is tijdelijk niet mogelijk. Probeer het later opnieuw.',
  } });
  assert.equal(mocks.createTransport.mock.callCount(), 0);
});

test('invalid reservation never inserts or attempts a notification', async (context) => {
  const mocks = dependencies(context);
  const response = await post({ ...valid, name: '' });
  assert.equal(response.status, 400);
  assert.equal(mocks.execute.mock.callCount(), 0);
  assert.equal(mocks.createTransport.mock.callCount(), 0);
});
