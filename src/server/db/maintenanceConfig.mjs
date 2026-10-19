import { DatabaseConfigurationError, readDatabaseConfig } from './config.mjs';

/** @param {Record<string, string | undefined>} environment */
export function readMaintenanceDatabaseConfig(environment) {
  if (!environment.MAINTENANCE_DB_USER?.trim()) throw new DatabaseConfigurationError('Missing MAINTENANCE_DB_USER');
  if (environment.MAINTENANCE_DB_PASSWORD === undefined) throw new DatabaseConfigurationError('Missing MAINTENANCE_DB_PASSWORD');
  // Alleen expliciet ingestelde lokale onderhoudsaccounts mogen een leeg wachtwoord gebruiken.
  const local = ['127.0.0.1', 'localhost', '::1'].includes(environment.DB_HOST?.trim() ?? '');
  return readDatabaseConfig({ ...environment, DB_USER: environment.MAINTENANCE_DB_USER,
    DB_PASSWORD: environment.MAINTENANCE_DB_PASSWORD }, { allowEmptyPassword: local });
}
