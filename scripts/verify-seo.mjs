import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { createHash, randomBytes } from 'node:crypto';
import config from '../astro.config.mjs';
import { hashPassword } from '../src/server/admin/password.mjs';
import sharp from 'sharp';
import { tickerProducts } from '../src/data/productTicker.ts';
import { menu } from '../src/data/menu.ts';
import { site, openingHours } from '../src/data/site.ts';

const root = 'dist/client';
const origin = new URL(config.site).origin;
const businessName = 'Turuncu Café en Bakkerij';
const routes = new Map([
  ['/', [`${businessName} | Gouda`, 'index.html']],
  ['/menu', [`Menu | ${businessName}`, 'menu/index.html']],
  ['/galerij', [`Galerij | ${businessName}`, 'galerij/index.html']],
  ['/reserveren', [`Reserveren | ${businessName}`, 'reserveren/index.html']],
  ['/privacy', [`Privacy | ${businessName}`, 'privacy/index.html']],
  ['/404', [`Pagina niet gevonden | ${businessName}`, '404.html']],
]);
const faviconLinks = [
  { rel: 'icon', type: 'image/x-icon', sizes: '16x16 32x32 48x48', href: '/favicon.ico' },
  { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
  { rel: 'apple-touch-icon', type: 'image/png', sizes: '180x180', href: '/apple-touch-icon.png' },
];
const decode = (text) => text.replace(/&(?:amp|quot|#39|#x27|lt|gt);/g, (entity) => ({ '&amp;': '&', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&lt;': '<', '&gt;': '>' })[entity]);
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((match) => [match[1], decode(match[2] ?? match[3])]));
}
const metas = (head) => [...head.matchAll(/<meta\b[^>]*>/g)].map((match) => attributes(match[0]));
function meta(head, name) {
  const matches = metas(head).filter((entry) => entry.name === name || entry.property === name);
  assert.equal(matches.length, 1, `Exactly one ${name}`); return matches[0].content;
}
async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await filesUnder(path)); else files.push(path);
  }
  return files;
}

const htmlByPath = new Map();
const descriptions = new Set();
const imageUrls = new Set();
const scriptsByPath = new Map();
const inlineScripts = new Map();
let imageCount = 0;
for (const [path, [title, file]] of routes) {
  const html = await readFile(`${root}/${file}`, 'utf8'); htmlByPath.set(path, html);
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/)[1];
  const icons = [...head.matchAll(/<link\b[^>]*>/g)].map((match) => attributes(match[0]))
    .filter((entry) => entry.rel === 'icon' || entry.rel === 'apple-touch-icon');
  assert.deepEqual(icons, faviconLinks, `Shared favicon links on ${path}`);
  assert.ok(html.includes('lang="nl"'));
  assert.equal(decode(head.match(/<title>([\s\S]*?)<\/title>/)[1]), title);
  const description = meta(head, 'description'); assert.ok(description.length > 50 && description.length < 200);
  assert.ok(!descriptions.has(description)); descriptions.add(description);
  const canonicals = [...head.matchAll(/<link\b[^>]*>/g)].map((match) => attributes(match[0])).filter((entry) => entry.rel === 'canonical');
  if (path === '/404') { assert.equal(meta(head, 'robots'), 'noindex, follow'); assert.equal(canonicals.length, 0); }
  else { assert.equal(canonicals.length, 1); assert.equal(canonicals[0].href, `${origin}${path}`); assert.equal(meta(head, 'og:url'), canonicals[0].href); }
  assert.equal(meta(head, 'og:type'), 'website'); assert.equal(meta(head, 'og:site_name'), businessName); assert.equal(meta(head, 'og:locale'), 'nl_NL');
  for (const prefix of ['og', 'twitter']) { assert.equal(meta(head, `${prefix}:title`), title); assert.equal(meta(head, `${prefix}:description`), description); }
  assert.equal(meta(head, 'twitter:card'), 'summary_large_image');
  const image = meta(head, 'og:image'); assert.equal(new URL(image).origin, origin); assert.equal(meta(head, 'twitter:image'), image);
  assert.ok(meta(head, 'og:image:alt').includes('Börek')); imageUrls.add(image);
  assert.ok(Number(meta(head, 'og:image:width')) > 0 && Number(meta(head, 'og:image:height')) > 0);
  assert.ok(!metas(head).some((entry) => entry.name === 'twitter:site'));
  assert.ok(!/localhost|127\.0\.0\.1|@fs/.test(head));
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  let level = 0;
  for (const match of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)) {
    if (!match[2].trim()) continue;
    const next = Number(match[1]); assert.ok(next <= level + 1, `Heading hierarchy on ${path}`); level = next;
  }
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].flatMap((match) => {
    const attrs = attributes(match[1]);
    if (attrs.src) return [attrs.src];
    if (attrs.type !== 'module') return [];
    const hash = createHash('sha256').update(match[2]).digest('hex');
    inlineScripts.set(hash, match[2]); return [`inline:${hash}`];
  });
  assert.equal(new Set(scripts).size, scripts.length); scriptsByPath.set(path, scripts);
  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    const image = attributes(match[0]);
    if (!image.src) { assert.ok(image.class?.includes('lightbox-image') || image.class?.includes('menu-viewer-image')); continue; }
    imageCount++; assert.ok('alt' in image && image.alt.length > 0);
    assert.ok(Number(image.width) > 0 && Number(image.height) > 0);
    assert.ok(image.loading === 'lazy' || (path === '/' && image.fetchpriority === 'high' && image.loading === 'eager'));
    assert.ok(new URL(image.src, origin).pathname.startsWith('/_astro/'));
  }
  for (const match of html.matchAll(/(?:src|href)="(\/_astro\/[^"?#]+)"/g)) await stat(`${root}${match[1]}`);
  const jsonLd = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(jsonLd.length, path === '/' ? 1 : 0);
  if (path === '/') {
    const data = JSON.parse(jsonLd[0][1]);
    assert.equal(data['@type'], 'CafeOrCoffeeShop'); assert.equal(data.name, businessName); assert.equal(data.url, `${origin}/`);
    assert.equal(data.telephone, '+31636044912'); assert.equal(data.hasMenu, `${origin}/menu`);
    assert.equal(data.address.streetAddress, 'Lekkenburg 67'); assert.equal(data.address.postalCode, '2804 XB'); assert.equal(data.address.addressLocality, 'Gouda');
    assert.deepEqual(data.openingHoursSpecification[0].dayOfWeek, ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => `https://schema.org/${day}`));
    assert.equal(data.openingHoursSpecification[0].opens, '10:00'); assert.equal(data.openingHoursSpecification[0].closes, '16:30');
  }
}
for (const image of imageUrls) assert.ok((await stat(`${root}${new URL(image).pathname}`)).size > 0);

async function checkIconImage(bytes, size) {
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, size); assert.equal(metadata.height, size);
  assert.equal(metadata.hasAlpha, true, 'Favicon keeps its alpha channel');
  const alpha = await sharp(bytes).extractChannel('alpha').raw().toBuffer();
  for (const corner of [0, size - 1, size * (size - 1), size * size - 1]) {
    assert.equal(alpha[corner], 0, 'Favicon corners remain fully transparent');
  }
  for (let position = 0; position < size; position++) {
    for (const edge of [position, size * (size - 1) + position, position * size, position * size + size - 1]) {
      assert.equal(alpha[edge], 0, 'Favicon keeps a transparent border around the artwork');
    }
  }
  let left = size, top = size, right = -1, bottom = -1, visiblePixels = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Zeer zwakke resamplingranden mogen de zichtbare begrenzing niet kunstmatig vergroten.
      if (alpha[y * size + x] < 16) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      visiblePixels++;
    }
  }
  const width = right - left + 1, height = bottom - top + 1;
  assert.ok(width / size >= 0.8 && width / size <= 0.9, `Visible favicon width: ${width}/${size}`);
  assert.ok(height / size >= 0.8 && height / size <= 0.9, `Visible favicon height: ${height}/${size}`);
  assert.ok(visiblePixels / (size * size) >= 0.15, 'Substantial visible artwork, not just isolated edge pixels');
  return { width, height };
}

for (const icon of faviconLinks) {
  const bytes = await readFile(`${root}${icon.href}`);
  assert.deepEqual(bytes, await readFile(`public${icon.href}`), `Favicon copied unchanged: ${icon.href}`);
  assert.ok(bytes.length > 0 && bytes.length < (icon.rel === 'apple-touch-icon' ? 40_000 : 10_000), 'Optimized icon size');
  if (icon.href.endsWith('.png')) {
    const size = Number(icon.sizes.split('x')[0]);
    const { width, height } = await checkIconImage(bytes, size);
    console.log(`PASS: ${icon.href} visible bounding box ${width}×${height}: ${(width / size * 100).toFixed(1)}% width, ${(height / size * 100).toFixed(1)}% height, ${(width * height / (size * size) * 100).toFixed(1)}% canvas area (alpha >= 16).`);
  } else {
    assert.equal(bytes.readUInt16LE(0), 0); assert.equal(bytes.readUInt16LE(2), 1);
    assert.equal(bytes.readUInt16LE(4), 3);
    for (const [index, size] of [16, 32, 48].entries()) {
      const entry = 6 + index * 16;
      assert.equal(bytes[entry], size); assert.equal(bytes[entry + 1], size);
      const length = bytes.readUInt32LE(entry + 8);
      const offset = bytes.readUInt32LE(entry + 12);
      assert.ok(offset >= 54 && length > 0 && offset + length <= bytes.length);
      await checkIconImage(bytes.subarray(offset, offset + length), size);
    }
  }
}
for (const [path, html] of htmlByPath) {
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)) {
    const href = decode(match[1]); if (!href.startsWith('/') && !href.startsWith('#')) continue;
    const target = new URL(href, `${origin}${path}`); const targetPath = target.pathname.replace(/\/+$/, '') || '/';
    assert.ok(htmlByPath.has(targetPath) && (targetPath !== '/404' || (path === '/404' && href.startsWith('#'))), `Public internal link: ${href}`);
    if (target.hash) assert.ok(htmlByPath.get(targetPath).includes(`id="${decodeURIComponent(target.hash.slice(1))}"`), `Anchor exists: ${href}`);
  }
}
for (const path of ['/404']) assert.deepEqual(scriptsByPath.get(path), scriptsByPath.get('/privacy'));
assert.deepEqual(scriptsByPath.get('/'), scriptsByPath.get('/galerij'), 'Homepage reuses the same gallery lightbox script');
for (const path of ['/', '/menu', '/reserveren']) assert.equal(scriptsByPath.get(path).length, scriptsByPath.get('/privacy').length + 1);

const menuPage = htmlByPath.get('/menu');
assert.match(menuPage, /<h1\b[^>]*>Onze menukaart<\/h1>/);
const visualStart = menuPage.indexOf('class="menu-artwork"');
const textStart = menuPage.indexOf('<details');
assert.ok(visualStart > 0 && textStart > visualStart, 'Visual menu precedes the text disclosure');
const disclosure = menuPage.slice(textStart, menuPage.indexOf('</details>', textStart));
assert.ok(!/^<details[^>]*\bopen\b/.test(disclosure), 'Text menu is collapsed by default');
assert.ok(disclosure.includes('Menukaart als tekst bekijken'));
assert.ok(disclosure.includes('id="menu-categorieen"') && !menuPage.slice(0, visualStart).includes('id="menu-categorieen"'));
const sheetTriggers = [...menuPage.matchAll(/<button\b[^>]*data-menu-sheet="(\d)"[^>]*>/g)];
assert.deepEqual(sheetTriggers.map((entry) => Number(entry[1])), [0, 1]);
for (const [index, match] of sheetTriggers.entries()) {
  const attrs = attributes(match[0]);
  assert.equal(attrs['aria-label'], `Open menukaart ${index + 1}`); assert.equal(attrs['aria-controls'], 'menu-viewer');
  assert.equal(Number(attrs['data-menu-width']), 997); assert.equal(Number(attrs['data-menu-height']), index === 0 ? 1618 : 1616);
  assert.deepEqual(await readFile(`${root}${attrs['data-menu-src']}`), await readFile(`src/assets/menu/menu-web-${index + 1}.webp`), 'Viewer receives the full-resolution website crop, without the flyer header');
}
const artworkPreview = menuPage.slice(visualStart, menuPage.indexOf('<dialog', visualStart));
assert.equal((artworkPreview.match(/<img\b/g) ?? []).length, 2);
assert.ok(!/menu-panel-hint|menu-artwork-help|Vergroten|Deel [1-4]/.test(artworkPreview), 'No visible labels, footer bars or explanatory text');
assert.equal((menuPage.match(/<dialog\b[^>]*id="menu-viewer"/g) ?? []).length, 1);
for (const control of ['close', 'previous', 'next', 'zoom-in', 'zoom-out', 'reset']) assert.ok(menuPage.includes(`data-menu-${control}`));
const textContent = decode(disclosure.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const priceFormat = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
function checkMenuOption(option) {
  assert.ok(textContent.includes(option.name), `Text menu retains ${option.name}`);
  if (option.price != null) assert.ok(textContent.includes(priceFormat.format(option.price).replace(/\s+/g, ' ')), 'Existing price remains available');
}
for (const group of menu) {
  assert.ok(disclosure.includes(`id="${group.id}"`));
  for (const category of group.categories) {
    for (const copy of [category.name, category.description, category.note].filter(Boolean)) assert.ok(textContent.includes(copy));
    for (const item of category.items) {
      checkMenuOption(item);
      if (item.description) assert.ok(textContent.includes(item.description));
      for (const option of [...(item.variants ?? []), ...(item.supplements ?? [])]) checkMenuOption(option);
    }
    for (const option of category.supplements ?? []) checkMenuOption(option);
  }
}

const homepage = htmlByPath.get('/');
const contact = homepage.slice(homepage.indexOf('<section id="contact"'), homepage.indexOf('</main>'));
const labelledSection = (html, id) => html.match(new RegExp(`<section\\b[^>]*aria-labelledby="${id}"[^>]*>([\\s\\S]*?)<\\/section>`))?.[1];
const directContact = labelledSection(contact, 'visit-contact-title');
const booking = labelledSection(contact, 'visit-reservation-title');
const social = labelledSection(contact, 'visit-social-title');
assert.ok(directContact && booking && social, 'Direct contact, booking and social links have separate named sections');
assert.match(directContact, /class="button button-primary whatsapp-action"/);
assert.ok(directContact.includes(`href="${site.whatsappHref}"`) && directContact.includes(site.phone));
assert.ok(!/Instagram|TikTok|Bel ons/i.test(directContact));
assert.ok(booking.includes('href="/reserveren"') && booking.includes(site.reservationMessage));
assert.ok(!/wa\.me|Instagram|TikTok|Bel ons/i.test(booking), 'Form remains the primary booking action');
assert.ok(social.includes('Volg ons') && social.includes(site.instagram.href) && social.includes(site.tiktok.href));
assert.ok(social.includes(site.instagram.handle) && social.includes(site.tiktok.handle));
assert.ok(contact.indexOf(social) > contact.indexOf(directContact), 'Social links follow direct contact');
assert.doesNotMatch(contact, /Bel ons|via Instagram|stuur[^<]*DM/i);
const location = labelledSection(contact, 'visit-location-title');
for (const text of [site.name, site.address, site.postalAddress, site.location]) assert.ok(location.includes(text));
assert.match(location, /<address\b/);
assert.ok(decode(location).includes(`href="${site.directionsHref}"`));
const hours = labelledSection(contact, 'visit-hours-title');
for (const { days, hours: time } of openingHours) assert.ok(hours.includes(days) && hours.includes(time));

const reservationPage = htmlByPath.get('/reserveren');
const reservationContact = labelledSection(reservationPage, 'reservation-contact-title');
assert.ok(reservationContact.includes('Vragen over je reservering?') && reservationContact.includes(`href="${site.whatsappHref}"`));
assert.ok(reservationContact.includes(site.phone) && reservationContact.includes(`href="${site.phoneHref}"`));
assert.doesNotMatch(reservationContact, /Instagram|Bel ons|bellen/i);
const noScript = reservationPage.match(/<noscript>([\s\S]*?)<\/noscript>/)[1];
assert.ok(noScript.includes(`href="${site.whatsappHref}"`) && noScript.includes(site.phone));
assert.doesNotMatch(noScript, /Instagram|bellen/i);
const reservationForm = reservationPage.match(/<form\b([^>]*)>([\s\S]*?)<\/form>/);
assert.equal(attributes(reservationForm[1]).action, '/api/reservations');
assert.equal(attributes(reservationForm[1]).method, 'post');
const formFields = [...reservationForm[2].matchAll(/<(?:input|select|textarea)\b[^>]*>/g)].map(match => attributes(match[0]).name);
assert.deepEqual(formFields, ['reservationDate', 'reservationTime', 'guestCount', 'name', 'phone', 'email', 'message', 'contact_url']);
assert.match(reservationForm[2], /<fieldset\b[^>]*data-form-fields[^>]*disabled/);
assert.match(reservationForm[2], /data-submit/);
console.log('PASS: centralized WhatsApp links, secondary phone, separate social/booking sections, verified visit data, noscript contact and existing reservation form contract.');
assert.match(homepage, /<a\b[^>]*href="#favorieten"[^>]*>Ontdek onze favorieten<\/a>/);
assert.ok(homepage.includes('Café • Bakkerij • Lunch'));
assert.ok(homepage.match(/<header\b[\s\S]*?<\/header>/)[0].includes('Turuncu maakt u blij'));
const favoritesStart = homepage.indexOf('<section id="favorieten"');
const aboutStart = homepage.indexOf('<section id="over-ons"');
assert.ok(favoritesStart > homepage.indexOf('class="hero"') && aboutStart > favoritesStart);
const tickerStart = homepage.indexOf('<section class="product-ticker"');
assert.ok(tickerStart > homepage.indexOf('class="hero"') && tickerStart < favoritesStart, 'Ticker sits between hero and mosaic');
const tickerMarkup = homepage.slice(tickerStart, favoritesStart);
const tickerCopies = [0, 1].map((copy) => tickerMarkup.match(new RegExp(`<div\\b[^>]*data-ticker-copy="${copy}"[^>]*>([\\s\\S]*?)<\\/div>`))?.[1]);
assert.ok(tickerCopies[0]); assert.deepEqual(tickerCopies[1], tickerCopies[0], 'Identical ticker groups support seamless looping');
const renderedProducts = [...tickerCopies[0].matchAll(/<span\b[^>]*class="ticker-item"[^>]*>([^<]+)/g)].map((match) => decode(match[1]));
assert.deepEqual(renderedProducts, [...tickerProducts]);
assert.match(tickerMarkup, /<input\b[^>]*id="ticker-pause"[^>]*type="checkbox"/);
assert.match(tickerMarkup, /<label\b[^>]*for="ticker-pause"/);
assert.match(tickerMarkup, /<div\b[^>]*class="ticker-track"[^>]*aria-hidden="true"/);
assert.ok(!tickerMarkup.includes('<img') && !tickerMarkup.includes('href='), 'Ticker has no images or product links');
const favoritesMarkup = homepage.slice(favoritesStart, aboutStart);
const favoritesGrid = favoritesMarkup.slice(0, favoritesMarkup.indexOf('<dialog'));
assert.match(favoritesGrid, /<h2\b[^>]*class="sr-only"[^>]*>Onze favorieten<\/h2>/);
assert.equal((favoritesGrid.match(/<h[34]\b/g) ?? []).length, 0, 'No visible category or item headings');
assert.equal((favoritesGrid.match(/<figcaption\b/g) ?? []).length, 0, 'No photo captions in the compact grid');
assert.ok(!favoritesGrid.includes('class="gallery-zoom"'), 'No repeated zoom labels over the images');
assert.equal((favoritesGrid.match(/class="gallery-grid /g) ?? []).length, 1, 'One compact nine-photo grid');
const favoriteImages = [...favoritesMarkup.matchAll(/data-gallery-image="([^"]+)"/g)].map((match) => match[1]);
assert.equal(favoriteImages.length, 9); assert.equal(new Set(favoriteImages).size, 9);
assert.equal((favoritesGrid.match(/data-gallery-title="[^"]+"/g) ?? []).length, 9, 'Image titles remain available to the lightbox');
assert.equal((favoritesGrid.match(/data-gallery-description="[^"]+"/g) ?? []).length, 9, 'Descriptions remain available to the lightbox');
assert.equal((homepage.match(/id="gallery-lightbox"/g) ?? []).length, 1);
const homepageIds = [...homepage.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(homepageIds).size, homepageIds.length, 'Unique IDs across favorite grids and shared lightbox');
assert.match(favoritesMarkup, /<a\b[^>]*class="button button-primary"[^>]*href="\/galerij"[^>]*>Ontdek de galerij/);
assert.ok(!favoritesGrid.includes('href="/reserveren"'), 'Gallery preview has no reservation CTA');
assert.ok(!homepage.includes('Een kijkje bij Turuncu') && !homepage.includes('class="highlights-grid"'));
assert.equal((htmlByPath.get('/galerij').match(/data-gallery-image=/g) ?? []).length, 13);
assert.equal((htmlByPath.get('/galerij').match(/<figcaption\b/g) ?? []).length, 13, 'Standalone gallery keeps its captions');
assert.equal((htmlByPath.get('/galerij').match(/class="gallery-zoom"/g) ?? []).length, 13, 'Standalone gallery keeps its zoom labels');

const robots = await readFile(`${root}/robots.txt`, 'utf8');
assert.ok(robots.includes('User-agent: *') && robots.includes('Disallow: /admin/') && robots.includes('Disallow: /api/'));
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap-index.xml`));
const index = await readFile(`${root}/sitemap-index.xml`, 'utf8');
const sitemapUrls = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decode(match[1]));
assert.equal(sitemapUrls.length, 1);
const publicUrls = [];
for (const url of sitemapUrls) {
  assert.equal(new URL(url).origin, origin);
  const xml = await readFile(`${root}${new URL(url).pathname}`, 'utf8');
  publicUrls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decode(match[1])));
  assert.ok(!/<(?:priority|changefreq|lastmod)>/.test(xml));
}
assert.deepEqual(publicUrls.sort(), [...routes.keys()].filter((path) => path !== '/404').map((path) => `${origin}${path}`).sort());
const files = await filesUnder(root);
assert.deepEqual(files.filter((path) => path.endsWith('.html')).sort(), [...routes.values()].map(([, file]) => `${root}/${file}`).sort());
const scripts = files.filter((file) => /\.m?js$/.test(file)); let totalJs = 0;
for (const file of scripts) {
  const size = (await stat(file)).size; assert.ok(size < 100 * 1024, 'Unexpectedly large public JS asset'); totalJs += size;
  assert.ok(!/ADMIN_PASSWORD_HASH|ADMIN_SESSION_SECRET|DB_PASSWORD|SMTP_|RESERVATION_NOTIFICATION_TO/.test(await readFile(file, 'utf8')));
}
for (const content of inlineScripts.values()) {
  assert.ok(!/ADMIN_PASSWORD_HASH|ADMIN_SESSION_SECRET|DB_PASSWORD|SMTP_|RESERVATION_NOTIFICATION_TO/.test(content));
  assert.ok(Buffer.byteLength(content) < 100 * 1024); totalJs += Buffer.byteLength(content);
}
assert.ok(totalJs < 256 * 1024);
let environment = {};
try { environment = parseEnv(await readFile('.env', 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const secrets = ['DB_PASSWORD', 'ADMIN_PASSWORD_HASH', 'ADMIN_SESSION_SECRET', 'MAINTENANCE_DB_PASSWORD', 'SMTP_PASSWORD'].map((key) => environment[key]).filter((value) => value?.length >= 6);
for (const file of await filesUnder('dist')) {
  if (!/\.(html|js|mjs|css|json|xml|txt)$/.test(file)) continue;
  const content = await readFile(file, 'utf8'); for (const secret of secrets) assert.ok(!content.includes(secret), 'Private configuration must not be baked into output');
}
console.log(`PASS: six public HTML outputs, unique metadata/canonicals/social cards, homepage JSON-LD, image assets/alt/dimensions (${imageCount} images), headings and internal links.`);
console.log(`PASS: sitemap-index.xml and its public-only sitemap, robots.txt, noindex 404, no private static HTML or baked secrets; ${scripts.length} public JS files + ${inlineScripts.size} unique inline modules, ${totalJs} bytes total.`);

const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
const port = listener.address().port; await new Promise((resolve) => listener.close(resolve));
const base = `http://localhost:${port}`;

// node:http behoudt een expliciete Host-header, die fetch in Node kan vervangen.
function proxyPost(path, body, headers) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(new URL(path, base), { method: 'POST', headers: {
      'content-type': body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json',
      ...headers,
    } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (value !== undefined) for (const entry of Array.isArray(value) ? value : [value]) responseHeaders.append(name, entry);
        }
        resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: responseHeaders }));
      });
    });
    request.on('error', reject);
    request.end(body.toString());
  });
}

const adminPassword = randomBytes(32).toString('base64url');
const server = spawn(process.execPath, ['./dist/server/entry.mjs'], {
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DB_HOST: '', DB_USER: '', DB_PASSWORD: '',
    ADMIN_USERNAME: 'seo-runtime-test', ADMIN_PASSWORD_HASH: await hashPassword(adminPassword),
    ADMIN_SESSION_SECRET: randomBytes(32).toString('base64url') },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
server.stdout.resume(); server.stderr.resume();
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) break;
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* De lokale runtime start nog. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Built runtime starts without database credentials');
  for (const icon of faviconLinks) {
    const response = await fetch(`${base}${icon.href}`, { redirect: 'manual' });
    assert.equal(response.status, 200, `Production favicon route: ${icon.href}`);
    assert.match(response.headers.get('content-type') ?? '', icon.href.endsWith('.ico')
      ? /^image\/(?:x-icon|vnd\.microsoft\.icon)(?:;|$)/ : /^image\/png(?:;|$)/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(`public${icon.href}`));
  }
  console.log('PASS: shared favicon links on every public page, PNG/ICO transparency, visible artwork coverage, dimensions and size budgets, and all four production icon URLs with matching image responses.');
  for (const path of routes.keys()) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual' });
    assert.equal(response.status, path === '/404' ? 404 : 200);
    const html = await response.text(); assert.ok(html.includes(routes.get(path)[0]));
    assert.equal(response.headers.get('x-robots-tag'), null);
  }
  const missing = await fetch(`${base}/seo-nonexistent-page`);
  assert.equal(missing.status, 404); assert.ok((await missing.text()).includes('Pagina niet gevonden'));
  const slash = await fetch(`${base}/menu/?seo=check`, { redirect: 'manual' });
  assert.equal(slash.status, 200); assert.ok((await slash.text()).includes(`rel="canonical" href="${origin}/menu"`));
  for (const url of [...imageUrls, ...sitemapUrls, `${origin}/robots.txt`, `${origin}/sitemap-index.xml`]) {
    assert.equal((await fetch(`${base}${new URL(url).pathname}`)).status, 200);
  }
  for (const path of ['/admin/login', '/admin/reservations']) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual' });
    assert.equal(response.status, path === '/admin/login' ? 200 : 303);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(response.headers.get('referrer-policy'), 'same-origin');
    const html = await response.text(); assert.ok(!html.includes('rel="canonical"') && !html.includes('property="og:'));
  }
  const api = await fetch(`${base}/api/reservations`); assert.equal(api.status, 405);
  assert.equal(api.headers.get('cache-control'), 'no-store');
  console.log('PASS: built HTTP routes, actual 404 statuses/custom body, slash alias canonical, social image/sitemap/robots assets, private admin headers and API separation.');

  const localApi = await fetch(`${base}/api/reservations`, { method: 'POST', body: '{}',
    headers: { origin: base, 'content-type': 'application/json' } });
  assert.equal(localApi.status, 400);
  assert.equal((await localApi.json()).error.code, 'VALIDATION_ERROR');
  const localLogin = await fetch(`${base}/admin/auth/login`, { method: 'POST', redirect: 'manual',
    headers: { origin: base }, body: new URLSearchParams({ username: 'seo-runtime-test', password: adminPassword }) });
  assert.equal(localLogin.status, 303);
  assert.equal(localLogin.headers.get('location'), '/admin/reservations');

  // Simuleer TLS-beëindiging op de proxy: de lokale verbinding met Node blijft HTTP.
  for (const host of ['turuncugouda.com', 'www.turuncugouda.com']) {
    const externalOrigin = `https://${host}`;
    const headers = { origin: externalOrigin, 'x-forwarded-host': host, 'x-forwarded-proto': 'https' };
    const submit = (path, body, extraHeaders = {}) => proxyPost(path, body, { ...headers, ...extraHeaders });
    for (const proxyHeaders of [headers, { ...headers, 'x-forwarded-port': '443' },
      { ...headers, 'x-forwarded-host': `${host}:443` }, { host, origin: externalOrigin, 'x-forwarded-proto': 'https' }]) {
      const requestHeaders = { ...proxyHeaders, 'content-type': 'application/json' };
      const response = await proxyPost('/api/reservations', '{}', requestHeaders);
      assert.equal(response.status, 400, `Proxy origin accepted for ${host} with ${JSON.stringify(proxyHeaders)}`);
      assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
    }
    const noOrigin = { ...headers }; delete noOrigin.origin;
    assert.equal((await proxyPost('/api/reservations', '{}', noOrigin)).status, 400);
    assert.equal((await proxyPost('/admin/auth/login', new URLSearchParams(), noOrigin)).status, 403);
    for (const incomplete of [{ origin: externalOrigin, 'x-forwarded-host': host },
      { origin: externalOrigin, 'x-forwarded-proto': 'https' }]) {
      assert.equal((await proxyPost('/api/reservations', '{}', incomplete)).status, 403);
      assert.equal((await proxyPost('/admin/auth/login', new URLSearchParams(), incomplete)).status, 403);
    }
    const login = await submit('/admin/auth/login', new URLSearchParams({ username: 'seo-runtime-test', password: adminPassword }));
    assert.equal(login.status, 303, `Native login passes Astro and application Origin checks for ${host}`);
    assert.equal(login.headers.get('location'), '/admin/reservations');
    const setCookie = login.headers.get('set-cookie');
    assert.ok(setCookie && /Secure/i.test(setCookie) && /HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie));
    const cookie = setCookie.split(';')[0];
    const list = await fetch(`${base}/admin/reservations`, { headers: { ...headers, cookie } });
    assert.equal(list.status, 503, 'Authenticated request reaches the missing-DB failure, not a login redirect');
    const csrf = (await list.text()).match(/name="csrf" value="([A-Za-z0-9_-]+)"/)?.[1];
    assert.ok(csrf);
    assert.equal((await submit('/admin/auth/logout', new URLSearchParams(), { cookie })).status, 403);
    assert.equal((await submit('/admin/auth/logout', new URLSearchParams({ csrf }), { cookie })).status, 303);

    const invalidHeaders = [
      { origin: 'https://evil.example' },
      { origin: host.startsWith('www.') ? 'https://turuncugouda.com' : 'https://www.turuncugouda.com' },
      { origin: `http://${host}` },
      { 'sec-fetch-site': 'cross-site' },
      { 'sec-fetch-site': 'same-site' },
      { host, 'x-forwarded-host': 'evil.example' },
      { 'x-forwarded-host': 'evil.example', origin: 'https://evil.example' },
      { 'x-forwarded-host': `${host}, evil.example` },
      { 'x-forwarded-host': `${host}:8443` },
      { 'x-forwarded-proto': 'https, http' },
      { 'x-forwarded-proto': 'http' },
      { 'x-forwarded-port': '8443' },
    ];
    for (const extra of invalidHeaders) {
      assert.equal((await submit('/api/reservations', '{}', { 'content-type': 'application/json', ...extra })).status, 403);
      assert.equal((await submit('/admin/auth/login', new URLSearchParams({ username: 'seo-runtime-test', password: adminPassword }), extra)).status, 403);
    }
    // Ook gefingeerde same-origin metadata omzeilt de expliciete Origin-controle niet.
    for (const path of ['/api/reservations', '/admin/auth/login']) {
      const response = await submit(path, path.startsWith('/api/') ? '{}' : new URLSearchParams(), {
        'content-type': path.startsWith('/api/') ? 'application/json' : 'application/x-www-form-urlencoded',
        origin: 'https://evil.example', 'sec-fetch-site': 'same-origin',
      });
      assert.equal(response.status, 403);
    }
  }
  console.log('PASS: HTTP reverse-proxy simulation accepts both HTTPS domains, native admin login/Secure cookies and CSRF logout; rejects foreign/mismatched Origins and spoofed host/protocol/port headers.');
} finally {
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
}
