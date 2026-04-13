// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import compress from '@playform/compress';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://distilledcs.org',
  integrations: [
    sitemap(),
    compress({
      HTML: {
        "html-minifier-terser": {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          removeEmptyAttributes: true,
          minifyCSS: true,
          minifyJS: true,
        },
      },
      CSS: true,
      JavaScript: true,
      Image: false,
    }),
  ],
  server: process.env.PORT ? { port: parseInt(process.env.PORT, 10) } : undefined,
  vite: {
    plugins: [tailwindcss()]
  }
});