import { isAllowedOrigin } from '../http/origin.ts';

export function applyAdminSecurityHeaders(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  // Behoud de Origin bij eigen formulier-POSTs, zonder verwijzers naar andere websites te sturen.
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
  return response;
}

export function adminError(status: number): Response {
  return new Response('De aanvraag kon niet worden verwerkt. Probeer het opnieuw.', { status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export function redirectAdmin(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } });
}

export async function readAdminForm(request: Request): Promise<URLSearchParams | null> {
  if (!isAllowedOrigin(request, true)
    || request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/x-www-form-urlencoded') return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const form = new URLSearchParams(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    for (const key of form.keys()) if (form.getAll(key).length !== 1) return null;
    return form;
  } catch { return null; }
  finally { reader.releaseLock(); }
}
