import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { access } from 'node:fs/promises';
import { createConnection } from 'mysql2/promise';
import { readDatabaseConfig } from '../src/server/db/config.mjs';
import { hashPassword } from '../src/server/admin/password.mjs';
import { createSession, readAdminConfig } from '../src/server/admin/auth.ts';
import { hashRateLimitSubject } from '../src/server/rateLimit/core.ts';

// Uitsluitend voor een lokale testdatabase; tijdelijke records worden exact op ID en testmarkering verwijderd.
if (process.env.ADMIN_INTEGRATION_LOCAL !== '1') throw new Error('Set ADMIN_INTEGRATION_LOCAL=1 explicitly for local database verification.');
const dbConfig = readDatabaseConfig(process.env);
if (!['localhost', '127.0.0.1', '::1'].includes(dbConfig.host)) throw new Error('Integration verification requires a local database.');
const db = await createConnection(dbConfig);
const marker = `admin-test-${randomBytes(12).toString('hex')}`;
const password = randomBytes(32).toString('base64url');
const adminEnvironment = { ADMIN_USERNAME: marker, ADMIN_PASSWORD_HASH: await hashPassword(password), ADMIN_SESSION_SECRET: randomBytes(32).toString('base64url'),
  RATE_LIMIT_SECRET: randomBytes(32).toString('base64url'), SMTP_HOST: '', SMTP_PASSWORD: '' };
const ids = [];
let server;
let base;
let before;

async function start(extraEnvironment) {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  base = `http://localhost:${port}`;
  server = spawn(process.execPath, ['./dist/server/entry.mjs'], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), ...extraEnvironment }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  // Geen runtime-uitvoer met mogelijk gevoelige gegevens naar de terminal doorgeven.
  server.stdout.resume(); server.stderr.resume();
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await fetch(`${base}/`); return; } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  throw new Error('Local built runtime did not start.');
}

async function stop() {
  if (server && server.exitCode === null) { const ended = once(server, 'exit'); server.kill(); await ended; }
  server = undefined;
}

function get(path, cookie = '') { return fetch(`${base}${path}`, { headers: { cookie }, redirect: 'manual' }); }
function post(path, data, cookie = '', origin = base) {
  return fetch(`${base}${path}`, { method: 'POST', redirect: 'manual', body: new URLSearchParams(data), headers: { origin, cookie } });
}
function privateHeaders(response) {
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('referrer-policy'), 'same-origin');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('content-security-policy'), "frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
}
async function login() {
  const response = await post('/admin/auth/login', { username: marker, password });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/admin/reservations');
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie && /HttpOnly/i.test(cookie) && /SameSite=Strict/i.test(cookie) && /Secure/i.test(cookie));
  assert.ok(/Path=\/admin/i.test(cookie) && /Max-Age=36000/i.test(cookie));
  return cookie.split(';')[0];
}
function token(html) {
  const value = html.match(/name="csrf" value="([A-Za-z0-9_-]+)"/);
  assert.ok(value, 'Private page must contain a CSRF token');
  return value[1];
}
async function storedStatus(id) {
  const [rows] = await db.execute('SELECT status FROM reservations WHERE id = ? AND name = ?', [id, marker]);
  assert.equal(rows.length, 1);
  return rows[0].status;
}
async function publicRequest(data, origin = base) {
  return fetch(`${base}/api/reservations`, { method: 'POST', body: JSON.stringify(data), headers: { 'content-type': 'application/json', origin } });
}

try {
  const [count] = await db.query('SELECT COUNT(*) AS count FROM reservations');
  before = Number(count[0].count);
  await start({ ...adminEnvironment, ADMIN_SESSION_SECRET: '' });
  const missingConfig = await get('/admin/reservations');
  assert.equal(missingConfig.status, 503); privateHeaders(missingConfig);
  assert.ok(!(await missingConfig.text()).includes('ADMIN_'));
  await stop();
  await start({ ...adminEnvironment, DB_PORT: '1' });
  const unavailableLogin = await post('/admin/auth/login', { username: marker, password });
  assert.equal(unavailableLogin.status, 503); assert.equal(unavailableLogin.headers.get('set-cookie'), null);
  const brokenDbCookie = `turuncu_admin=${createSession(readAdminConfig(adminEnvironment))}`;
  const brokenList = await get('/admin/reservations', brokenDbCookie);
  assert.equal(brokenList.status, 503); privateHeaders(brokenList);
  const brokenHtml = await brokenList.text();
  assert.ok(brokenHtml.includes('tijdelijk niet beschikbaar') && !/ECONNREFUSED|SELECT .*FROM|DB_PORT/.test(brokenHtml));
  const brokenUpdate = await post('/admin/reservations/status', { id: '1', expected: 'pending', target: 'confirmed', csrf: token(brokenHtml) }, brokenDbCookie);
  assert.ok(brokenUpdate.headers.get('location').includes('notice=error'));
  await stop();
  console.log('PASS: missing admin configuration and database failures fail safely without exposing details.');
  await start(adminEnvironment);
  for (const path of ['/', '/menu', '/galerij', '/reserveren']) {
    const response = await get(path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('lang="nl"') && html.includes('id="main-content"'));
    for (const match of html.matchAll(/(?:src|href)="(\/_astro\/[^"?#]+)"/g)) assert.equal((await get(match[1])).status, 200);
    if (path === '/galerij') assert.equal((html.match(/data-gallery-image=/g) ?? []).length, 13);
    if (path === '/reserveren') assert.ok(html.includes('data-reservation-form') && html.includes('pas definitief'));
    assert.ok(html.includes('menu-toggle'), 'Shared mobile navigation remains present');
  }
  await assert.rejects(access('dist/client/admin/login/index.html'));
  await assert.rejects(access('dist/client/admin/reservations/index.html'));
  const unauthenticated = await get('/admin/reservations');
  assert.equal(unauthenticated.status, 303); privateHeaders(unauthenticated);
  assert.equal(unauthenticated.headers.get('location'), '/admin/login');
  assert.equal((await post('/admin/reservations/status', { id: '1', target: 'confirmed' })).status, 303);
  const loginPage = await get('/admin/login');
  assert.equal(loginPage.status, 200); privateHeaders(loginPage);
  assert.ok((await loginPage.text()).includes('autocomplete="current-password"'));
  assert.equal((await post('/admin/auth/login', { username: marker, password: 'incorrect' })).headers.get('location'), '/admin/login?notice=invalid');
  assert.equal((await post('/admin/auth/login', { username: marker, password }, '', 'https://evil.example')).status, 403);
  const cookie = await login();
  const otherCookie = await login();
  assert.equal((await get('/admin/login', cookie)).headers.get('location'), '/admin/reservations');
  const otherToken = token(await (await get('/admin/reservations', otherCookie)).text());
  if (before === 0) assert.ok((await (await get('/admin/reservations', cookie)).text()).includes('Geen reserveringen gevonden.'));
  assert.equal((await get('/admin/reservations', `${cookie}x`)).status, 303);

  const dayParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const datePart = (type) => dayParts.find((part) => part.type === type).value;
  const day = new Date(`${datePart('year')}-${datePart('month')}-${datePart('day')}T12:00:00Z`);
  while ([0, 1].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  const payload = { name: marker, phone: '+31600000000', email: 'fake@example.invalid', reservationDate: day.toISOString().slice(0, 10), reservationTime: '13:30', guestCount: 2, message: '<script>alert("test")</script>\nFake test message', contact_url: '' };
  const created = await publicRequest(payload);
  assert.equal(created.status, 201);
  const result = await created.json();
  ids.push(String(result.reservationId));
  assert.equal(result.status, 'pending');
  const id = ids[0];
  const [past] = await db.execute(
    "INSERT INTO reservations (name, phone, reservation_date, reservation_time, guest_count, message) VALUES (?, ?, ?, ?, ?, ?)",
    [marker, '+31600000000', '2000-01-01', '13:30', 2, `${marker}-past`],
  );
  ids.push(String(past.insertId));
  assert.equal(await storedStatus(id), 'pending');
  for (const [data, origin, expected] of [[{ ...payload, contact_url: 'spam' }, base, 400], [{ ...payload, status: 'confirmed' }, base, 400], [payload, 'https://evil.example', 403]]) {
    assert.equal((await publicRequest(data, origin)).status, expected);
  }
  const listResponse = await get('/admin/reservations?status=pending', cookie);
  assert.equal(listResponse.status, 200); privateHeaders(listResponse);
  const html = await listResponse.text();
  assert.ok(html.includes(marker) && html.includes('In afwachting') && html.includes('tel:+31600000000') && html.includes('mailto:fake@example.invalid'));
  assert.ok(!html.includes('<script>alert') && html.includes('&lt;script&gt;'));
  assert.ok(!html.includes(`${marker}-past`), 'Past reservations must be excluded');
  const csrf = token(html);
  const action = { csrf, id, expected: 'pending', target: 'confirmed', filter: 'pending' };
  for (const invalidCsrf of ['', `${csrf}x`, otherToken]) assert.equal((await post('/admin/reservations/status', { ...action, csrf: invalidCsrf }, cookie)).status, 403);
  assert.equal((await post('/admin/reservations/status', action, cookie, 'https://evil.example')).status, 403);
  for (const invalid of [{ target: 'deleted' }, { target: 'pending' }, { id: '-1' }, { id: '1 OR 1=1' }]) assert.equal((await post('/admin/reservations/status', { ...action, ...invalid }, cookie)).status, 400);
  assert.equal(await storedStatus(id), 'pending');
  assert.equal((await get('/admin/reservations/status', cookie)).status, 405);
  assert.equal((await post('/admin/auth/logout', { csrf: '' }, otherCookie)).status, 403);
  const logout = await post('/admin/auth/logout', { csrf: otherToken }, otherCookie);
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get('location'), '/admin/login');
  const expiry = logout.headers.get('set-cookie')?.match(/Expires=([^;]+)/i)?.[1];
  assert.ok(expiry && Date.parse(expiry) < Date.now());
  assert.equal((await get('/admin/reservations')).status, 303);
  for (let i = 0; i < 6; i++) await post('/admin/auth/login', { username: marker, password: 'incorrect' });
  assert.equal((await post('/admin/auth/login', { username: marker, password })).headers.get('location'), '/admin/login?notice=limited');
  const spoofed = await fetch(`${base}/admin/auth/login`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ username: marker, password }),
    headers: { origin: base, 'x-forwarded-for': '203.0.113.99' } });
  assert.equal(spoofed.headers.get('location'), '/admin/login?notice=limited');
  console.log('PASS: built runtime, public regression, authentication, cookies, CSRF, XSS escaping, logout and limiter.');
  try {
    await db.execute('UPDATE reservations SET status = status WHERE id = ? AND name = ?', ['0', marker]);
  } catch {
    throw new Error('The local application DB account needs UPDATE(status) permission on reservations to finish integration verification.');
  }
  const updated = await post('/admin/reservations/status', action, cookie);
  assert.equal(updated.status, 303);
  assert.ok(updated.headers.get('location').includes('notice=updated'));
  assert.equal(await storedStatus(id), 'confirmed');
  const stale = await post('/admin/reservations/status', { ...action, target: 'cancelled' }, cookie);
  assert.ok(stale.headers.get('location').includes('notice=stale'));
  assert.equal(await storedStatus(id), 'confirmed');
  assert.ok(!(await (await get('/admin/reservations?status=pending', cookie)).text()).includes(marker));
  assert.ok((await (await get('/admin/reservations?status=confirmed', cookie)).text()).includes(marker));
  const cancelled = await post('/admin/reservations/status', { ...action, expected: 'confirmed', target: 'cancelled' }, cookie);
  assert.equal(cancelled.status, 303);
  assert.equal(await storedStatus(id), 'cancelled');
  assert.ok((await (await get('/admin/reservations?status=cancelled', cookie)).text()).includes(marker));
  assert.ok((await (await get('/admin/reservations?status=unknown', cookie)).text()).includes(marker));
  console.log('PASS: filters, status transitions and stale updates.');
} finally {
  await stop();
  try {
    for (const address of ['127.0.0.1', '::1']) await db.execute('DELETE FROM rate_limits WHERE subject_hash = ? AND scope IN (?, ?)',
      [hashRateLimitSubject(address, adminEnvironment.RATE_LIMIT_SECRET), 'admin_login', 'reservation']);
    for (const id of ids) await db.execute('DELETE FROM reservations WHERE id = ? AND name = ?', [id, marker]);
    const [remaining] = await db.query('SELECT COUNT(*) AS count FROM reservations');
    if (before !== undefined) assert.equal(Number(remaining[0].count), before, 'Final reservation count must match starting count');
    const [testRows] = await db.execute('SELECT COUNT(*) AS count FROM reservations WHERE name = ?', [marker]);
    assert.equal(Number(testRows[0].count), 0);
    console.log('PASS: exact test-row cleanup; reservation count restored.');
  } finally { await db.end(); }
}
