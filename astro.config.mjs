import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://www.turuncugouda.com',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
});
