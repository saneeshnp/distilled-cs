import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    author: z.string().default('Saneesh'),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().default(false),
  }),
});

// Per-metric editorial enrichment. Additive layer over lean-cs-data.json: a
// metric with a file here gets long-form prose + FAQ rendered on its detail
// page; metrics without one render exactly as before. MDX (not plain .md) so
// Astro components can be embedded inline later (callouts, comparison blocks).
// Core structured fields stay in lean-cs-data.json — this is editorial only.
const metrics = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/metrics' }),
  schema: z.object({
    title: z.string(),
    metric_id: z.string(),
    // meta_description overrides the metric's definition for the page's SEO
    // description when present.
    meta_description: z.string().optional(),
    // Q&A pairs are the single source for both the visible FAQ section and the
    // FAQPage JSON-LD, so the two can never drift (Google requires parity).
    faqs: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .optional(),
    // Working reference only — not rendered. Kept so the draft's SEO notes live
    // with the content.
    status: z.string().optional(),
    primary_keyword: z.string().optional(),
    secondary_keywords: z.array(z.string()).optional(),
    search_intent: z.string().optional(),
  }),
});

export const collections = { blog, metrics };
