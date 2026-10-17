import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateReservation } from '../src/server/reservations/validation.ts';
import { readDatabaseConfig } from '../src/server/db/config.mjs';

const now = new Date('2026-10-17T12:00:00Z');
const valid = {
  name: ' Example Name ', phone: ' +31 (0)6 1234 5678 ', email: ' EXAMPLE@EXAMPLE.COM ',
  reservationDate: '2026-10-20', reservationTime: '13:31', guestCount: 4, message: ' Optional message ',
};

test('normalizes input and accepts arbitrary minutes and international phone notation', () => {
  const result = validateReservation(valid, now);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.name, 'Example Name');
  assert.equal(result.data.phone, '+31 (0)6 1234 5678');
  assert.equal(result.data.email, 'example@example.com');
  assert.equal(result.data.message, 'Optional message');
});

test('email and message are optional and empty strings become null', () => {
  const { email, message, ...required } = valid;
  for (const optional of [{}, { email: ' ', message: ' ' }, { email: null, message: null }]) {
    const result = validateReservation({ ...required, ...optional }, now);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.email, null);
      assert.equal(result.data.message, null);
    }
  }
});

const invalid: [string, unknown, string][] = [
  ['name required', { ...valid, name: ' ' }, 'name'],
  ['name length', { ...valid, name: 'x'.repeat(121) }, 'name'],
  ['phone required', { ...valid, phone: undefined }, 'phone'],
  ['phone length', { ...valid, phone: '1'.repeat(33) }, 'phone'],
  ['phone digits', { ...valid, phone: '+ ()' }, 'phone'],
  ['phone letters', { ...valid, phone: 'abcdef123456' }, 'phone'],
  ['email syntax', { ...valid, email: 'a@@example.com' }, 'email'],
  ['email length', { ...valid, email: `${'a'.repeat(250)}@x.nl` }, 'email'],
  ['message length', { ...valid, message: 'x'.repeat(1001) }, 'message'],
  ['message type', { ...valid, message: {} }, 'message'],
  ['control characters', { ...valid, name: 'Example\u0000Name' }, 'name'],
  ['past date', { ...valid, reservationDate: '2026-10-16' }, 'reservationDate'],
  ['impossible date', { ...valid, reservationDate: '2026-02-30' }, 'reservationDate'],
  ['non leap year', { ...valid, reservationDate: '2027-02-29' }, 'reservationDate'],
  ['invalid date format', { ...valid, reservationDate: '20-10-2026' }, 'reservationDate'],
  ['Monday', { ...valid, reservationDate: '2026-10-19' }, 'reservationDate'],
  ['Sunday', { ...valid, reservationDate: '2026-10-18' }, 'reservationDate'],
  ['before opening', { ...valid, reservationTime: '09:59' }, 'reservationTime'],
  ['at closing', { ...valid, reservationTime: '16:30' }, 'reservationTime'],
  ['after closing', { ...valid, reservationTime: '17:00' }, 'reservationTime'],
  ['invalid time', { ...valid, reservationTime: '12:60' }, 'reservationTime'],
  ['time with seconds', { ...valid, reservationTime: '12:30:00' }, 'reservationTime'],
  ['zero guests', { ...valid, guestCount: 0 }, 'guestCount'],
  ['fractional guests', { ...valid, guestCount: 1.5 }, 'guestCount'],
  ['string guests', { ...valid, guestCount: '4' }, 'guestCount'],
  ['technical guest limit', { ...valid, guestCount: 65536 }, 'guestCount'],
  ['client status', { ...valid, status: 'confirmed' }, '_form'],
  ['client id', { ...valid, id: 123 }, '_form'],
  ['client timestamp', { ...valid, created_at: '2026-10-17' }, '_form'],
  ['client update timestamp', { ...valid, updated_at: '2026-10-17' }, '_form'],
  ['array', [], '_form'], ['null', null, '_form'], ['string', 'reservation', '_form'],
];

for (const [description, input, field] of invalid) {
  test(`rejects ${description} with a field error`, () => {
    const result = validateReservation(input, now);
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.fields[field as keyof typeof result.fields]);
  });
}

test('reports all missing required fields', () => {
  const result = validateReservation({}, now);
  assert.equal(result.success, false);
  if (!result.success) {
    for (const field of ['name', 'phone', 'reservationDate', 'reservationTime', 'guestCount'] as const) {
      assert.ok(result.fields[field]);
    }
  }
});

test('accepts opening time, last minute, technical guest maximum and leap day', () => {
  for (const reservationTime of ['10:00', '16:29']) {
    assert.equal(validateReservation({ ...valid, reservationTime, guestCount: 65535 }, now).success, true);
  }
  assert.equal(validateReservation({ ...valid, reservationDate: '2028-02-29' }, now).success, true);
});

test('allows same-day requests without inventing a lead time or past-time policy', () => {
  assert.equal(validateReservation({ ...valid, reservationDate: '2026-10-17', reservationTime: '10:00' }, now).success, true);
});

test('uses the Amsterdam calendar date at winter and summer midnight boundaries', () => {
  for (const [instant, yesterday, today] of [
    ['2026-10-20T22:30:00Z', '2026-10-20', '2026-10-21'],
    ['2026-12-01T23:30:00Z', '2026-12-01', '2026-12-02'],
    ['2026-10-24T22:30:00Z', '2026-10-24', '2026-10-25'],
  ]) {
    const result = validateReservation({ ...valid, reservationDate: yesterday }, new Date(instant));
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.fields.reservationDate, 'Kies vandaag of een toekomstige datum.');
    if (today !== '2026-10-25') {
      assert.equal(validateReservation({ ...valid, reservationDate: today }, new Date(instant)).success, true);
    }
  }
});

const databaseEnvironment = {
  DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_NAME: 'example', DB_USER: 'example', DB_PASSWORD: 'placeholder',
};

test('database configuration is lazy, required, bounded and never includes values in errors', () => {
  assert.equal(readDatabaseConfig(databaseEnvironment).connectionLimit, 5);
  for (const key of Object.keys(databaseEnvironment)) {
    assert.throws(() => readDatabaseConfig({ ...databaseEnvironment, [key]: undefined }), new RegExp(`Missing ${key}`));
  }
  for (const [key, value] of [['DB_PORT', '0'], ['DB_PORT', '3306x'], ['DB_PORT', '65536'],
    ['DB_CONNECTION_LIMIT', '0'], ['DB_CONNECTION_LIMIT', '101']]) {
    assert.throws(() => readDatabaseConfig({ ...databaseEnvironment, [key]: value }), new RegExp(`Invalid ${key}`));
  }
});
