import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { createHash, randomBytes } from 'node:crypto';
import config from '../astro.config.mjs';
import { hashPassword } from '../src/server/admin/password.mjs';

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
    if (!image.src) { assert.ok(image.class?.includes('lightbox-image')); continue; }
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
for (const [path, html] of htmlByPath) {
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)) {
    const href = decode(match[1]); if (!href.startsWith('/') && !href.startsWith('#')) continue;
    const target = new URL(href, `${origin}${path}`); const targetPath = target.pathname.replace(/\/+$/, '') || '/';
    assert.ok(htmlByPath.has(targetPath) && (targetPath !== '/404' || (path === '/404' && href.startsWith('#'))), `Public internal link: ${href}`);
    if (target.hash) assert.ok(htmlByPath.get(targetPath).includes(`id="${decodeURIComponent(target.hash.slice(1))}"`), `Anchor exists: ${href}`);
  }
}
for (const path of ['/menu', '/privacy', '/404']) assert.deepEqual(scriptsByPath.get(path), scriptsByPath.get('/'));
assert.equal(scriptsByPath.get('/galerij').length, scriptsByPath.get('/').length + 1);
assert.equal(scriptsByPath.get('/reserveren').length, scriptsByPath.get('/').length + 1);

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
  assert.ok(!/ADMIN_PASSWORD_HASH|ADMIN_SESSION_SECRET|DB_PASSWORD/.test(await readFile(file, 'utf8')));
}
for (const content of inlineScripts.values()) {
  assert.ok(!/ADMIN_PASSWORD_HASH|ADMIN_SESSION_SECRET|DB_PASSWORD/.test(content));
  assert.ok(Buffer.byteLength(content) < 100 * 1024); totalJs += Buffer.byteLength(content);
}
assert.ok(totalJs < 256 * 1024);
let environment = {};
try { environment = parseEnv(await readFile('.env', 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const secrets = ['DB_PASSWORD', 'ADMIN_PASSWORD_HASH', 'ADMIN_SESSION_SECRET', 'MAINTENANCE_DB_PASSWORD'].map((key) => environment[key]).filter((value) => value?.length >= 6);
for (const file of await filesUnder('dist')) {
  if (!/\.(html|js|mjs|css|json|xml|txt)$/.test(file)) continue;
  const content = await readFile(file, 'utf8'); for (const secret of secrets) assert.ok(!content.includes(secret), 'Private configuration must not be baked into output');
}
console.log(`PASS: six public HTML outputs, unique metadata/canonicals/social cards, homepage JSON-LD, image assets/alt/dimensions (${imageCount} images), headings and internal links.`);
console.log(`PASS: sitemap-index.xml and its public-only sitemap, robots.txt, noindex 404, no private static HTML or baked secrets; ${scripts.length} public JS files + ${inlineScripts.size} unique inline modules, ${totalJs} bytes total.`);

const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
const port = listener.address().port; await new Promise((resolve) => listener.close(resolve));
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ['./dist/server/entry.mjs'], {
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DB_HOST: '', DB_USER: '', DB_PASSWORD: '',
    ADMIN_USERNAME: 'seo-runtime-test', ADMIN_PASSWORD_HASH: await hashPassword(randomBytes(32).toString('base64url')),
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
} finally {
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
}
