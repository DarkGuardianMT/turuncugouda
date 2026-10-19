import assert from 'node:assert/strict';
import { test } from 'node:test';
import config from '../astro.config.mjs';
import { businessStructuredData, canonicalUrl, serializeJsonLd } from '../src/lib/seo.ts';

test('Astro config uses the approved HTTPS production origin and static public rendering', () => {
  assert.equal(config.site, 'https://www.turuncugouda.com');
  assert.equal(config.output, 'static');
});

test('canonical URLs normalize trailing slashes and omit queries/fragments', () => {
  assert.equal(canonicalUrl('/', config.site!), `${config.site}/`);
  for (const path of ['/menu', '/menu/', '/menu///', '/menu/?status=pending#heading']) {
    assert.equal(canonicalUrl(path, config.site!), `${config.site}/menu`);
  }
});

test('canonical URLs follow the configured origin without a hardcoded fallback', () => {
  assert.equal(canonicalUrl('/privacy', 'https://turuncugouda.com'), 'https://turuncugouda.com/privacy');
  assert.equal(businessStructuredData('https://turuncugouda.com').hasMenu, 'https://turuncugouda.com/menu');
});

test('canonical paths cannot switch origins', () => {
  for (const path of ['https://example.com/', '//example.com/', '/\\example.com/', 'menu']) {
    assert.throws(() => canonicalUrl(path, config.site!));
  }
});

test('business structured data contains only the verified business contact facts and opening days', () => {
  const data = businessStructuredData(config.site!);
  assert.equal(data['@type'], 'CafeOrCoffeeShop');
  assert.equal(data.name, 'Turuncu Café en Bakkerij');
  assert.equal(data.telephone, '+31636044912');
  assert.deepEqual(data.address, { '@type': 'PostalAddress', streetAddress: 'Lekkenburg 67',
    postalCode: '2804 XB', addressLocality: 'Gouda', addressCountry: 'NL' });
  assert.deepEqual(data.sameAs, ['https://www.instagram.com/turuncugouda.nl/', 'https://www.tiktok.com/@turuncugouda']);
  assert.deepEqual(data.openingHoursSpecification, [{ '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => `https://schema.org/${day}`), opens: '10:00', closes: '16:30' }]);
  for (const key of ['aggregateRating', 'reviewRating', 'priceRange', 'geo', 'email', 'founder', 'paymentAccepted']) {
    assert.ok(!(key in data));
  }
});

test('JSON-LD serialization prevents script termination and round-trips project text', () => {
  const value = { name: '</script><script>alert("test")</script>', text: 'a\u2028b\u2029c' };
  const serialized = serializeJsonLd(value);
  assert.ok(!serialized.includes('<') && !serialized.includes('\u2028') && !serialized.includes('\u2029'));
  assert.deepEqual(JSON.parse(serialized), value);
});
