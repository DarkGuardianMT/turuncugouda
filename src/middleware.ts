import { defineMiddleware } from 'astro:middleware';
import { AdminConfigurationError, sessionCookie, verifySession } from './server/admin/auth';
import { getAdminConfig } from './server/admin/config';
import { adminError, redirectAdmin } from './server/admin/http';

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname !== '/admin' && !context.url.pathname.startsWith('/admin/')) return next();
  let response: Response;
  try {
    const config = getAdminConfig();
    const session = verifySession(context.cookies.get(sessionCookie)?.value, config);
    context.locals.adminConfig = config;
    if (session) context.locals.adminSession = session;
    const path = context.url.pathname.replace(/\/$/, '');
    const publicRoute = path === '/admin/login' || path === '/admin/auth/login';
    response = !session && !publicRoute ? redirectAdmin('/admin/login') : await next();
  } catch (cause) {
    console.error('Admin request failed:', cause instanceof AdminConfigurationError ? cause.message : 'INTERNAL_ERROR');
    response = adminError(503);
  }
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
  return response;
});
