import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanupReservations, parseCleanupArguments, validateCleanupBefore, type CleanupDatabase } from '../src/server/reservations/cleanup.ts';
import { reservationPersonalDetails } from '../src/server/reservations/adminLogic.ts';
import { readMaintenanceDatabaseConfig } from '../src/server/db/maintenanceConfig.mjs';

const now = new Date('2026-10-19T22:30:00Z');

test('cleanup requires an explicit real cutoff and rejects malformed/impossible dates', () => {
  for (const value of ['', '2026-02-30', '2025-02-29', '20-10-2026', '2026-1-01', "2000-01-01' OR 1=1", '0000-01-01']) {
    assert.throws(() => validateCleanupBefore(value, now));
  }
  assert.equal(validateCleanupBefore('2024-02-29', now), '2024-02-29');
  assert.throws(() => parseCleanupArguments([], now), /explicit/);
});

test('cutoff uses Amsterdam midnight, permits today as an exclusive bound and rejects future cutoffs', () => {
  assert.equal(validateCleanupBefore('2026-10-20', now), '2026-10-20');
  assert.throws(() => validateCleanupBefore('2026-10-21', now), /after today/);
  assert.equal(validateCleanupBefore('2026-12-02', new Date('2026-12-01T23:30:00Z')), '2026-12-02');
});

test('CLI defaults to dry-run, requires exact apply flag and rejects duplicate/unknown flags', () => {
  assert.deepEqual(parseCleanupArguments(['--before=2026-10-20'], now), { before: '2026-10-20', apply: false });
  assert.deepEqual(parseCleanupArguments(['--apply', '--before=2026-10-20'], now), { before: '2026-10-20', apply: true });
  for (const args of [['--apply'], ['--before=2026-10-20', '--apply=true'], ['--before=2026-10-20', '--force'],
    ['--before=2026-10-20', '--before=2026-10-19'], ['--before=2026-10-20', '--apply', '--apply']]) {
    assert.throws(() => parseCleanupArguments(args, now));
  }
});

test('dry-run only counts without modifying data and never returns personal records', async () => {
  let calls = 0;
  const db: CleanupDatabase = { async execute(sql, parameters) {
    calls++; assert.ok(sql.startsWith('SELECT COUNT(*)'));
    assert.deepEqual(parameters, ['2026-10-19', '2026-10-20']);
    return [[{ count: '3' }], []];
  } };
  assert.deepEqual(await cleanupReservations(db, { before: '2026-10-19', apply: false }, now), { applied: false, count: 3, before: '2026-10-19' });
  assert.equal(calls, 1);
});

test('apply returns affected count from one parameterized update clearing all personal fields', async () => {
  const db: CleanupDatabase = { async execute(sql, parameters) {
    for (const field of ['name', 'phone', 'email', 'message']) assert.ok(sql.includes(`${field} = NULL`));
    assert.ok(sql.includes('anonymized_at IS NULL') && sql.includes('anonymized_at = CURRENT_TIMESTAMP'));
    assert.ok(!sql.includes('DELETE') && !sql.includes('TRUNCATE'));
    assert.deepEqual(parameters, ['2026-10-20', '2026-10-20']);
    return [{ affectedRows: 2 }, []];
  } };
  assert.deepEqual(await cleanupReservations(db, { before: '2026-10-20', apply: true }, now), { applied: true, count: 2, before: '2026-10-20' });
});

test('invalid service cutoff fails before querying even with apply enabled', async () => {
  const db: CleanupDatabase = { async execute() { assert.fail('No SQL may run'); } };
  await assert.rejects(cleanupReservations(db, { before: '2099-01-01', apply: true }, now));
});

test('anonymized admin details have a neutral label and suppress even accidentally retained personal fields', () => {
  const row = { name: 'Fake Test', phone: '+31600000000', email: 'fake@example.invalid', message: '<script>test</script>', is_anonymized: 1 };
  assert.deepEqual(reservationPersonalDetails(row), { name: 'Geanonimiseerd', phone: null, email: null, message: null });
  assert.deepEqual(reservationPersonalDetails({ ...row, is_anonymized: 0 }), { name: row.name, phone: row.phone, email: row.email, message: row.message });
  assert.deepEqual(reservationPersonalDetails({ name: null, phone: null, email: null, message: null, is_anonymized: 1 }), { name: 'Geanonimiseerd', phone: null, email: null, message: null });
});

test('maintenance configuration never falls back to application credentials', () => {
  const environment = { DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_NAME: 'test', DB_USER: 'app', DB_PASSWORD: 'app-password' };
  assert.throws(() => readMaintenanceDatabaseConfig(environment), /MAINTENANCE_DB_USER/);
  assert.throws(() => readMaintenanceDatabaseConfig({ ...environment, MAINTENANCE_DB_USER: 'maintenance' }), /MAINTENANCE_DB_PASSWORD/);
  const config = readMaintenanceDatabaseConfig({ ...environment, MAINTENANCE_DB_USER: 'maintenance', MAINTENANCE_DB_PASSWORD: 'maintenance-password' });
  assert.equal(config.user, 'maintenance'); assert.equal(config.password, 'maintenance-password');
  assert.equal(readMaintenanceDatabaseConfig({ ...environment, MAINTENANCE_DB_USER: 'maintenance', MAINTENANCE_DB_PASSWORD: '' }).password, '');
  assert.throws(() => readMaintenanceDatabaseConfig({ ...environment, DB_HOST: 'db.example.invalid', MAINTENANCE_DB_USER: 'maintenance', MAINTENANCE_DB_PASSWORD: '' }));
});
