export const productionHosts = ['turuncugouda.com', 'www.turuncugouda.com'] as const;
const productionOrigins = new Set(productionHosts.map((host) => `https://${host}`));
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isAllowedOrigin(request: Request, requireOrigin = false): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;

  // Astro herstelt de externe URL met allowedDomains vóór zijn CSRF-controle en onze routes.
  const url = new URL(request.url);
  const production = productionOrigins.has(url.origin);
  if (!production && !localHosts.has(url.hostname)) return false;

  // Weiger ongeldige proxyheaders ook wanneer Astro ze negeert; vertrouw geen headerketens.
  const host = request.headers.get('x-forwarded-host');
  const protocol = request.headers.get('x-forwarded-proto');
  const port = request.headers.get('x-forwarded-port');
  if (host !== null && !productionHosts.some((value) => host === value || host === `${value}:443`)) return false;
  if (protocol !== null && protocol !== 'https') return false;
  if (port !== null && port !== '443') return false;
  if (host !== null || protocol !== null || port !== null) {
    if (!production || (host !== null && new URL(`https://${host}`).origin !== url.origin)) return false;
  }

  const origin = request.headers.get('origin');
  return origin === null ? !requireOrigin : origin === url.origin;
}
