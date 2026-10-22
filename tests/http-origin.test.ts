import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowedOrigin } from '../src/server/http/origin.ts';
import { isAllowedReservationOrigin } from '../src/server/reservations/requestGuards.ts';
import { readAdminForm } from '../src/server/admin/http.ts';

function request(origin: string, headers: Record<string, string> = {}, path = '/api/reservations') {
  return new Request(`${origin}${path}`, { method: 'POST',
    headers: { origin, ...headers } });
}

for (const host of ['turuncugouda.com', 'www.turuncugouda.com']) {
  const origin = `https://${host}`;

  test(`reservation guard accepts the Astro-normalized HTTPS origin for ${host}`, () => {
    assert.equal(isAllowedReservationOrigin(request(origin)), true);
    assert.equal(isAllowedReservationOrigin(request(origin, {
      'x-forwarded-host': host, 'x-forwarded-proto': 'https', 'x-forwarded-port': '443',
    })), true);
    assert.equal(isAllowedReservationOrigin(request(origin, { 'x-forwarded-host': `${host}:443` })), true);
    assert.equal(isAllowedReservationOrigin(request(origin, { 'x-forwarded-proto': 'https' })), true);
  });

  test(`admin login accepts only the matching HTTPS origin for ${host}`, async () => {
    const form = (headers: Record<string, string> = {}) => new Request(`${origin}/admin/auth/login`, {
      method: 'POST', body: 'username=example&password=example',
      headers: { origin, 'content-type': 'application/x-www-form-urlencoded',
        'x-forwarded-host': host, 'x-forwarded-proto': 'https', ...headers },
    });
    assert.equal((await readAdminForm(form()))?.get('username'), 'example');
    const invalidHeaders: Record<string, string>[] = [{ origin: 'https://evil.example' }, { origin: `http://${host}` },
      { 'x-forwarded-host': 'evil.example' }, { 'sec-fetch-site': 'cross-site' }];
    for (const headers of invalidHeaders) {
      assert.equal(await readAdminForm(form(headers)), null);
    }
    const missing = form(); missing.headers.delete('origin');
    assert.equal(await readAdminForm(missing), null);
  });
}

test('a trusted host never authorizes a different Origin, even the other Turuncu host', () => {
  for (const origin of ['https://evil.example', 'https://turuncugouda.com',
    'http://www.turuncugouda.com', 'https://www.turuncugouda.com:8443',
    'https://www.turuncugouda.com/path', 'null']) {
    assert.equal(isAllowedOrigin(request('https://www.turuncugouda.com', { origin,
      'x-forwarded-host': 'www.turuncugouda.com', 'x-forwarded-proto': 'https' })), false);
  }
});

test('unapproved, ambiguous or conflicting forwarded headers fail closed', () => {
  const invalidHeaders: Record<string, string>[] = [
    { 'x-forwarded-host': 'evil.example' },
    { 'x-forwarded-host': 'www.turuncugouda.com.evil.example' },
    { 'x-forwarded-host': 'www.turuncugouda.com@evil.example' },
    { 'x-forwarded-host': 'www.turuncugouda.com:8443' },
    { 'x-forwarded-host': 'www.turuncugouda.com, evil.example' },
    { 'x-forwarded-host': 'turuncugouda.com' },
    { 'x-forwarded-proto': 'http' },
    { 'x-forwarded-proto': 'https, http' },
    { 'x-forwarded-proto': 'ftp' },
    { 'x-forwarded-port': '8443' },
    { 'x-forwarded-port': '443, 80' },
  ];
  for (const headers of invalidHeaders) assert.equal(isAllowedOrigin(request('https://www.turuncugouda.com', headers)), false);
});

test('raw internal URLs do not bypass Astro proxy normalization', () => {
  assert.equal(isAllowedOrigin(request('http://localhost:3000', {
    origin: 'https://www.turuncugouda.com', 'x-forwarded-host': 'www.turuncugouda.com',
    'x-forwarded-proto': 'https',
  })), false);
  for (const origin of ['http://www.turuncugouda.com', 'https://evil.example',
    'https://www.turuncugouda.com:8443']) assert.equal(isAllowedOrigin(request(origin)), false);
});

test('direct local development keeps exact host, scheme and port checks', async () => {
  for (const origin of ['http://localhost:4321', 'http://127.0.0.1:4321', 'http://[::1]:4321']) {
    assert.equal(isAllowedReservationOrigin(request(origin)), true);
    assert.equal(isAllowedReservationOrigin(request(origin, { origin: 'http://localhost:4322' })), false);
    const login = new Request(`${origin}/admin/auth/login`, { method: 'POST', body: 'username=example',
      headers: { origin, 'content-type': 'application/x-www-form-urlencoded' } });
    assert.equal((await readAdminForm(login))?.get('username'), 'example');
  }
});

test('Origin-less public clients remain supported while admin still requires Origin', () => {
  const api = new Request('https://www.turuncugouda.com/api/reservations');
  assert.equal(isAllowedReservationOrigin(api), true);
  assert.equal(isAllowedOrigin(api, true), false);
  assert.equal(isAllowedReservationOrigin(new Request(api, { headers: { 'sec-fetch-site': 'cross-site' } })), false);
});
