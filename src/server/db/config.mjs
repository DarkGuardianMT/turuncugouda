export class DatabaseConfigurationError extends Error {}

/** @param {Record<string, string | undefined>} environment @param {{allowEmptyPassword?: boolean}} [options] */
export function readDatabaseConfig(environment, { allowEmptyPassword = false } = {}) {
  /** @param {string} key */
  function required(key) {
    const value = environment[key];
    if (value === undefined || value.trim() === '') {
      throw new DatabaseConfigurationError(`Missing ${key} environment variable`);
    }
    return value;
  }

  /** @param {string} key @param {number} maximum @param {string} [fallback] */
  function integer(key, maximum, fallback) {
    const value = environment[key] ?? fallback ?? required(key);
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) {
      throw new DatabaseConfigurationError(`Invalid ${key} environment variable`);
    }
    return Number(value);
  }

  return {
    host: required('DB_HOST').trim(),
    port: integer('DB_PORT', 65535),
    database: required('DB_NAME').trim(),
    user: required('DB_USER').trim(),
    password: allowEmptyPassword && environment.DB_PASSWORD === '' ? '' : required('DB_PASSWORD'),
    connectionLimit: integer('DB_CONNECTION_LIMIT', 100, '5'),
    charset: 'utf8mb4',
    connectTimeout: 10000,
    supportBigNumbers: true,
    bigNumberStrings: true,
    multipleStatements: false,
  };
}
