import { site, visitHours } from '../data/site.ts';

export function canonicalUrl(path: string, origin: string | URL): string {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Canonical paths must be local absolute paths.');
  const url = new URL(path, origin);
  if (url.origin !== new URL(origin).origin) throw new Error('Canonical paths must remain on the configured site.');
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  url.search = ''; url.hash = '';
  return url.href;
}

export function businessStructuredData(origin: string | URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    '@id': `${canonicalUrl('/', origin)}#business`,
    name: site.name,
    url: canonicalUrl('/', origin),
    telephone: site.phoneHref.slice(4),
    address: { '@type': 'PostalAddress', streetAddress: site.address,
      postalCode: site.postalCode, addressLocality: site.city, addressCountry: site.countryCode },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification',
      dayOfWeek: visitHours.days.map((day) => `https://schema.org/${day}`),
      opens: visitHours.opens, closes: visitHours.closes }],
    hasMenu: canonicalUrl('/menu', origin),
    sameAs: [site.instagram.href, site.tiktok.href],
  };
}

export function serializeJsonLd(value: Record<string, unknown>): string {
  // Houd JSON-data binnen het script-element, ook als vertrouwde projecttekst later HTML-tekens bevat.
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
