import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isPasswordHash, verifyPassword } from './password.mjs';

export const sessionCookie = 'turuncu_admin';
export const sessionLifetime = 10 * 60 * 60;
export interface AdminConfig { username: string; passwordHash: string; sessionSecret: string }
export interface AdminSession { sub: string; iat: number; exp: number; nonce: string }
export class AdminConfigurationError extends Error {}

export function readAdminConfig(env: Record<string, string | undefined>): AdminConfig {
  const username = env.ADMIN_USERNAME?.trim();
  if (!username || username.length > 120 || /[\x00-\x1f\x7f]/.test(username)) {
    throw new AdminConfigurationError('Missing or invalid ADMIN_USERNAME');
  }
  if (!env.ADMIN_PASSWORD_HASH || !isPasswordHash(env.ADMIN_PASSWORD_HASH)) {
    throw new AdminConfigurationError('Missing or invalid ADMIN_PASSWORD_HASH');
  }
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret || !/^[A-Za-z0-9_-]{43,128}$/.test(secret) || Buffer.from(secret, 'base64url').length < 32) {
    throw new AdminConfigurationError('Missing or invalid ADMIN_SESSION_SECRET (use random base64url, at least 32 bytes)');
  }
  return { username, passwordHash: env.ADMIN_PASSWORD_HASH, sessionSecret: secret };
}

function equalText(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

export async function authenticate(username: string, password: string, config: AdminConfig): Promise<boolean> {
  // Ook bij een onbekende gebruikersnaam wordt de wachtwoordafleiding uitgevoerd.
  const passwordMatches = await verifyPassword(password, config.passwordHash);
  return equalText(username.trim(), config.username) && passwordMatches;
}

function signature(value: string, config: AdminConfig, purpose: string): string {
  // Een gewijzigd wachtwoord maakt eerder uitgegeven sessies ongeldig.
  return createHmac('sha256', config.sessionSecret).update(`${purpose}\0${config.passwordHash}\0${value}`).digest('base64url');
}

export function createSession(config: AdminConfig, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const payload: AdminSession = { sub: config.username, iat, exp: iat + sessionLifetime, nonce: randomBytes(32).toString('base64url') };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded, config, 'session')}`;
}

export function verifySession(cookie: string | undefined, config: AdminConfig, now = Date.now()): AdminSession | null {
  if (!cookie || cookie.length > 2048) return null;
  const pieces = cookie.split('.');
  if (pieces.length !== 2) return null;
  const [encoded, mac] = pieces;
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]{43}$/.test(mac)
    || !equalText(mac, signature(encoded, config, 'session'))) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object') return null;
    const session = value as AdminSession;
    const seconds = Math.floor(now / 1000);
    if (session.sub !== config.username || !Number.isSafeInteger(session.iat) || !Number.isSafeInteger(session.exp)
      || session.iat > seconds || session.exp <= seconds || session.exp - session.iat !== sessionLifetime
      || typeof session.nonce !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(session.nonce)) return null;
    return session;
  } catch { return null; }
}

export function csrfToken(session: AdminSession, config: AdminConfig): string {
  return signature(`${session.nonce}.${session.exp}`, config, 'csrf');
}

export function verifyCsrf(token: unknown, session: AdminSession, config: AdminConfig): boolean {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token) && equalText(token, csrfToken(session, config));
}

export function cookieOptions(request: Request, production: boolean) {
  return { httpOnly: true, sameSite: 'strict' as const, secure: production || new URL(request.url).protocol === 'https:',
    path: '/admin', maxAge: sessionLifetime };
}
