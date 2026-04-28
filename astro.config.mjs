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
    sitemap({
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/cs-maturity-report') &&
        !page.includes('/404'),
      serialize(item) {
        const url = item.url;
        // Homepage + four pillar indexes: highest priority, weekly updates.
        if (
          url === 'https://distilledcs.org/' ||
          url === 'https://distilledcs.org/customer-success-principles/' ||
          url === 'https://distilledcs.org/customer-success-metrics/' ||
          url === 'https://distilledcs.org/customer-success-playbooks/' ||
          url === 'https://distilledcs.org/customer-success-maturity-model/'
        ) {
          item.priority = 1.0;
          item.changefreq = 'weekly';
        }
        // Per-principle deep pages: high priority, monthly.
        else if (url.startsWith('https://distilledcs.org/customer-success-principles/')) {
          item.priority = 0.9;
          item.changefreq = 'monthly';
        }
        // Metric / playbook detail pages: solid priority, monthly.
        else if (
          url.startsWith('https://distilledcs.org/customer-success-metrics/') ||
          url.startsWith('https://distilledcs.org/customer-success-playbooks/')
        ) {
          item.priority = 0.8;
          item.changefreq = 'monthly';
        }
        // Assess / transform / checklist: primary flow pages.
        else if (
          url === 'https://distilledcs.org/assess/' ||
          url === 'https://distilledcs.org/transform/' ||
          url === 'https://distilledcs.org/checklist/'
        ) {
          item.priority = 0.9;
          item.changefreq = 'monthly';
        }
        // Articles (blog collection): yearly.
        else if (url.startsWith('https://distilledcs.org/articles/')) {
          item.priority = 0.7;
          item.changefreq = 'yearly';
        }
        // Glossary: solid reference page, refresh occasionally as terms are added.
        else if (url === 'https://distilledcs.org/glossary/') {
          item.priority = 0.7;
          item.changefreq = 'monthly';
        }
        // Everything else (about, contact, privacy, contribute, contributors): yearly.
        else {
          item.priority = 0.5;
          item.changefreq = 'yearly';
        }
        return item;
      },
    }),
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