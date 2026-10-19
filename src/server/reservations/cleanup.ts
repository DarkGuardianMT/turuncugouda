import { todayInAmsterdam } from '../../lib/reservationDate.ts';

export class CleanupInputError extends Error {}
export interface CleanupOptions { before: string; apply: boolean }
export interface CleanupDatabase {
  execute(sql: string, parameters: string[]): Promise<[unknown, unknown]>;
}

export function validateCleanupBefore(value: string, now = new Date()): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== value) {
    throw new CleanupInputError('Use a real cutoff date: --before=YYYY-MM-DD.');
  }
  if (value > todayInAmsterdam(now)) throw new CleanupInputError('The cutoff cannot be after today in Europe/Amsterdam.');
  return value;
}

export function parseCleanupArguments(args: string[], now = new Date()): CleanupOptions {
  let before: string | undefined;
  let apply = false;
  for (const arg of args) {
    if (arg.startsWith('--before=') && before === undefined) before = arg.slice('--before='.length);
    else if (arg === '--apply' && !apply) apply = true;
    else throw new CleanupInputError('Unknown or duplicate argument. Use --before=YYYY-MM-DD [--apply].');
  }
  if (before === undefined) throw new CleanupInputError('An explicit --before=YYYY-MM-DD cutoff is required. Default: dry-run.');
  return { before: validateCleanupBefore(before, now), apply };
}

export async function cleanupReservations(db: CleanupDatabase, options: CleanupOptions, now = new Date()) {
  const before = validateCleanupBefore(options.before, now);
  if (typeof options.apply !== 'boolean') throw new CleanupInputError('Apply must be explicitly true or false.');
  // De tweede datumgrens beschermt vandaag/toekomst ook in de SQL; reeds verwerkte rijen blijven onaangeroerd.
  const where = 'reservation_date < ? AND reservation_date < ? AND anonymized_at IS NULL';
  const parameters = [before, todayInAmsterdam(now)];
  if (!options.apply) {
    const [rows] = await db.execute(`SELECT COUNT(*) AS count FROM reservations WHERE ${where}`, parameters);
    return { applied: false, count: Number((rows as { count: number | string }[])[0].count), before };
  }
  const [result] = await db.execute(
    `UPDATE reservations SET name = NULL, phone = NULL, email = NULL, message = NULL,
      anonymized_at = CURRENT_TIMESTAMP WHERE ${where}`, parameters,
  );
  return { applied: true, count: (result as { affectedRows: number }).affectedRows, before };
}
