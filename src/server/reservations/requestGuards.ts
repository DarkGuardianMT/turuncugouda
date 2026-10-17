export function isAllowedReservationOrigin(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  // Clients zonder Origin blijven ondersteund; dit is geen authenticatie of rate limiting.
  return origin === null || origin === new URL(request.url).origin;
}

export function preparePublicReservationInput(input: unknown):
  { blocked: true } | { blocked: false; input: unknown } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { blocked: false, input };
  const { contact_url, ...reservation } = input as Record<string, unknown>;
  if (contact_url !== undefined && contact_url !== '') {
    return { blocked: true };
  }
  return { blocked: false, input: reservation };
}
