# Blog / Articles — candidate topics

Captured from `SEO_PLAN.md` Task 12. Out of scope for the SEO initiative itself; this list seeds future content work whenever blog publishing is greenlit.

The site uses `/articles/` (route) backed by the `blog` content collection (see `src/content.config.ts`). When publishing, follow the Content & Voice rules in `CLAUDE.md` and add 3–5 contextual internal links per article (Task 6.5).

## Tier 1 — pillar-adjacent, target Tier 1 keywords

These reinforce the pillar pages by going deeper on a sub-question that the pillar can only summarize.

- **How to Choose Customer Success Metrics by Maturity Stage** — extends the Metrics pillar; covers the priority-by-stage table with reasoning. Internal links: metrics index, NRR, Health Score, maturity model.
- **The 8-Domain CS Maturity Framework Explained** — extends the Maturity Model pillar; one section per domain with what "good" looks like at each stage. Internal links: maturity model, principles, assess.
- **From Reactive to Proactive: The CS Transition Every Team Faces** — extends the "Proactive Over Reactive" principle; concrete signals that mark the shift, plus playbooks that drive it. Internal links: principle deep page, walk-stage playbooks, health score metric.

## Tier 2 — long-tail, conversion-friendly

Targets specific high-intent searches that the pillar pages cannot rank for at length.

- **Customer Segmentation for CS: When Multi-Factor Actually Beats ARR** — challenges the default ARR-only segmentation; proposes ARR + usage-intensity + product-complexity factors.
- **AI in Customer Success: What Actually Matters in 2026** — extends the AI domain; separates real CS leverage (drafting, summarization, signal aggregation) from hype (autonomous CSMs).
- **Building a Customer Health Score: Inputs, Weights, and What to Skip** — extends the Health Score metric page; concrete worked examples by stage.
- **CS QBR Template: What to Cover, What to Cut** — targets "QBR template" search intent; vendor-neutral structure.
- **NRR vs GRR: Which Number Tells You What** — disambiguation post; common confusion in board reporting.

## Tier 3 — narrative / opinion

Lower SEO value, higher community-building value. Run only when the project has a regular publishing cadence.

- **Why CS Needs Its FinOps Moment** (existing draft, deleted in Task 7.3 — re-draft if appropriate)
- **What Distilled CS Gets Wrong** — annual self-critique post; where the framework is over- or under-prescriptive.

## Editorial constraints

- Each post: ≥800 words, single h1, linear heading hierarchy, 3–5 contextual internal links.
- Frontmatter: `title`, `description` (140–160 chars for SERP), `pubDate`, `tags`, `draft: true` until ready.
- The `[...slug].astro` route filters `draft: true`, so drafts can sit in the collection without leaking to the public site or sitemap.
- Follow Content & Voice rules in `CLAUDE.md`: em dashes sparingly, no marketing superlatives, no rhetorical openers, concrete over abstract.
