import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createConnection, createPool } from 'mysql2/promise';
import { readDatabaseConfig } from '../src/server/db/config.mjs';
import { readMaintenanceDatabaseConfig } from '../src/server/db/maintenanceConfig.mjs';
import { createRateLimiter, hashRateLimitSubject } from '../src/server/rateLimit/core.ts';
import { hashPassword } from '../src/server/admin/password.mjs';

// Expliciet lokaal: geen productieverbinding, echte mail of wijziging van .env/grants.
if (process.env.RATE_LIMIT_INTEGRATION_LOCAL !== '1') throw new Error('Set RATE_LIMIT_INTEGRATION_LOCAL=1 explicitly.');
const maintenance = readMaintenanceDatabaseConfig(process.env);
const runtime = readDatabaseConfig(process.env);
if (![maintenance.host, runtime.host].every((host) => ['127.0.0.1', 'localhost', '::1'].includes(host))) {
  throw new Error('Rate limit verification requires a loopback database.');
}
const originalEnvironment = await readFile('.env');
const db = await createConnection(maintenance);
const pools = [createPool(runtime), createPool(runtime)];
const secret = randomBytes(32).toString('base64url');
const subjects = new Set();
const marker = `rate-limit-test-${randomBytes(12).toString('hex')}`;
const password = randomBytes(32).toString('base64url');
const environment = { RATE_LIMIT_SECRET: secret, ADMIN_USERNAME: marker,
  ADMIN_PASSWORD_HASH: await hashPassword(password), ADMIN_SESSION_SECRET: randomBytes(32).toString('base64url'),
  SMTP_HOST: '', SMTP_PASSWORD: '' };
const servers = [];
const ids = [];
let before;
let migrated = false;
function subject(address) { subjects.add(hashRateLimitSubject(address, secret)); return address; }
function migrations() {
  const result = spawnSync(process.execPath, ['scripts/migrate.mjs', '--maintenance'], {
    env: process.env, encoding: 'utf8', windowsHide: true,
  });
  assert.equal(result.status, 0, 'Local migrations must succeed (check maintenance privileges)');
  return result.stdout;
}
async function start() {
  const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port; await new Promise((resolve) => listener.close(resolve));
  const base = `http://localhost:${port}`;
  const child = spawn(process.execPath, ['./dist/server/entry.mjs'], { env: {
    ...process.env, ...environment, HOST: '127.0.0.1', PORT: String(port),
  }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.resume(); child.stderr.resume(); servers.push(child);
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) break;
    try { if ((await fetch(base)).ok) return { child, base }; } catch { /* De lokale runtime start nog. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Built local server did not start.');
}
async function stop(child) {
  if (child.exitCode === null && child.signalCode === null) { const ended = once(child, 'exit'); child.kill(); await ended; }
}
function reserve(base, body = '{}', host = '', extra = {}) {
  return fetch(`${base}/api/reservations`, { method: 'POST', body, headers: {
    'content-type': 'application/json', origin: host ? `https://${host}` : base,
    ...(host ? { 'x-forwarded-host': host, 'x-forwarded-proto': 'https' } : {}), ...extra,
  } });
}
function login(base, value = 'incorrect') {
  return fetch(`${base}/admin/auth/login`, { method: 'POST', redirect: 'manual',
    body: new URLSearchParams({ username: marker, password: value }), headers: { origin: base } });
}

try {
  const [history] = await db.query('SELECT filename, checksum FROM schema_migrations ORDER BY filename');
  const [count] = await db.query('SELECT COUNT(*) AS count FROM reservations'); before = Number(count[0].count);
  migrations(); migrated = true;
  assert.ok(migrations().includes('Already applied: 003_create_rate_limits.sql'));
  const sql = await readFile('db/migrations/003_create_rate_limits.sql', 'utf8');
  const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
  const [after] = await db.query('SELECT filename, checksum FROM schema_migrations ORDER BY filename');
  for (const row of history) assert.deepEqual(after.find((item) => item.filename === row.filename), row);
  assert.equal(after.find((row) => row.filename === '003_create_rate_limits.sql').checksum, checksum);
  const [columns] = await db.query('SHOW COLUMNS FROM rate_limits');
  assert.deepEqual(columns.map((column) => column.Field), ['scope', 'subject_hash', 'window_started_at', 'attempt_count', 'updated_at']);
  const [stale] = await db.query('SELECT COUNT(*) AS count FROM rate_limits WHERE updated_at < UTC_TIMESTAMP(3) - INTERVAL 1 HOUR');
  assert.equal(Number(stale[0].count), 0, 'Refuse opportunistic cleanup verification with unrelated stale limiter rows');
  console.log(`PASS: local migration, repeat skip, unchanged prior checksums and schema; checksum ${checksum}.`);

  const limiters = pools.map((pool) => createRateLimiter(() => pool, () => secret));
  const address = subject('2001:db8::1');
  const input = { scope: 'reservation', subject: address };
  const results = await Promise.all(Array.from({ length: 30 }, (_, i) => limiters[i % 2].consume(input)));
  assert.equal(results.filter((result) => result.allowed).length, 5);
  assert.ok(results.filter((result) => !result.allowed).every((result) => result.retryAfterSeconds >= 1 && result.retryAfterSeconds <= 900));
  const restarted = createRateLimiter(() => pools[0], () => secret);
  assert.equal((await restarted.consume(input)).allowed, false);
  assert.equal((await restarted.consume({ ...input, scope: 'admin_login' })).allowed, true);
  assert.equal((await restarted.consume({ ...input, subject: subject('192.0.2.2') })).allowed, true);
  await db.execute('UPDATE rate_limits SET window_started_at = UTC_TIMESTAMP(3) - INTERVAL 901 SECOND WHERE scope = ? AND subject_hash = ?', ['reservation', hashRateLimitSubject(address, secret)]);
  assert.equal((await restarted.consume(input)).remaining, 4);
  await restarted.reset(input);
  assert.equal((await restarted.consume(input)).remaining, 4);
  console.log('PASS: 30 concurrent consumptions across two independent pools allow exactly five; recreation, scope/address isolation, expiry and reset.');

  for (let i = 0; i < 105; i++) {
    const hash = hashRateLimitSubject(subject(`2001:db8:1::${(i + 1).toString(16)}`), secret);
    await db.execute(`INSERT INTO rate_limits VALUES (?, ?, UTC_TIMESTAMP(3) - INTERVAL 2 HOUR, 5, UTC_TIMESTAMP(3) - INTERVAL 2 HOUR)`, ['reservation', hash]);
  }
  await createRateLimiter(() => pools[0], () => secret).consume(input);
  const [remaining] = await db.query('SELECT COUNT(*) AS count FROM rate_limits WHERE updated_at < UTC_TIMESTAMP(3) - INTERVAL 1 HOUR');
  assert.equal(Number(remaining[0].count), 5);
  await createRateLimiter(() => pools[1], () => secret).consume(input);
  const [expired] = await db.query('SELECT COUNT(*) AS count FROM rate_limits WHERE updated_at < UTC_TIMESTAMP(3) - INTERVAL 1 HOUR');
  assert.equal(Number(expired[0].count), 0);
  console.log('PASS: actual indexed cleanup deletes at most 100 stale rows per operation.');

  subject('127.0.0.1'); subject('::1');
  const first = await start(); const second = await start();
  const date = new Date(); date.setUTCDate(date.getUTCDate() + 7);
  while ([0, 1].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  const valid = { name: marker, phone: '+31600000000', reservationDate: date.toISOString().slice(0, 10), reservationTime: '13:31', guestCount: 2 };
  const created = await reserve(first.base, JSON.stringify(valid)); assert.equal(created.status, 201);
  const result = await created.json(); ids.push(String(result.reservationId)); assert.equal(result.status, 'pending');
  for (let i = 1; i < 5; i++) {
    const base = i % 2 ? second.base : first.base;
    const host = i % 2 ? 'turuncugouda.com' : 'www.turuncugouda.com';
    assert.equal((await reserve(base, i % 2 ? '{' : '{}', host)).status, 400);
  }
  const blocked = await reserve(second.base, '{}', '', { 'x-forwarded-for': '192.0.2.99', forwarded: 'for=192.0.2.99' });
  assert.equal(blocked.status, 429); assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
  await stop(first.child); const fresh = await start();
  assert.equal((await reserve(fresh.base)).status, 429);
  for (let i = 0; i < 4; i++) assert.equal((await login(i % 2 ? fresh.base : second.base)).headers.get('location'), '/admin/login?notice=invalid');
  const success = await login(second.base, password);
  assert.equal(success.headers.get('location'), '/admin/reservations');
  const cookie = success.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  assert.equal((await fetch(`${second.base}/admin/reservations`, { headers: { cookie }, redirect: 'manual' })).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await login(i % 2 ? fresh.base : second.base)).headers.get('location'), '/admin/login?notice=invalid');
  assert.equal((await login(fresh.base, password)).headers.get('location'), '/admin/login?notice=limited');
  console.log('PASS: built HTTP reservation 201/429, invalid payloads, Retry-After, shared apex/www quotas across two Node processes, restart persistence and admin reset/session/limit.');
} finally {
  for (const child of servers) await stop(child);
  try {
    for (const id of ids) await db.execute('DELETE FROM reservations WHERE id = ? AND name = ?', [id, marker]);
    if (migrated) for (const hash of subjects) await db.execute('DELETE FROM rate_limits WHERE subject_hash = ? AND scope IN (?, ?)', [hash, 'reservation', 'admin_login']);
    if (before !== undefined) {
      const [count] = await db.query('SELECT COUNT(*) AS count FROM reservations'); assert.equal(Number(count[0].count), before);
    }
    assert.deepEqual(await readFile('.env'), originalEnvironment);
    console.log('PASS: exact synthetic row cleanup, existing reservation count and unchanged .env; no production connection.');
  } finally { for (const pool of pools) await pool.end(); await db.end(); }
}
