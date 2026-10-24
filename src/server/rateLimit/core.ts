import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { Pool, RowDataPacket } from 'mysql2/promise';

export type RateLimitScope = 'admin_login' | 'reservation';
export const rateLimitPolicy = { maximum: 5, windowMs: 15 * 60 * 1000 } as const;
export class RateLimitUnavailableError extends Error {
  constructor() { super('RATE_LIMIT_UNAVAILABLE'); }
}

export function readRateLimitSecret(value: string | undefined): string {
  if (!value || !/^[A-Za-z0-9_-]{43,128}$/.test(value) || Buffer.from(value, 'base64url').length < 32) {
    throw new RateLimitUnavailableError();
  }
  return value;
}

export function normalizeClientAddress(address: string): string {
  if (typeof address !== 'string' || address.length > 128) throw new RateLimitUnavailableError();
  const value = address.trim();
  if (isIP(value) === 4) return value;
  if (isIP(value) !== 6 || value.includes('%')) throw new RateLimitUnavailableError();
  // De URL-parser normaliseert hoofdletters en equivalente IPv6-schrijfwijzen.
  const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  if (normalized.startsWith('::ffff:')) {
    const words = normalized.slice(7).split(':').map((word) => parseInt(word, 16));
    return [words[0]! >>> 8, words[0]! & 255, words[1]! >>> 8, words[1]! & 255].join('.');
  }
  return normalized;
}

export function hashRateLimitSubject(address: string, secret: string): string {
  return createHmac('sha256', readRateLimitSecret(secret)).update(normalizeClientAddress(address)).digest('hex');
}

interface RateLimitInput {
  scope: RateLimitScope;
  subject: string;
  maximum?: number;
  windowMs?: number;
}
export interface RateLimitResult { allowed: boolean; remaining: number; retryAfterSeconds: number; resetAfterMs: number }
type RateLimitPool = Pick<Pool, 'getConnection' | 'execute'>;
interface LockedWindow extends RowDataPacket { attempt_count: number; elapsed_ms: number | string }

export function createRateLimiter(getPool: () => RateLimitPool, getSecret: () => string | undefined) {
  let nextCleanupAt = 0;

  function key(scope: RateLimitScope, subject: string): string {
    if (scope !== 'admin_login' && scope !== 'reservation') throw new RateLimitUnavailableError();
    return hashRateLimitSubject(subject, readRateLimitSecret(getSecret()));
  }

  async function cleanup(pool: RateLimitPool) {
    const now = Date.now();
    if (now < nextCleanupAt) return;
    // Alleen de opruimfrequentie is lokaal; alle quota en vensters staan in MySQL.
    nextCleanupAt = now + 60_000;
    try {
      await pool.execute(`DELETE FROM rate_limits
        WHERE updated_at < UTC_TIMESTAMP(3) - INTERVAL 1 HOUR
        ORDER BY updated_at LIMIT 100`);
    } catch {
      // Het quotum is al duurzaam vastgelegd; een opruimfout wijzigt de beslissing niet.
      console.error('Rate limit cleanup failed:', 'RATE_LIMIT_CLEANUP_FAILED');
    }
  }

  return {
    async consume({ scope, subject, maximum = rateLimitPolicy.maximum, windowMs = rateLimitPolicy.windowMs }: RateLimitInput): Promise<RateLimitResult> {
      try {
        if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 1_000_000
          || !Number.isSafeInteger(windowMs) || windowMs < 1 || windowMs > rateLimitPolicy.windowMs) {
          throw new RateLimitUnavailableError();
        }
        const hash = key(scope, subject);
        const pool = getPool();
        const connection = await pool.getConnection();
        let result: RateLimitResult;
        try {
          await connection.beginTransaction();
          // De unieke sleutel vergrendelt ook een nieuw subject vóór de lees/bewerkstap.
          await connection.execute(`INSERT INTO rate_limits (scope, subject_hash, window_started_at, attempt_count, updated_at)
            VALUES (?, ?, UTC_TIMESTAMP(3), 0, UTC_TIMESTAMP(3))
            ON DUPLICATE KEY UPDATE subject_hash = subject_hash`, [scope, hash]);
          const [rows] = await connection.execute<LockedWindow[]>(`SELECT attempt_count,
            TIMESTAMPDIFF(MICROSECOND, window_started_at, UTC_TIMESTAMP(3)) DIV 1000 AS elapsed_ms
            FROM rate_limits WHERE scope = ? AND subject_hash = ? FOR UPDATE`, [scope, hash]);
          const row = rows[0];
          const elapsedMs = Number(row?.elapsed_ms);
          if (!row || !Number.isSafeInteger(row.attempt_count) || row.attempt_count < 0
            || !Number.isSafeInteger(elapsedMs)) throw new RateLimitUnavailableError();
          const expired = elapsedMs >= windowMs;
          const count = expired ? 0 : row.attempt_count;
          const allowed = count < maximum;
          if (allowed) {
            await connection.execute(expired
              ? `UPDATE rate_limits SET attempt_count = 1, window_started_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3)
                WHERE scope = ? AND subject_hash = ?`
              : `UPDATE rate_limits SET attempt_count = attempt_count + 1, updated_at = UTC_TIMESTAMP(3)
                WHERE scope = ? AND subject_hash = ?`, [scope, hash]);
          }
          const resetAfterMs = expired ? windowMs : Math.max(1, windowMs - Math.max(0, elapsedMs));
          result = { allowed, remaining: Math.max(0, maximum - count - (allowed ? 1 : 0)),
            retryAfterSeconds: Math.ceil(resetAfterMs / 1000), resetAfterMs };
          await connection.commit();
        } catch {
          try { await connection.rollback(); } catch { /* Geen driverdetails of persoonsgegevens doorgeven. */ }
          throw new RateLimitUnavailableError();
        } finally { connection.release(); }
        await cleanup(pool);
        return result;
      } catch { throw new RateLimitUnavailableError(); }
    },

    async reset({ scope, subject }: Pick<RateLimitInput, 'scope' | 'subject'>): Promise<void> {
      try {
        const hash = key(scope, subject);
        await getPool().execute('DELETE FROM rate_limits WHERE scope = ? AND subject_hash = ?', [scope, hash]);
      } catch { throw new RateLimitUnavailableError(); }
    },
  };
}
