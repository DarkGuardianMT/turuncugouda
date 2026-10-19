import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, createHmac } from 'node:crypto';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { loadEnv } from 'vite';
import { hashPassword, verifyPassword } from '../src/server/admin/password.mjs';
import { authenticate, cookieOptions, createSession, csrfToken, readAdminConfig, sessionLifetime, verifyCsrf, verifySession } from '../src/server/admin/auth.ts';
import { createLoginLimiter } from '../src/server/admin/loginLimiter.ts';
import { applyAdminSecurityHeaders, readAdminForm } from '../src/server/admin/http.ts';
import { statusFilter, validReservationId, validTransition } from '../src/server/reservations/adminLogic.ts';

const password = randomBytes(24).toString('base64url');
const hash = await hashPassword(password);
const environment = { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: hash, ADMIN_SESSION_SECRET: randomBytes(32).toString('base64url') };
const config = readAdminConfig(environment);
const now = Date.parse('2026-10-19T12:00:00Z');

test('admin security headers preserve native same-origin form POSTs and private response protections', () => {
  for (const status of [200, 303, 403, 503]) {
    const response = applyAdminSecurityHeaders(new Response(null, { status }));
    assert.equal(response.status, status);
    assert.equal(response.headers.get('referrer-policy'), 'same-origin');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('content-security-policy'), "frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
  }
});

test('generated hashes survive both Node and Astro/Vite .env parsing unchanged', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'turuncu-admin-env-'));
  const path = join(directory, '.env');
  const key = `TURUNCU_TEST_HASH_${randomBytes(8).toString('hex')}`;
  try {
    const content = `${key}=${hash}\n`;
    await writeFile(path, content);
    assert.equal(parseEnv(content)[key], hash);
    assert.equal(loadEnv('development', directory, key)[key], hash);
  } finally { await unlink(path); await rmdir(directory); }
});

test('scrypt uses random salts and verifies valid/invalid passwords without normalization', async () => {
  assert.notEqual(await hashPassword(password), hash);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(`${password} `, hash), false);
  assert.equal(await authenticate(' admin ', password, config), true);
  assert.equal(await authenticate('Admin', password, config), false);
  assert.equal(await authenticate('admin', 'incorrect', config), false);
});

test('malformed, unbounded-cost and truncated hashes fail safely', async () => {
  for (const value of ['', 'scrypt$salt$hash', hash.replace('32768', '99999999'), hash.slice(0, -1), hash.toUpperCase()]) {
    assert.equal(await verifyPassword(password, value), false);
  }
  assert.equal(await verifyPassword('x'.repeat(1025), hash), false);
  await assert.rejects(hashPassword('short'));
});

test('configuration is explicit, validated and never defaults to credentials', () => {
  for (const key of Object.keys(environment)) {
    assert.throws(() => readAdminConfig({ ...environment, [key]: undefined }), new RegExp(key));
  }
  assert.throws(() => readAdminConfig({ ...environment, ADMIN_PASSWORD_HASH: 'placeholder' }));
  assert.throws(() => readAdminConfig({ ...environment, ADMIN_SESSION_SECRET: 'short' }));
});

test('signed sessions validate identity, signature, expiry and fixed lifetime', () => {
  const cookie = createSession(config, now);
  const session = verifySession(cookie, config, now)!;
  assert.equal(session.sub, config.username);
  assert.equal(session.exp - session.iat, sessionLifetime);
  assert.equal(verifySession(undefined, config, now), null);
  assert.equal(verifySession(cookie, config, now + sessionLifetime * 1000), null);
  assert.equal(verifySession(cookie, config, now - 1000), null);
  assert.equal(verifySession(cookie, { ...config, username: 'other' }, now), null);
  assert.equal(verifySession(cookie, { ...config, sessionSecret: randomBytes(32).toString('base64url') }, now), null);
  assert.equal(verifySession(cookie, { ...config, passwordHash: `${hash}x` }, now), null);
  for (const value of [cookie.slice(0, -1), `${cookie}.extra`, `x${cookie}`, 'x'.repeat(3000)]) assert.equal(verifySession(value, config, now), null);
  const encoded = Buffer.from(JSON.stringify({ ...session, exp: session.exp + 1 })).toString('base64url');
  const mac = createHmac('sha256', config.sessionSecret).update(`session\0${config.passwordHash}\0${encoded}`).digest('base64url');
  assert.equal(verifySession(`${encoded}.${mac}`, config, now), null);
});

test('CSRF requires the authenticated session and rejects absent, altered and unrelated tokens', () => {
  const session = verifySession(createSession(config, now), config, now)!;
  const other = verifySession(createSession(config, now), config, now)!;
  const token = csrfToken(session, config);
  assert.equal(verifyCsrf(token, session, config), true);
  for (const invalid of [null, undefined, '', `${token}x`, csrfToken(other, config)]) assert.equal(verifyCsrf(invalid, session, config), false);
});

test('cookies are HttpOnly, strict, scoped, finite and Secure for production or HTTPS', () => {
  const request = new Request('http://localhost:4321/admin/login');
  assert.deepEqual(cookieOptions(request, false), { httpOnly: true, sameSite: 'strict', secure: false, path: '/admin', maxAge: sessionLifetime });
  assert.equal(cookieOptions(request, true).secure, true);
  assert.equal(cookieOptions(new Request('https://example.com/admin/login'), false).secure, true);
});

test('local login limiter blocks repeated attempts, recovers after expiry and bounds memory', () => {
  const limiter = createLoginLimiter(2, 1000, 2);
  assert.equal(limiter.consume('a', 0), true);
  assert.equal(limiter.consume('a', 1), true);
  assert.equal(limiter.consume('a', 2), false);
  assert.equal(limiter.consume('b', 2), true);
  assert.equal(limiter.consume('c', 2), false);
  limiter.reset('b');
  assert.equal(limiter.consume('c', 3), true);
  assert.equal(limiter.consume('a', 1000), true);
});

function form(body = 'csrf=token', headers: Record<string, string> = {}) {
  return new Request('http://localhost:4321/admin/reservations/status', { method: 'POST', body,
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://localhost:4321', ...headers } });
}

test('admin forms require an exact origin, reject cross-site metadata and arbitrary forwarded hosts', async () => {
  assert.equal((await readAdminForm(form()))?.get('csrf'), 'token');
  const invalidHeaders: Record<string, string>[] = [{ origin: 'https://evil.example' }, { origin: 'null' }, { origin: 'http://localhost:4322' },
    { 'sec-fetch-site': 'cross-site' }, { origin: 'https://evil.example', 'x-forwarded-host': 'evil.example' }];
  for (const headers of invalidHeaders) {
    assert.equal(await readAdminForm(form('csrf=token', headers)), null);
  }
  const missing = form(); missing.headers.delete('origin');
  assert.equal(await readAdminForm(missing), null);
});

test('admin form parser bounds bytes, rejects duplicate fields and incompatible types', async () => {
  assert.equal(await readAdminForm(form('csrf=a&csrf=b')), null);
  assert.equal(await readAdminForm(form('x'.repeat(8193))), null);
  assert.equal(await readAdminForm(form('{}', { 'content-type': 'application/json' })), null);
});

test('only intended state transitions are accepted', () => {
  const allowed = new Set(['pending:confirmed', 'pending:cancelled', 'confirmed:cancelled']);
  for (const expected of ['pending', 'confirmed', 'cancelled', 'deleted', '']) {
    for (const target of ['pending', 'confirmed', 'cancelled', 'deleted', 'completed', 'no-show', '']) {
      assert.equal(validTransition(expected, target), allowed.has(`${expected}:${target}`));
    }
  }
});

test('filters and IDs reject query injection, overflow, coercion and unknown values', () => {
  for (const value of ['pending', 'confirmed', 'cancelled'] as const) assert.equal(statusFilter(value), value);
  for (const value of [null, 'all', 'deleted', "pending' OR 1=1"]) assert.equal(statusFilter(value), 'all');
  for (const value of ['1', '18446744073709551615']) assert.equal(validReservationId(value), true);
  for (const value of ['0', '-1', '01', '1.2', '1e3', '1 OR 1=1', '18446744073709551616', '']) assert.equal(validReservationId(value), false);
});
