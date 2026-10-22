import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import type { AdminReservation } from '../src/server/reservations/adminService.ts';

// Laad de echte service via Vite, maar vervang uitsluitend de server-only databasepool.
const poolId = '\0admin-service-test-pool';
const server = await createServer({
  configFile: false, envDir: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null },
  plugins: [{
    name: 'admin-service-test-pool',
    enforce: 'pre',
    resolveId(source) { if (source === '../db/pool') return poolId; },
    load(id) {
      if (id === poolId) return `
        export const pool = { async execute() { throw new Error('Database stub not configured'); } };
        export function getDatabasePool() { return pool; }
      `;
    },
  }],
});
after(() => server.close());
const { pool } = await server.ssrLoadModule(poolId) as {
  pool: { execute(sql: string, parameters: string[]): Promise<[AdminReservation[], unknown]> };
};
const { listReservations } = await server.ssrLoadModule('/src/server/reservations/adminService.ts') as
  typeof import('../src/server/reservations/adminService.ts');

const now = new Date('2026-10-20T22:30:00Z');
const today = '2026-10-21';
const rows = [{ id: '42', name: null, phone: null, email: null, message: null,
  reservation_date: today, reservation_time: '13:30', guest_count: 2,
  status: 'pending', created_at: 1792497600, is_anonymized: 1 }] as AdminReservation[];

for (const status of ['all', 'pending', 'confirmed', 'cancelled'] as const) {
  test(`listReservations executes the fixed ${status} query with bound parameters`, async (context) => {
    const execute = context.mock.method(pool, 'execute', async () => [rows, []] as [AdminReservation[], unknown]);
    assert.equal(await listReservations(status, now), rows);
    assert.equal(execute.mock.callCount(), 1);
    const [sql, parameters] = execute.mock.calls[0].arguments;
    assert.ok(typeof sql === 'string');
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const [projection, remainder] = normalized.split(' WHERE ');
    assert.ok(projection.startsWith('SELECT CAST(id AS CHAR) AS id, name, phone, email, message,'));
    assert.ok(projection.endsWith('FROM reservations'));
    assert.equal(remainder, `${status === 'all' ? 'reservation_date >= ?' : 'reservation_date >= ? AND status = ?'} `
      + 'ORDER BY reservation_date ASC, reservation_time ASC, created_at ASC, id ASC');
    assert.deepEqual(parameters, status === 'all' ? [today] : [today, status]);
    assert.equal((sql.match(/\?/g) ?? []).length, parameters.length);
    assert.ok(!sql.includes(today) && !/\bOR\b|\?\s*=\s*'all'/.test(sql));
    for (const value of ['pending', 'confirmed', 'cancelled']) assert.ok(!sql.includes(`'${value}'`));
  });
}

test('listReservations propagates database failure to the existing safe response handler', async (context) => {
  const failure = new Error('Synthetic database failure');
  context.mock.method(pool, 'execute', async () => { throw failure; });
  await assert.rejects(listReservations('all', now), (error) => error === failure);
});
