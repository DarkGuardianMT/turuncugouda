import type { Pool } from 'mysql2/promise';

// Deterministische driverstub voor foutpaden/tijdgrenzen; echte concurrentie wordt apart op MariaDB getest.
export function createRateLimitTestDatabase() {
  const rows = new Map<string, { count: number; started: number; updated: number }>();
  const statements: { sql: string; parameters: unknown[] }[] = [];
  const state = { now: 1_000_000, begins: 0, commits: 0, rollbacks: 0, releases: 0,
    fail: '', rows, statements };
  async function execute(sql: string, parameters: unknown[] = []) {
    statements.push({ sql, parameters });
    if (state.fail && sql.includes(state.fail)) throw new Error('private-driver-detail');
    const key = parameters.join(':');
    if (sql.includes('INSERT INTO rate_limits')) {
      if (!rows.has(key)) rows.set(key, { count: 0, started: state.now, updated: state.now });
    } else if (sql.includes('FOR UPDATE')) {
      const row = rows.get(key)!;
      return [[{ attempt_count: row.count, elapsed_ms: state.now - row.started }], []];
    } else if (sql.includes('UPDATE rate_limits')) {
      const row = rows.get(key)!;
      if (sql.includes('attempt_count = 1,')) { row.count = 1; row.started = state.now; }
      else row.count++;
      row.updated = state.now;
    } else if (sql.includes('DELETE FROM rate_limits WHERE scope')) rows.delete(key);
    else if (sql.includes('DELETE FROM rate_limits')) {
      let removed = 0;
      for (const [key, row] of rows) if (row.updated < state.now - 3_600_000 && removed++ < 100) rows.delete(key);
    }
    return [{ affectedRows: 1 }, []];
  }
  const connection = { execute,
    async beginTransaction() { state.begins++; },
    async commit() { if (state.fail === 'COMMIT') throw new Error('private-commit-detail'); state.commits++; },
    async rollback() { state.rollbacks++; },
    release() { state.releases++; },
  };
  const pool = { execute, async getConnection() {
    if (state.fail === 'CONNECT') throw new Error('private-connection-detail');
    return connection;
  } } as unknown as Pool;
  return { pool, state };
}
