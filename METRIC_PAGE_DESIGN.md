# Metric Page Design & Typography Reference

> Design/UI/typography contract for the metric detail pages
> (`src/pages/customer-success-metrics/[id].astro`) and their MDX enrichment
> files (`src/content/metrics/[id].mdx`). This is the **look-and-feel** companion
> to the content/data conventions in CLAUDE.md's "Metric pages: MDX enrichment
> layer" section. Read this before restyling a metric page or authoring a new
> enrichment MDX so every metric page stays visually consistent.

## Why this exists

A metric detail page is two things stitched together: **structural template
sections** (Formula, Calculator, Priority by Stage, Benchmarks, Audience, Used in
Playbooks, Related Metrics, and the FAQ heading) rendered by the Astro page, and
an **editorial prose layer** (the MDX enrichment: narrative h2/h3 + paragraphs)
rendered in the middle. Before the enrichment layer existed, every heading was the
same. Once prose headings arrived with their own style, the two drifted into two
different typographic "voices" at the same semantic level. This doc pins down a
single system so they read as one page.

## The one heading system (the core rule)

**All section-level headings on the page — structural *and* editorial — use the
same serif display ramp.** There is exactly one visual treatment per heading level.
Do not introduce a second h2 or h3 style for "structural" vs "prose" sections; the
reader should not feel the page change voice as they scroll from the prose into the
FAQ or the benchmarks.

### Type ramp

**All headings are weight 450.** This is the site-wide display-heading language —
`global.css` sets every `h1`–`h6` to Source Serif 4 / weight **450**, and the
playbook and principle pages' section headings inherit it. Metric pages must match.
450 is a subtle, deliberate step up from Regular (400): it gives headings a little
presence without the heavy, dark look of 600/700. Do **not** set a heading to
600/semibold; hierarchy comes from size and the serif-vs-DM-Sans family contrast,
not from heavier weight. (An earlier revision set section headings to 600, which
actually rendered at 700 because only 400/700 were loaded — it read heavy and dark
and broke uniformity. Don't reintroduce it.)

450 is a non-named variable-font weight: it only renders as a true 450 because
`global.css` loads the Source Serif 4 `wght` axis as a **range** (`400..700`), not
as pinned instances. If that range load is ever reverted to discrete weights, 450
would snap to 400. See "The variable-font weight" note below.

| Level | Font | Size | Weight | Tracking | Notes |
|---|---|---|---|---|---|
| **H1** (`.metric-title`) | Source Serif 4 | `clamp(1.75rem, 3vw, 2.25rem)` | 450 | −0.02em | Page title only, one per page. |
| **H2** (`.section-heading` **and** `.metric-enriched h2`) | Source Serif 4 | `clamp(1.375rem, 2.2vw, 1.6rem)` | 450 | −0.015em | line-height 1.25. Every section heading, structural or prose. |
| **H3** (`.metric-enriched h3` **and** `.faq-question`) | Source Serif 4 | 1.15rem | 450 | normal | line-height 1.3. Prose subheads (Crawl/Walk/Run) and FAQ questions share this. |
| **Body** (`.metric-definition`, `.metric-enriched p`) | DM Sans | 1.0625rem (17px) | 400 | normal | line-height 1.7–1.75. |
| **Small** (`.faq-answer`, calc captions, `.also-known`) | DM Sans | 0.9375rem / 0.875rem | 400 | normal | line-height 1.7. |
| **Eyebrow** (`.category-tag`) | DM Sans | 0.6875rem | 600 | 0.06em, uppercase | Category chip above the title (the one intentionally-bold, small, uppercase label). |

The heading CSS omits `font-weight` entirely so it inherits the global 450, exactly
as the playbook/principle `.section-heading` rules do. Do not re-add a per-page
`font-weight` on a heading — that is how the page falls out of sync with the site.

### The variable-font weight (why 450 works)

450 is a valid CSS `font-weight` (the property accepts any integer 1–1000), but it
only renders as a distinct cut because Source Serif 4 is a **variable font** and
`global.css` loads its weight axis as a continuous range:

```
family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700
```

The browser interpolates 450 between the 400 and 500 masters. This is standard,
well-supported (all browsers with variable-font support, ~2018+), and has **no SEO
cost** — `font-weight` is pure presentation; crawlers index heading semantics, not
weight. If you ever change the weight of headings, change it in the one global
`h1–h6` rule so the whole site stays uniform; never do it per page.

### Rules that keep it consistent

1. **Serif for every heading, sans (DM Sans) for every run of reading text.** Headings
   are Source Serif 4; body copy, FAQ answers, captions, labels, and table cells are
   DM Sans. Never set a section heading in DM Sans.
2. **Every heading is weight 450.** Match the site's display-heading language
   (all pages inherit the global `h1–h6` weight). Never set a heading to 600, and never
   bold body text up to heading weight to fake a heading. The only intentionally-bold
   text near a heading is the small uppercase category eyebrow.
3. **Headings scale with `clamp()`, they are not fixed px.** The old `.section-heading`
   was a fixed 18px while prose headings scaled — on wide screens a real h2 ended up
   smaller than the prose h2 above it. Keep both on the same clamp so the gap can
   never reopen.
4. **H3 is a single size (1.15rem).** Prose subheads and FAQ questions are the same
   level, so they match. A FAQ question must never look like a sibling of its own
   section heading.
5. **These styles live in the shared template**
   (`customer-success-metrics/[id].astro` `<style>` block), so one edit updates all 24
   metric pages. Prose headings are targeted with `:global(...)` because `render()`
   output carries no scope hash; structural headings use normal scoped selectors.
   If you change the ramp, change **both** the `.section-heading` rule and the
   `.metric-enriched :global(h2/h3)` rules together, and update this table.

## MDX enrichment authoring conventions

These are the design-facing rules for writing a `src/content/metrics/[id].mdx`
body. (Content/SEO/frontmatter conventions — FAQs in frontmatter, `meta_description`,
working-reference SEO fields, Common Mistakes being dropped — live in CLAUDE.md.)

- **Start the body at `##` (h2), never `#`.** The page already renders the metric
  name as its single h1. The first prose heading must be an h2 (`.metric-enriched
  h2:first-child` has its top margin zeroed so it sits correctly under the
  calculator).
- **Body structure:** one or two intro paragraphs (no heading) → `##` sections →
  optional `###` subsections. Match the register and section shape of the shipped
  enrichments (`grr.mdx`, `nrr.mdx`): "What X Really Tells You" → "How to Read" →
  "What Moves X" → "How to Improve" (Crawl/Walk/Run `###` blocks) → a worked example
  → "Nuances and Edge Cases".
- **No horizontal rules (`---`) between sections.** The heading + section margins
  provide the rhythm; `<hr>` breaks it up and does not appear anywhere else on the
  page.
- **No draft handoff artifacts in the shipped file.** Strip `notes:` frontmatter and
  any `<!-- merge note -->` comments before the file goes in; keep only the
  schema-validated frontmatter.

## Inline cross-links (the plain-link rule)

**Inline cross-links in prose are plain markdown links, never bolded.** Write
`[net revenue retention (NRR)](/customer-success-metrics/nrr/)`, not
`**[net revenue retention (NRR)](...)**`.

- The link style (accent color + underline, `text-underline-offset: 2px`, underline
  removed on hover) is already a strong enough signal. Wrapping links in `**` makes
  weight-600 links speckle the paragraph and competes with genuine `**bold**`
  emphasis on concept terms.
- **`**bold**` is reserved for emphasis on a concept term** (e.g. the drivers in
  "What Moves NRR": **pricing structure**, **realized value**). A term can be bold,
  or a link, but not both.
- Link the **first meaningful mention** of each cross-referenced entity, not every
  mention. Over-linking every occurrence is noise.
- Verify every metric/playbook id resolves before linking (`npm run check:data` and
  `npm run check:links` both catch broken targets; the link check needs a fresh
  build).

## Verifying a metric page

After restyling or adding an enrichment:

1. `npm run build` then `npm run check:links` (and `npm run check:data` for id
   references).
2. Spot-check the rendered page in the preview at both a narrow and a wide viewport —
   confirm the h1 → h2 → h3 sizes step down cleanly and no structural heading (e.g.
   "Benchmarks") looks smaller than a prose heading above it.
3. Confirm one `<h1>`, no skipped levels, and that FAQ questions read as children of
   the "Frequently Asked Questions" heading, not siblings of it.
4. Check dark mode — headings use `--color-text-primary`, so they follow the theme
   automatically; no per-theme heading overrides should be needed.
