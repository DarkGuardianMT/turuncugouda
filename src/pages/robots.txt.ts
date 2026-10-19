import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('Missing canonical site configuration.');
  return new Response(`User-agent: *\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${new URL('/sitemap-index.xml', site).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
