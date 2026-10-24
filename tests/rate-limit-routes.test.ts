import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { createServer } from 'vite';
import type { Pool } from 'mysql2/promise';
import { createRateLimitTestDatabase } from './helpers/rateLimitDatabase.ts';
import { hashPassword } from '../src/server/admin/password.mjs';
import { readAdminConfig, sessionCookie, verifySession } from '../src/server/admin/auth.ts';
import { todayInAmsterdam } from '../src/lib/reservationDate.ts';

const poolId = '\0rate-limit-route-pool';
const envId = '\0rate-limit-route-env';
const mailId = '\0rate-limit-route-mail';
const server = await createServer({
  configFile: false, envDir: false, optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  plugins: [{
    name: 'rate-limit-route-dependencies', enforce: 'pre',
    resolveId(source) {
      if (source === '../db/pool') return poolId;
      if (source === 'astro:env/server') return envId;
      if (source === '../../server/reservations/notificationEmail') return mailId;
    },
    load(id) {
      if (id === poolId) return 'export const database = {}; export function getDatabasePool() { return database.pool; }';
      if (id === envId) return 'export const environment = {}; export function getSecret(name) { return environment[name]; }';
      if (id === mailId) return 'export const mail = { count: 0 }; export async function sendReservationNotification() { mail.count++; }';
    },
  }],
});
after(() => server.close());
const { database } = await server.ssrLoadModule(poolId) as { database: { pool: Pool } };
const { environment } = await server.ssrLoadModule(envId) as { environment: Record<string, string | undefined> };
const { mail } = await server.ssrLoadModule(mailId) as { mail: { count: number } };
const reservation = await server.ssrLoadModule('/src/pages/api/reservations.ts') as typeof import('../src/pages/api/reservations.ts');
const login = await server.ssrLoadModule('/src/pages/admin/auth/login.ts') as typeof import('../src/pages/admin/auth/login.ts');
const config = readAdminConfig({ ADMIN_USERNAME: 'rate-limit-test', ADMIN_PASSWORD_HASH: await hashPassword('synthetic-test-password'),
  ADMIN_SESSION_SECRET: randomBytes(32).toString('base64url') });
let fixture = createRateLimitTestDatabase();
let inserts = 0;
const cookies: { name: string; value: string; options: unknown }[] = [];
beforeEach(() => {
  fixture = createRateLimitTestDatabase(); inserts = 0; mail.count = 0; cookies.length = 0;
  environment.RATE_LIMIT_SECRET = randomBytes(32).toString('base64url');
  database.pool = {
    getConnection: () => fixture.pool.getConnection(),
    async execute(sql: string, parameters: string[] = []) {
      if (sql.includes('INSERT INTO reservations')) { inserts++; return [{ insertId: 42 }, []]; }
      return fixture.pool.execute(sql, parameters);
    },
  } as unknown as Pool;
});
const date = new Date(`${todayInAmsterdam()}T12:00:00Z`);
date.setUTCDate(date.getUTCDate() + ((2 - date.getUTCDay() + 7) % 7) + 7);
const payload = { name: 'Test Guest', phone: '+31600000000', reservationDate: date.toISOString().slice(0, 10), reservationTime: '13:31', guestCount: 2 };
function reserve(body = JSON.stringify(payload), address = '192.0.2.1', headers: Record<string, string> = {}) {
  const request = new Request('http://localhost:4321/api/reservations', { method: 'POST', body,
    headers: { origin: 'http://localhost:4321', 'content-type': 'application/json', ...headers } });
  return reservation.POST({ request, clientAddress: address } as Parameters<typeof reservation.POST>[0]);
}
function authenticate(password = 'incorrect', address = '192.0.2.1', headers: Record<string, string> = {}) {
  const request = new Request('http://localhost:4321/admin/auth/login', { method: 'POST',
    body: new URLSearchParams({ username: config.username, password }), headers: { origin: 'http://localhost:4321', ...headers } });
  return login.POST({ request, clientAddress: address, locals: { adminConfig: config }, cookies: {
    set(name: string, value: string, options: unknown) { cookies.push({ name, value, options }); },
  } } as Parameters<typeof login.POST>[0]);
}

test('five valid reservations retain the exact 201 contract and mail flow; sixth returns Dutch RATE_LIMITED with Retry-After', async () => {
  for (let i = 0; i < 5; i++) {
    const response = await reserve();
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { success: true, reservationId: 42, status: 'pending' });
  }
  const response = await reserve();
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('retry-after')!, /^[1-9]\d*$/);
  assert.equal(Number(response.headers.get('retry-after')), 900);
  assert.deepEqual(await response.json(), { success: false, error: { code: 'RATE_LIMITED', message: 'Te veel aanvragen. Probeer het later opnieuw.' } });
  assert.equal(inserts, 5); assert.equal(mail.count, 5);
});

for (const [label, body, code, status] of [
  ['malformed JSON', '{', 'INVALID_JSON', 400],
  ['oversized body', JSON.stringify({ message: 'x'.repeat(17000) }), 'PAYLOAD_TOO_LARGE', 413],
  ['honeypot', JSON.stringify({ ...payload, contact_url: 'spam' }), 'INVALID_REQUEST', 400],
  ['validation', '{}', 'VALIDATION_ERROR', 400],
] as const) {
  test(`repeated ${label} consumes quota before parsing or validation without inserting or sending mail`, async () => {
    for (let i = 0; i < 5; i++) {
      const response = await reserve(body); assert.equal(response.status, status);
      assert.equal((await response.json()).error.code, code);
    }
    assert.equal((await reserve(body)).status, 429);
    assert.equal(inserts, 0); assert.equal(mail.count, 0);
  });
}

test('cheap Origin and content-type checks precede storage and remain unchanged', async () => {
  assert.equal((await reserve('{}', '192.0.2.1', { origin: 'https://evil.example' })).status, 403);
  assert.equal((await reserve('{}', '192.0.2.1', { 'content-type': 'text/plain' })).status, 415);
  assert.equal(fixture.state.statements.length, 0);
  assert.equal((await reserve()).status, 201);
});

test('address/scope isolation and runtime clientAddress cannot be overridden with spoofed IP headers', async () => {
  for (let i = 0; i < 5; i++) await reserve('{}');
  assert.equal((await reserve('{}', '::ffff:192.0.2.1', { 'x-forwarded-for': '192.0.2.99', forwarded: 'for=192.0.2.99' })).status, 429);
  assert.equal((await reserve('{}', '2001:db8::1')).status, 400);
  assert.equal((await authenticate()).headers.get('location'), '/admin/login?notice=invalid');
});

for (const failure of ['secret', 'database', 'address', 'getter']) {
  test(`reservation ${failure} failure returns a safe 503, logs a fixed code and never inserts`, async (context) => {
    const log = context.mock.method(console, 'error', () => {});
    if (failure === 'secret') environment.RATE_LIMIT_SECRET = undefined;
    if (failure === 'database') fixture.state.fail = 'INSERT INTO';
    let response: Response;
    if (failure === 'getter') response = await reservation.POST({ request: new Request('http://localhost:4321/api/reservations', {
      method: 'POST', body: '{}', headers: { 'content-type': 'application/json' },
    }), get clientAddress(): string { throw new Error('private-runtime-detail'); } } as Parameters<typeof reservation.POST>[0]);
    else response = await reserve(undefined, failure === 'address' ? 'unavailable' : '192.0.2.1', { 'x-forwarded-for': '192.0.2.99' });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Reserveren is tijdelijk niet mogelijk. Probeer het later opnieuw.' } });
    assert.deepEqual(log.mock.calls.map((call) => call.arguments), [['Reservation rate limit failed:', 'RATE_LIMIT_UNAVAILABLE']]);
    assert.equal(inserts, 0); assert.equal(mail.count, 0);
  });
}

test('admin fifth failed login is allowed, sixth redirects to limited with no cookie', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await authenticate()).headers.get('location'), '/admin/login?notice=invalid');
  const blocked = await authenticate('synthetic-test-password');
  assert.equal(blocked.status, 303); assert.equal(blocked.headers.get('location'), '/admin/login?notice=limited');
  assert.equal(cookies.length, 0);
});

test('successful admin login resets only its login subject and issues the unchanged verifiable session cookie', async () => {
  await reserve('{}');
  for (let i = 0; i < 4; i++) await authenticate();
  const response = await authenticate('synthetic-test-password');
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/admin/reservations');
  assert.equal(cookies.length, 1); assert.equal(cookies[0]!.name, sessionCookie);
  assert.ok(verifySession(cookies[0]!.value, config));
  assert.equal(fixture.state.rows.size, 1);
  for (let i = 0; i < 5; i++) assert.equal((await authenticate()).headers.get('location'), '/admin/login?notice=invalid');
  assert.equal((await authenticate()).headers.get('location'), '/admin/login?notice=limited');
});

for (const failure of ['secret', 'database', 'reset', 'address']) {
  test(`admin ${failure} failure cannot bypass limiting or issue a session`, async (context) => {
    const log = context.mock.method(console, 'error', () => {});
    if (failure === 'secret') environment.RATE_LIMIT_SECRET = undefined;
    if (failure === 'database') fixture.state.fail = 'CONNECT';
    if (failure === 'reset') fixture.state.fail = 'DELETE FROM rate_limits WHERE scope';
    const response = await authenticate('synthetic-test-password', failure === 'address' ? 'unknown' : '192.0.2.1');
    assert.equal(response.status, 503); assert.equal(cookies.length, 0);
    assert.ok(!(await response.text()).includes('RATE_LIMIT'));
    assert.deepEqual(log.mock.calls.map((call) => call.arguments), [[failure === 'reset' ? 'Admin login rate limit reset failed:' : 'Admin login rate limit failed:', 'RATE_LIMIT_UNAVAILABLE']]);
  });
}

test('admin Origin/body form guards remain before the limiter', async () => {
  assert.equal((await authenticate('synthetic-test-password', '192.0.2.1', { origin: 'https://evil.example' })).status, 403);
  assert.equal(fixture.state.statements.length, 0); assert.equal(cookies.length, 0);
});
