import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Canonical production URL. Cloudflare Pages builds use this for sitemap + RSS absolute URLs.
export default defineConfig({
  site: 'https://brisbanetvs.com',
  integrations: [sitemap()],
  build: {
    format: 'directory'
  }
});
