# Changelog

## 0.2.0 — 2026-04-22

### Added
- **8th assessment domain: AI Leverage in CS** (`ai_leverage`) — 3 questions covering AI use-case depth, data foundation, and governance & adoption. Domain count: 7 → 8. Question count: 21 → 24.
- **4 new AI-focused playbooks** (one per maturity stage):
  - Crawl: "Introduce AI Copilots for CSM Productivity" (`crawl-ai-copilots`)
  - Walk: "Pilot Predictive Health Scoring" (`walk-ai-health-scoring`)
  - Run: "Implement Responsible AI Governance for CS" (`run-ai-governance`)
  - Fly: "Deploy Agentic CS Workflows" (`fly-agentic-workflows`)
- **2 new AI metrics**:
  - "AI-Assisted Resolution Rate" (`ai_assisted_resolution_rate`) — outcome metric
  - "CSM AI Adoption Rate" (`csm_ai_adoption_rate`) — activity/leading indicator
- **New `ai` metric category** with indigo color token across metrics directory and detail pages
- **AI-relevant entries in `stage_transitions`** — 1 bullet per block (trigger_signals, key_shifts, new_capabilities) across all three transitions (crawl→walk, walk→run, run→fly)
- **AI priority action per stage** in `priority_actions` (all 4 stages now include an AI-specific action)

### Changed
- `meta.version` bumped 0.1.0 → 0.2.0; `last_updated` set to 2026-04-22
- `assessment_domains.description` updated to reflect 8 domains
- `strategy_loop.phases[0].description` updated to "8 domains"
- `about.astro`, `assess.astro`, `admin.astro` copy updated for 8 domains / 24 questions

### Fixed
- `scoring-engine.js` `determineStage()` — replaced range-matching with ascending-min-selection to eliminate score gaps at 1.75, 2.55, 3.35 that previously fell through to `fly`
- `transform.astro` delta logic — `|| 0` fallback replaced with explicit `=== undefined` check to avoid false large improvements for the new `ai_leverage` domain on returning users
- `metrics/[id].astro` — added `ai` category label and CSS (previously would fall back to raw ID string)

### Migration notes
- Users with 7-domain prior scores (`distilledcs_previous_scores`) will see a "New" badge for the `ai_leverage` domain on the transform and report pages. No data loss; all other domain deltas continue to work.
- Rollback: `git checkout` the JSON file and the handful of `.astro` files touched. Extra `ai_leverage` keys in localStorage are ignored by all renderers.

---

## 0.1.0 — 2026-03-27

Initial release of the Distilled CS framework.
- 7 assessment domains, 21 capability questions, 7 context profile questions
- 12 playbooks (3 per maturity stage), 16 metrics
- Maturity model, transform dashboard, CS maturity report
