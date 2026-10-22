import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import { canonicalUrl } from './src/lib/seo.ts';
import { productionHosts } from './src/server/http/origin.ts';

const site = 'https://www.turuncugouda.com';
const publicPaths = new Set(['/', '/menu', '/galerij', '/reserveren', '/privacy']);

export default defineConfig({
  site,
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  security: {
    checkOrigin: true,
    allowedDomains: productionHosts.map((hostname) => ({ hostname, protocol: 'https' })),
  },
  integrations: [sitemap({
    filter: (page) => publicPaths.has(new URL(canonicalUrl(new URL(page).pathname, site)).pathname),
    serialize: (item) => ({ ...item, url: canonicalUrl(new URL(item.url).pathname, site) }),
  })],
});
