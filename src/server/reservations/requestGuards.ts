export { isAllowedOrigin as isAllowedReservationOrigin } from '../http/origin.ts';

export function preparePublicReservationInput(input: unknown):
  { blocked: true } | { blocked: false; input: unknown } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { blocked: false, input };
  const { contact_url, ...reservation } = input as Record<string, unknown>;
  if (contact_url !== undefined && contact_url !== '') {
    return { blocked: true };
  }
  return { blocked: false, input: reservation };
}
