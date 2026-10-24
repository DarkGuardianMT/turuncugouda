import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createConnection } from 'mysql2/promise';
import { readDatabaseConfig } from '../src/server/db/config.mjs';
import { readMaintenanceDatabaseConfig } from '../src/server/db/maintenanceConfig.mjs';
import { todayInAmsterdam } from '../src/lib/reservationDate.ts';
import { hashPassword } from '../src/server/admin/password.mjs';
import { hashRateLimitSubject } from '../src/server/rateLimit/core.ts';

if (process.env.RETENTION_INTEGRATION_LOCAL !== '1') throw new Error('Set RETENTION_INTEGRATION_LOCAL=1 explicitly.');
const maintenance = readMaintenanceDatabaseConfig(process.env);
if (!['127.0.0.1', 'localhost', '::1'].includes(maintenance.host)) throw new Error('Only a local test database is supported.');
const db = await createConnection(maintenance);
const app = await createConnection(readDatabaseConfig(process.env));
const marker = `retention-test-${randomBytes(12).toString('hex')}`;
const ids = [];
const cutoff = '1900-01-03';
let server;
let before;
const originalEnvironment = await readFile('.env');
const rateLimitSecret = randomBytes(32).toString('base64url');

async function insert(date, status = 'pending', anonymized = false) {
  const [result] = await db.execute(
    'INSERT INTO reservations (name, phone, email, message, reservation_date, reservation_time, guest_count, status, anonymized_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [anonymized ? null : marker, anonymized ? null : '+31600000000', anonymized ? null : 'fake@example.invalid',
      anonymized ? null : marker, date, '13:30', 2, status, anonymized ? '2001-01-01 12:00:00' : null],
  );
  const id = String(result.insertId); ids.push(id); return id;
}
async function row(id) {
  const [rows] = await db.execute('SELECT * FROM reservations WHERE id = ?', [id]);
  assert.equal(rows.length, 1); return rows[0];
}
function cleanup(apply = false) {
  const result = spawnSync(process.execPath, ['--env-file-if-exists=.env', '--experimental-strip-types', 'scripts/cleanup-reservations.mjs', `--before=${cutoff}`, ...(apply ? ['--apply'] : [])],
    { env: process.env, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, 'Cleanup command must succeed with maintenance credentials');
  assert.ok(!result.stdout.includes(marker) && !result.stdout.includes('fake@example.invalid'));
  return result.stdout;
}

try {
  const [count] = await db.query('SELECT COUNT(*) AS count FROM reservations'); before = Number(count[0].count);
  const [eligible] = await db.execute('SELECT COUNT(*) AS count FROM reservations WHERE reservation_date < ? AND anonymized_at IS NULL', [cutoff]);
  assert.equal(Number(eligible[0].count), 0, 'Refuse to apply test cleanup if unrelated eligible reservations exist');
  const [initialGrants] = await app.query('SHOW GRANTS FOR CURRENT_USER()');
  const [history] = await db.query('SELECT * FROM schema_migrations ORDER BY filename');
  const first = await insert('1900-01-01');
  const second = await insert('1900-01-02', 'confirmed');
  const already = await insert('1900-01-01', 'cancelled', true);
  const boundary = await insert(cutoff);
  const today = await insert(todayInAmsterdam());
  const snapshots = new Map(await Promise.all(ids.map(async (id) => [id, await row(id)])));

  const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port; await new Promise((resolve) => listener.close(resolve));
  const base = `http://localhost:${port}`;
  const password = randomBytes(32).toString('base64url');
  server = spawn(process.execPath, ['./dist/server/entry.mjs'], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port),
    ADMIN_USERNAME: marker, ADMIN_PASSWORD_HASH: await hashPassword(password), ADMIN_SESSION_SECRET: randomBytes(32).toString('base64url'),
    RATE_LIMIT_SECRET: rateLimitSecret, SMTP_HOST: '', SMTP_PASSWORD: '' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  server.stdout.resume(); server.stderr.resume();
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) break;
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* De lokale runtime start nog. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Built local server must start');
  const futureDate = new Date(`${todayInAmsterdam()}T12:00:00Z`); futureDate.setUTCDate(futureDate.getUTCDate() + 1);
  while ([0, 1].includes(futureDate.getUTCDay())) futureDate.setUTCDate(futureDate.getUTCDate() + 1);
  const payload = { name: marker, phone: '+31600000000', email: 'fake@example.invalid', message: marker,
    reservationDate: futureDate.toISOString().slice(0, 10), reservationTime: '13:30', guestCount: 2 };
  const created = await fetch(`${base}/api/reservations`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(created.status, 201); const reservation = await created.json();
  const future = String(reservation.reservationId); ids.push(future); assert.equal(reservation.status, 'pending');
  snapshots.set(future, await row(future));

  assert.ok(cleanup().includes('DRY RUN (no changes): 2 reservation(s) eligible'));
  for (const id of ids) assert.deepEqual(await row(id), snapshots.get(id));
  assert.ok(cleanup(true).includes('Applied: 2 reservation(s) anonymized'));
  for (const id of [first, second]) {
    const result = await row(id); const original = snapshots.get(id);
    for (const field of ['name', 'phone', 'email', 'message']) assert.equal(result[field], null);
    assert.ok(result.anonymized_at);
    for (const field of ['id', 'reservation_date', 'reservation_time', 'guest_count', 'status', 'created_at']) assert.deepEqual(result[field], original[field]);
  }
  for (const id of [already, boundary, today, future]) assert.deepEqual(await row(id), snapshots.get(id));
  const afterApply = new Map(await Promise.all(ids.map(async (id) => [id, await row(id)])));
  assert.ok(cleanup(true).includes('Applied: 0 reservation(s) anonymized'));
  for (const id of ids) assert.deepEqual(await row(id), afterApply.get(id));
  console.log('PASS: real CLI dry-run changes nothing; apply clears only eligible personal fields; boundary/today/future and marked rows preserved; repeat apply is idempotent.');

  await assert.rejects(app.execute('UPDATE reservations SET name = NULL WHERE id = ?', ['0']));
  const [finalGrants] = await app.query('SHOW GRANTS FOR CURRENT_USER()'); assert.deepEqual(finalGrants, initialGrants);
  const [finalHistory] = await db.query('SELECT * FROM schema_migrations ORDER BY filename'); assert.deepEqual(finalHistory, history);
  // Een gemarkeerde huidige rij is uitsluitend een weergavefixture; cleanup heeft deze datum juist overgeslagen.
  await db.execute('UPDATE reservations SET name = NULL, phone = NULL, email = NULL, message = NULL, anonymized_at = CURRENT_TIMESTAMP WHERE id = ? AND name = ?', [today, marker]);
  const login = await fetch(`${base}/admin/auth/login`, { method: 'POST', redirect: 'manual', headers: { origin: base }, body: new URLSearchParams({ username: marker, password }) });
  assert.equal(login.status, 303); const cookie = login.headers.get('set-cookie').split(';')[0];
  const page = await fetch(`${base}/admin/reservations`, { headers: { cookie } }); assert.equal(page.status, 200);
  const html = await page.text();
  const card = [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map((entry) => entry[0]).find((entry) => entry.includes(`name="id" value="${today}"`));
  assert.ok(card?.includes('Geanonimiseerd') && card.includes('Niet beschikbaar'));
  for (const value of ['tel:', 'mailto:', marker, 'Opmerking']) assert.ok(!card.includes(value));
  assert.ok(html.includes(`name="id" value="${future}"`) && html.includes('tel:+31600000000'));
  for (const path of ['/', '/menu', '/galerij', '/reserveren', '/privacy']) {
    const response = await fetch(`${base}${path}`); assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), null);
    const text = await response.text(); assert.ok(text.includes('href="/privacy"') && text.includes('lang="nl"'));
    if (path === '/privacy') assert.equal((text.match(/<h1\b/g) ?? []).length, 1);
    if (path === '/reserveren') assert.ok(text.includes('privacybeleid') && text.includes('pas definitief nadat Turuncu'));
  }
  assert.equal(createHash('sha256').update(await readFile('.env')).digest('hex'), createHash('sha256').update(originalEnvironment).digest('hex'));
  console.log('PASS: anonymized admin cards have no contact/message content; normal public creation remains pending; privacy/footer/form links; app grants, migration history and .env unchanged.');
} finally {
  if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
  try {
    for (const address of ['127.0.0.1', '::1']) await db.execute('DELETE FROM rate_limits WHERE subject_hash = ? AND scope IN (?, ?)',
      [hashRateLimitSubject(address, rateLimitSecret), 'admin_login', 'reservation']);
    // Exacte aangemaakte IDs plus statusafhankelijke testmarkering; nooit bestaande rijen opruimen.
    for (const id of ids) await db.execute('DELETE FROM reservations WHERE id = ? AND (name = ? OR (name IS NULL AND anonymized_at IS NOT NULL))', [id, marker]);
    const [remaining] = await db.query('SELECT COUNT(*) AS count FROM reservations');
    if (before !== undefined) assert.equal(Number(remaining[0].count), before);
    console.log('PASS: exact test IDs removed; starting reservation count restored.');
  } finally { await app.end(); await db.end(); }
}
