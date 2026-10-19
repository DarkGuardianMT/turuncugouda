import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
// Dubbele punten voorkomen dat Astro/Vite delen van de hash als omgevingsvariabelen uitbreidt.
const prefix = 'scrypt:32768:8:1:';

/** @param {string} encoded */
export function isPasswordHash(encoded) {
  return /^scrypt:32768:8:1:[a-f0-9]{64}:[a-f0-9]{128}$/.test(encoded);
}

/** @param {string} password @param {string} salt */
async function passwordKey(password, salt) {
  return /** @type {Buffer} */ (await derive(password, Buffer.from(salt, 'hex'), 64,
    { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }));
}

/** @param {string} password */
export async function hashPassword(password) {
  if (password.length < 12 || Buffer.byteLength(password) > 1024) {
    throw new Error('Use at least 12 characters and at most 1024 UTF-8 bytes.');
  }
  const salt = randomBytes(32).toString('hex');
  return `${prefix}${salt}:${(await passwordKey(password, salt)).toString('hex')}`;
}

/** @param {string} password @param {string} encoded */
export async function verifyPassword(password, encoded) {
  if (!isPasswordHash(encoded) || Buffer.byteLength(password) > 1024) return false;
  const [, , , , salt, expected] = encoded.split(':');
  return timingSafeEqual(await passwordKey(password, salt), Buffer.from(expected, 'hex'));
}
