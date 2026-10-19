export function isAllowedOrigin(request: Request, requireOrigin = false): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  return origin === null ? !requireOrigin : origin === new URL(request.url).origin;
}
