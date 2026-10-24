import type { APIRoute } from 'astro';
import { authenticate, cookieOptions, createSession, sessionCookie } from '../../../server/admin/auth';
import { adminError, readAdminForm, redirectAdmin } from '../../../server/admin/http';
import { consumeRateLimit, resetRateLimit } from '../../../server/rateLimit/service';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { request, locals, cookies } = context;
  const form = await readAdminForm(request);
  if (!form) return adminError(403);
  let clientAddress: string;
  try {
    clientAddress = context.clientAddress;
    const limit = await consumeRateLimit({ scope: 'admin_login', subject: clientAddress });
    if (!limit.allowed) return redirectAdmin('/admin/login?notice=limited');
  } catch {
    console.error('Admin login rate limit failed:', 'RATE_LIMIT_UNAVAILABLE');
    return adminError(503);
  }
  const username = form.get('username') ?? '';
  const password = form.get('password') ?? '';
  const config = locals.adminConfig;
  if (!config) return adminError(503);
  if (username.length > 120 || !await authenticate(username, password, config)) {
    return redirectAdmin('/admin/login?notice=invalid');
  }
  try {
    await resetRateLimit({ scope: 'admin_login', subject: clientAddress });
  } catch {
    console.error('Admin login rate limit reset failed:', 'RATE_LIMIT_UNAVAILABLE');
    return adminError(503);
  }
  cookies.set(sessionCookie, createSession(config), cookieOptions(request, import.meta.env.PROD));
  return redirectAdmin('/admin/reservations');
};

export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'POST' } });
