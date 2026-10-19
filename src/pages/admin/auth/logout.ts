import type { APIRoute } from 'astro';
import { cookieOptions, sessionCookie, verifyCsrf } from '../../../server/admin/auth';
import { adminError, readAdminForm, redirectAdmin } from '../../../server/admin/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const form = await readAdminForm(request);
  const { adminConfig: config, adminSession: session } = locals;
  if (!session || !config) return redirectAdmin('/admin/login');
  if (!form || !verifyCsrf(form.get('csrf'), session, config)) return adminError(403);
  cookies.delete(sessionCookie, cookieOptions(request, import.meta.env.PROD));
  return redirectAdmin('/admin/login');
};

export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'POST' } });
