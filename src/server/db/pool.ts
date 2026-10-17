import { getSecret } from 'astro:env/server';
import { createPool, type Pool } from 'mysql2/promise';
import { readDatabaseConfig } from './config.mjs';

let pool: Pool | undefined;

export function getDatabasePool(): Pool {
  if (!pool) {
    const config = readDatabaseConfig({
      DB_HOST: getSecret('DB_HOST'),
      DB_PORT: getSecret('DB_PORT'),
      DB_NAME: getSecret('DB_NAME'),
      DB_USER: getSecret('DB_USER'),
      DB_PASSWORD: getSecret('DB_PASSWORD'),
      DB_CONNECTION_LIMIT: getSecret('DB_CONNECTION_LIMIT'),
    });
    pool = createPool({ ...config, waitForConnections: true, queueLimit: 20 });
  }
  return pool;
}
