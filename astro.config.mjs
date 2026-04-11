// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://distilledcs.org',
  integrations: [sitemap()],
  server: process.env.PORT ? { port: parseInt(process.env.PORT, 10) } : undefined,
  vite: {
    plugins: [tailwindcss()]
  }
});
