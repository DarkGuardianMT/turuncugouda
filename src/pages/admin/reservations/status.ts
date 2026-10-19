import type { APIRoute } from 'astro';
import { verifyCsrf } from '../../../server/admin/auth';
import { adminError, readAdminForm, redirectAdmin } from '../../../server/admin/http';
import { statusFilter, validReservationId, validTransition } from '../../../server/reservations/adminLogic';
import { updateReservationStatus } from '../../../server/reservations/adminService';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const { adminConfig: config, adminSession: session } = locals;
  if (!config || !session) return redirectAdmin('/admin/login');
  const form = await readAdminForm(request);
  if (!form || !verifyCsrf(form.get('csrf'), session, config)) return adminError(403);
  const id = form.get('id') ?? '';
  const expected = form.get('expected') ?? '';
  const target = form.get('target') ?? '';
  if (!validReservationId(id) || !validTransition(expected, target)) return adminError(400);
  let notice: string;
  try {
    notice = await updateReservationStatus(id, expected, target) ? 'updated' : 'stale';
  } catch {
    console.error('Admin reservation update failed: DATABASE_ERROR');
    notice = 'error';
  }
  return redirectAdmin(`/admin/reservations?status=${statusFilter(form.get('filter'))}&notice=${notice}`);
};

export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'POST' } });
