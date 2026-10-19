import { createConnection } from 'mysql2/promise';
import { DatabaseConfigurationError } from '../src/server/db/config.mjs';
import { readMaintenanceDatabaseConfig } from '../src/server/db/maintenanceConfig.mjs';
import { CleanupInputError, cleanupReservations, parseCleanupArguments } from '../src/server/reservations/cleanup.ts';

let connection;
try {
  const options = parseCleanupArguments(process.argv.slice(2));
  connection = await createConnection(readMaintenanceDatabaseConfig(process.env));
  const result = await cleanupReservations(connection, options);
  console.log(`${result.applied ? 'Applied' : 'DRY RUN (no changes)'}: ${result.count} reservation(s) ${result.applied ? 'anonymized' : 'eligible'} before ${result.before}.`);
} catch (cause) {
  const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
  console.error('Reservation cleanup failed:', cause instanceof CleanupInputError || cause instanceof DatabaseConfigurationError
    ? cause.message : /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'INTERNAL_ERROR');
  process.exitCode = 1;
} finally { await connection?.end(); }
