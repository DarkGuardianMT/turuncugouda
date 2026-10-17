import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { DatabaseConfigurationError, readDatabaseConfig } from '../src/server/db/config.mjs';

async function migrate() {
  const config = readDatabaseConfig(process.env);
  const { connectionLimit, ...connectionConfig } = config;
  const connection = await createConnection(connectionConfig);
  const lockName = `turuncu_migrate_${createHash('sha256').update(config.database).digest('hex').slice(0, 40)}`;
  let locked = false;
  try {
    const [locks] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (locks[0].acquired !== 1) throw new Error('Migration lock unavailable');
    locked = true;
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) NOT NULL PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const directory = new URL('../db/migrations/', import.meta.url);
    const filenames = (await readdir(directory)).filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    for (const filename of filenames) {
      const sql = await readFile(new URL(filename, directory), 'utf8');
      const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
      const [applied] = await connection.execute('SELECT checksum FROM schema_migrations WHERE filename = ?', [filename]);
      if (applied.length) {
        if (applied[0].checksum !== checksum) throw new Error(`Applied migration changed: ${filename}`);
        console.info(`Already applied: ${filename}`);
        continue;
      }
      console.info(`Applying: ${filename}`);
      // MySQL-DDL commit impliciet; voer per bestand één statement uit en registreer pas na succes.
      await connection.query(sql);
      await connection.execute('INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)', [filename, checksum]);
      console.info(`Applied: ${filename}`);
    }
    console.info('Migrations complete.');
  } finally {
    try {
      if (locked) await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
    } finally {
      await connection.end();
    }
  }
}

migrate().catch((cause) => {
  const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
  const safeMessage = cause instanceof DatabaseConfigurationError
    || (cause instanceof Error && /^(Applied migration changed: \d+_[a-z0-9_]+\.sql|Migration lock unavailable)$/.test(cause.message));
  console.error('Migration failed:', safeMessage ? cause.message
    : /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'INTERNAL_ERROR');
  console.error('Check configuration, database availability and the last migration shown; no reset is performed.');
  process.exitCode = 1;
});
