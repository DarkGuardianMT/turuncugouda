import type { APIRoute } from 'astro';
import { authenticate, cookieOptions, createSession, sessionCookie } from '../../../server/admin/auth';
import { adminError, readAdminForm, redirectAdmin } from '../../../server/admin/http';
import { loginLimiter } from '../../../server/admin/loginLimiter';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, cookies, clientAddress }) => {
  const form = await readAdminForm(request);
  if (!form) return adminError(403);
  if (!loginLimiter.consume(clientAddress)) return redirectAdmin('/admin/login?notice=limited');
  const username = form.get('username') ?? '';
  const password = form.get('password') ?? '';
  const config = locals.adminConfig;
  if (!config) return adminError(503);
  if (username.length > 120 || !await authenticate(username, password, config)) {
    return redirectAdmin('/admin/login?notice=invalid');
  }
  loginLimiter.reset(clientAddress);
  cookies.set(sessionCookie, createSession(config), cookieOptions(request, import.meta.env.PROD));
  return redirectAdmin('/admin/reservations');
};

export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'POST' } });
