import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRateLimiter, hashRateLimitSubject, normalizeClientAddress, readRateLimitSecret, RateLimitUnavailableError } from '../src/server/rateLimit/core.ts';
import { createRateLimitTestDatabase } from './helpers/rateLimitDatabase.ts';

const secret = randomBytes(32).toString('base64url');
const subject = '192.0.2.1';
const input = { scope: 'reservation', subject } as const;
function setup() {
  const { pool, state } = createRateLimitTestDatabase();
  return { state, limiter: createRateLimiter(() => pool, () => secret) };
}

test('first through fifth attempts are allowed, sixth is blocked without increasing or extending the window', async () => {
  const { limiter, state } = setup();
  for (let i = 1; i <= 5; i++) {
    const result = await limiter.consume(input);
    assert.equal(result.allowed, true); assert.equal(result.remaining, 5 - i);
  }
  state.now += 1001;
  assert.deepEqual(await limiter.consume(input), { allowed: false, remaining: 0, retryAfterSeconds: 899, resetAfterMs: 898999 });
  const row = [...state.rows.values()][0]!;
  assert.equal(row.count, 5); assert.equal(row.started, 1_000_000); assert.equal(row.updated, 1_000_000);
  assert.equal(state.commits, 6); assert.equal(state.releases, 6);
});

test('retry-after rounds up to seconds and exact expiry starts a fresh fixed window', async () => {
  const { limiter, state } = setup();
  const policy = { ...input, maximum: 1, windowMs: 1001 };
  assert.equal((await limiter.consume(policy)).retryAfterSeconds, 2);
  state.now += 1;
  assert.equal((await limiter.consume(policy)).retryAfterSeconds, 1);
  state.now += 999;
  assert.equal((await limiter.consume(policy)).allowed, false);
  state.now++;
  assert.deepEqual(await limiter.consume(policy), { allowed: true, remaining: 0, retryAfterSeconds: 2, resetAfterMs: 1001 });
});

test('scopes and addresses are isolated; reset only clears the successful login subject', async () => {
  const { limiter, state } = setup();
  const login = { ...input, scope: 'admin_login' } as const;
  await limiter.consume(login); await limiter.consume(input);
  await limiter.consume({ ...login, subject: '2001:db8::2' });
  assert.equal(state.rows.size, 3);
  await limiter.reset(login);
  assert.equal(state.rows.size, 2);
  assert.equal((await limiter.consume(login)).remaining, 4);
  assert.equal((await limiter.consume(input)).remaining, 3);
});

test('HMAC is deterministic, secret-dependent and stores only the digest as the subject', async () => {
  const { limiter, state } = setup();
  const hash = hashRateLimitSubject(subject, secret);
  assert.equal(hash, createHmac('sha256', secret).update(subject).digest('hex'));
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, hashRateLimitSubject(subject, randomBytes(32).toString('base64url')));
  await limiter.consume(input); await limiter.reset(input);
  for (const { sql, parameters } of state.statements) {
    assert.ok(!JSON.stringify({ sql, parameters }).includes(subject));
    assert.ok(!JSON.stringify({ sql, parameters }).includes(secret));
    if (parameters.length) assert.deepEqual(parameters, ['reservation', hash]);
  }
});

test('conservative IPv4/IPv6 normalization prevents alternate spelling and IPv4-mapped bypasses', () => {
  for (const value of ['192.0.2.1', ' 192.0.2.1 ', '::ffff:192.0.2.1', '0:0:0:0:0:ffff:c000:0201']) {
    assert.equal(normalizeClientAddress(value), '192.0.2.1');
    assert.equal(hashRateLimitSubject(value, secret), hashRateLimitSubject(subject, secret));
  }
  assert.equal(normalizeClientAddress('2001:0DB8:0000:0000:0000:0000:0000:0001'), '2001:db8::1');
  for (const invalid of ['', 'unknown', '192.0.2.1, 192.0.2.2', '192.0.2.1:1234', '[2001:db8::1]', '0127.0.0.1', 'fe80::1%eth0']) {
    assert.throws(() => normalizeClientAddress(invalid), /RATE_LIMIT_UNAVAILABLE/);
  }
});

test('configuration is lazy, rejects missing/weak/placeholder secrets and never includes their values in errors', async () => {
  const { pool, state } = createRateLimitTestDatabase();
  let current: string | undefined;
  const limiter = createRateLimiter(() => pool, () => current);
  assert.equal(state.statements.length, 0);
  for (const invalid of [undefined, '', 'short', 'your_random_rate_limit_secret', 'x'.repeat(129), secret + '\n']) {
    current = invalid;
    await assert.rejects(limiter.consume(input), { message: 'RATE_LIMIT_UNAVAILABLE' });
    assert.throws(() => readRateLimitSecret(invalid), RateLimitUnavailableError);
  }
  assert.equal(state.statements.length, 0);
  current = secret; assert.equal((await limiter.consume(input)).allowed, true);
});

test('invalid policies and unavailable addresses fail closed before database access', async () => {
  const { limiter, state } = setup();
  for (const options of [{ maximum: 0 }, { maximum: 1.5 }, { windowMs: 0 }, { windowMs: 900001 }, { subject: 'bad address' }]) {
    await assert.rejects(limiter.consume({ ...input, ...options }), /RATE_LIMIT_UNAVAILABLE/);
  }
  assert.equal(state.statements.length, 0);
});

for (const failure of ['CONNECT', 'INSERT INTO', 'FOR UPDATE', 'UPDATE rate_limits', 'COMMIT']) {
  test(`database ${failure} failure is sanitized, releases connections and rolls back when acquired`, async () => {
    const { limiter, state } = setup(); state.fail = failure;
    await assert.rejects(limiter.consume(input), { message: 'RATE_LIMIT_UNAVAILABLE' });
    assert.equal(state.releases, failure === 'CONNECT' ? 0 : 1);
    assert.equal(state.rollbacks, failure === 'CONNECT' ? 0 : 1);
  });
}

test('reset failures are sanitized', async () => {
  const { limiter, state } = setup(); state.fail = 'DELETE';
  await assert.rejects(limiter.reset(input), { message: 'RATE_LIMIT_UNAVAILABLE' });
});

test('cleanup is indexed/bounded, at most once a minute per instance, and failure does not undo a durable decision', async (context) => {
  const { limiter, state } = setup(); let now = 100_000;
  context.mock.method(Date, 'now', () => now);
  const log = context.mock.method(console, 'error', () => {});
  state.fail = 'ORDER BY updated_at';
  assert.equal((await limiter.consume(input)).allowed, true);
  assert.deepEqual(log.mock.calls[0]!.arguments, ['Rate limit cleanup failed:', 'RATE_LIMIT_CLEANUP_FAILED']);
  for (let i = 0; i < 3; i++) await limiter.consume(input);
  const cleanups = () => state.statements.filter(({ sql }) => sql.includes('ORDER BY updated_at'));
  assert.equal(cleanups().length, 1);
  assert.match(cleanups()[0]!.sql, /INTERVAL 1 HOUR[\s\S]*ORDER BY updated_at LIMIT 100/);
  now += 60_000; state.fail = ''; await limiter.consume(input);
  assert.equal(cleanups().length, 2);
});

test('migration creates only durable keyed limiter state with an indexed cleanup timestamp and canonical checksum', () => {
  const sql = readFileSync('db/migrations/003_create_rate_limits.sql', 'utf8');
  assert.match(sql, /PRIMARY KEY \(scope, subject_hash\)/);
  assert.match(sql, /subject_hash CHAR\(64\).*ascii_bin/);
  assert.match(sql, /INDEX rate_limits_updated_at \(updated_at\)/);
  assert.match(sql, /ENGINE=InnoDB/);
  assert.equal((sql.match(/DATETIME\(3\)/g) ?? []).length, 2);
  assert.ok(!/\b(?:ip|address|name|phone|email|message)\b/i.test(sql));
  const checksum = (text: string) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
  assert.equal(checksum(sql), checksum(sql.replace(/\r?\n/g, '\r\n')));
});
