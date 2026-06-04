# Reporting & Sharing — Implementation Reference

> **Trigger:** Read this before touching `src/pages/cs-maturity-report.astro`, `src/scripts/share-encoder.js`, `src/scripts/recommendation-engine.js`, or any reporting-related issue. Don't try to navigate the report page from scratch — it has too many moving parts.

This document is the single source of truth for the CS Maturity Report and the share-by-URL feature. CLAUDE.md must not duplicate this content; it should only point here.

---

## 1. What the report is

`/cs-maturity-report/` consolidates everything from the assessment into a single screen the user can read, print, or share. Entry points:

- **From the assessment** — clicking "View Full Report →" on the results screen sets `sessionStorage.distilledcs_just_assessed`, redirects to the report page, and shows a brief loading overlay before rendering.
- **Direct visit** — if `localStorage.distilledcs_completed === 'true'` the page reads scores from localStorage and renders silently.
- **Shared URL** — `?d=<base64url-payload>` is decoded and rendered as a read-only view of someone else's assessment.

The page is `noindex` (excluded from sitemap, robots-disallowed via meta tag) and gated by a `data-show-if-assessed` / `data-hide-if-assessed` toggle so unassessed users see a fallback CTA.

---

## 2. File map

| File | Purpose |
|---|---|
| `src/pages/cs-maturity-report.astro` | The page itself — markup, scoped CSS, the entire report-rendering script |
| `src/scripts/share-encoder.js` | Pure encode/decode for shareable URL payloads |
| `src/scripts/share-encoder.test.js` | Node-runnable test harness for the encoder |
| `src/scripts/recommendation-engine.js` | Pure composition of priority actions, strengths, playbooks, metric priorities |
| `src/scripts/recommendation-engine.test.js` | Node-runnable test harness for the engine |
| `src/scripts/scoring-engine.js` | Domain/overall scoring and stage determination — also used by `assess.astro` |
| `src/scripts/context-manager.js` | localStorage utilities (profile, scores, completion, previous scores) |
| `src/data/lean-cs-data.json` | Framework content + `meta.assessment_version` for share-payload versioning |
| `public/images/cs-report-header.png` | Full-bleed header image (greyscale; stage-tinted via CSS overlay) |

---

## 3. Data flow

```
                  ┌──────────────────────────┐
                  │ tryDecodeSharedReport()  │  ← ?d=... URL param wins if present
                  └──────────┬───────────────┘
                             │
                             ▼ null → fall through
                  ┌──────────────────────────┐
                  │ isAssessmentCompleted()  │  ← localStorage flag
                  └──────────┬───────────────┘
                             │ true
                             ▼
                  ┌──────────────────────────┐
                  │ buildFromLocalStorage()  │
                  └──────────┬───────────────┘
                             │
                             ▼
                     ReportData object
                             │
                             ▼
                     renderReport(data)
                             │
       ┌─────────────────────┼────────────────────────────┐
       ▼                     ▼                            ▼
   renderHeader()    bodySections array              buildToc()
   (synchronous)     (joined into                    (prepends to body wrapper)
                      .report-body-reveal)
```

### The `ReportData` interface

```ts
interface ReportData {
  companyName: string;                       // empty string when not provided
  profile: Record<string, string>;           // 7 context_parameters fields, ids only
  domainScores: Record<string, number>;      // { sc: 2.3, jl: 3.0, ... } on 1-4 scale
  overallScore: number;                      // 1-4 scale (display via toDisplayScore × 2.5)
  stage: string;                             // 'crawl' | 'walk' | 'run'
  responses: Record<string, number>;         // { sc_q1: 3, sc_q2: 4, ... } values 1-4
  timestamp: string;                         // ISO string; '' when missing
  previousScores: any | null;                // re-assessment comparison
  checklistProgress: Record<string, boolean> | null;
  isSharedView?: boolean;                    // true when sourced from ?d=
  versionMismatch?: boolean;                 // shared payload's assessment_version ≠ current
}
```

### Two sources, one shape

`buildFromLocalStorage()` and `tryDecodeSharedReport()` both return the same shape. Shared reports differ only in:

- `isSharedView: true`
- `versionMismatch: <bool>`
- `previousScores: null`, `checklistProgress: null` (we can't recover the recipient's local state from a URL)
- `timestamp` reflects the **original assessor's** assessment time, not the recipient's view time

---

## 4. The render pipeline (`renderReport`)

Two-phase render to avoid jank:

**Phase 1 — header paints immediately.**
- `el.innerHTML = renderHeader(data, stage)` sets the full-bleed image, stage tint, and the two glass cards (stage card on the left, score card on the right).
- This paints on first frame so the user sees the page chrome instantly, even on slow CPUs.

**Phase 2 — body sections fade in.**
- All body sections (summary, strengths, domain breakdown, priority actions, playbooks, metrics, maturity model, transition guide, footer) are concatenated into a single `<div class="report-body-reveal">` that starts at `opacity: 0`.
- After a `setTimeout(500)`, a class flips and the body fades in over 0.4s.
- `prefers-reduced-motion` short-circuits both transitions.

**Header content has its own reveal.** `.report-header-content-reveal` slides up 16px + fades via double-RAF (0.35s ease-out). This happens *during* the half-second before the body begins fading, so the eye sees: image and tint → header content settles → body appears. Three distinct beats, intentionally.

**The score count-up.** Once the loading overlay (if any) dismisses, `animateScoreCountUp()` fills the SVG ring and counts the score number from 0 to its target over 800ms. The ring's `stroke-dasharray` is hardcoded to `339.29` (the circumference of the 54px-radius circle). If you change the ring geometry, update that constant.

---

## 5. The 9 report sections

Order matters — sections render top-to-bottom in this order:

| # | Section | Function | Notes |
|---|---|---|---|
| 1 | Header | `renderHeader` | Always renders. Includes attribution + (in shared view, sub-header logo is hidden so only the page-level brand mark shows in print) |
| 2 | Executive Summary | `renderSummary` | Four paragraphs — see below |
| 3 | Your Strengths | `renderStrengths` | **Conditional** — only renders if `composeStrengths` returns ≥ 2 fragments |
| 4 | Domain Breakdown | `renderDomainBreakdown` | Sorted by score descending, with delta arrows when `previousScores` exists |
| 5 | Priority Actions | `renderPriorityActions` | Body = `insight + " " + next_step` (personalized lead-in + directive). Up to 8 scored (1 per domain via adaptive cap) + 1 stage fallback = 9 max. Cards 1–5 prominent; 6–9 grouped under "More actions worth considering" with compact muted styling. Domain eyebrow above each card; no question/answer attribution footer. |
| 6 | Recommended Playbooks | `renderPlaybooks` | Current stage + "Strengthen Weakest Area" + "Coming Next" |
| 7 | Metric Priorities | `renderMetrics` | Three tiers with distinct visual weight: **High** = accent-tinted card wrapper, **Medium** = plain rows, **Low** = compact muted rows under "Also worth tracking" subhead. The colored priority dot stays as a secondary signal. |
| 8 | Maturity Journey | `renderMaturityModel` | Three stage cards. All share the same shape: label + subtitle + badge + description paragraph. No `key_characteristics` list rendered — listing per-capability statements would imply a checklist of completed items, which would misrepresent the average-score stage assignment. Past stages: "✓ Completed" badge. Current stage: "You are here" badge. Future stages: "Coming next" badge. Section footer links to `/customer-success-maturity-model/` for full detail. |
| 9 | Transition Guide | `renderTransitionGuide` | **Hidden at Run stage** (no next stage to transition to) |
| — | Footer | `renderFooter` | Generated timestamp + re-assessment link. Timestamp omitted gracefully if missing |

**`renderSummary` — four-paragraph structure:**
- **Para 1**: Company identity sentence (segment + team size prose). Omitted if profile is absent.
- **Para 2**: Stage verdict — label, subtitle, and description from `maturity_stages`.
- **Para 3**: Overall score + domain picture. When the gap between the highest and lowest domain score is ≥ 0.5 (raw 1–4 scale, i.e. ≥ 1.25/10), names the strongest and weakest domain explicitly. When the gap is < 0.5 (near-tie or flat profile), shows a "consistent across all domains" sentence instead — calling out a "highest" and "lowest" domain when scores are effectively equal is misleading. A broad-gap note is appended when ≥ 3 domains scored below 5/10.
- **Para 4**: Segment + team-size template from `executive_summary_templates` in JSON, keyed by `seg_*` → team-size band. Omitted if profile keys don't match.

A version-mismatch notice (`.report-version-notice`) is `unshift`-ed onto `bodySections` when `data.isSharedView && data.versionMismatch`, so it appears at the top of the body fade-in.

---

## 6. Recommendation engine

`src/scripts/recommendation-engine.js` is a pure module — no DOM, no localStorage, no `import.meta`. All four exports are testable in Node.

### Inputs

```js
composePriorityActions(profile, responses, stage)
composeStrengths(profile, responses)
composePlaybookRecommendations(profile, responses, stage, allPlaybooks)
composeMetricPriorities(profile, responses, stage, allMetrics)
```

> **Known behavior — uncapped current-stage playbook list (revisit).** `composePlaybookRecommendations` returns `currentStage = allPlaybooks[stage]` with no cap, and `renderPlaybooks` maps the full list. When a stage gains playbooks, the report's "Recommended Playbooks" section grows with it. After the June 2026 playbook expansion, Walk holds 9 playbooks, so a Walk user's report shows 9 current-stage cards (and a Crawl user's "Coming Next" → Walk also shows 9). This is acceptable for now. If the section gets unwieldy, revisit: cap to the top N by weakest-domain relevance with a "see all playbooks" link. Any cap change touches `recommendation-engine.js` and is covered by `recommendation-engine.test.js`.

### How composition works

- Each question option in `lean-cs-data.json` carries optional `insight` (≤120 chars, "what you revealed by picking this") and `next_step` (≤200 chars, "what to do next").
- Score-3 and score-4 options may carry `next_step_by_segment` keyed by `seg_*` IDs for genuinely divergent advice.
- Options and stage actions may carry `tags[]`.
- `profile_modifiers` in JSON (`customer_segment`, `company_arr`, `cs_team_size`) declare `emphasizes` and `deprioritizes` tag arrays per profile value.
- The engine: pulls fragments from the user's responses, filters by `deprioritizes` tags for the user's profile, dedupes, ranks, and returns the top N.
- When no fragments are available, falls back to `stage.priority_actions` — no crash.

### Priority actions: composition and selection

`composePriorityActions` is the most opinionated part of the engine. It does two things on top of the generic fragment-pull described above:

**1. Body composition — insight + next_step.**
The `body` field returned to the template is `${option.insight} ${nextStep}` (where `nextStep` is either `next_step_by_segment[segment]` or `next_step`). The insight is the personalized lead-in ("you are here") and the next_step is the directive ("do this"). Together they read as one natural recommendation, no Q&A attribution needed. If `insight` is absent on an option, body falls back to `nextStep` alone. Both fields are written to be standalone-readable — see the manual QA pass during the Phase 1 rollout for the four pairs that were edited to flow naturally when concatenated (`ai_q1.s3`, `ca_q3.s3`, `hr_q2.s4`, `md_q3.s1`).

**2. Adaptive per-domain selection with cap escalation.**
The engine surfaces variety first, depth only when needed. After sorting candidates by `userScore` ascending (lowest = highest priority), it runs three picking passes:

- **Pass 1 (cap=1 per domain):** pick at most one entry from each domain. Best diversity. For a normal 24-question assessment across all 8 domains, this alone fills the target.
- **Pass 2 (cap=2):** if Pass 1 returned fewer than `MAX_SCORED` (only happens when the user answered questions in fewer than 8 domains), allow a second entry per domain.
- **Pass 3 (cap=3):** absolute ceiling — each domain has at most 3 questions, so allowing 3 per domain is equivalent to "all qualifying entries."

`MAX_SCORED = 8`. Add one stage-level fallback (deduped against picked entries via raw `next_step` text comparison, not against the composed body string). Total cap: **9 priority actions** (8 scored + 1 fallback).

**3. Two-tier display.**
The flat array of up to 9 entries is split by the template ([cs-maturity-report.astro](src/pages/cs-maturity-report.astro)): cards 1–4 (top 4 scored) + card 5 (stage fallback) render as the prominent headline block; cards 6–9 (additional scored) render under a "More actions worth considering" subhead with compact muted styling (smaller padding, smaller number badge, smaller eyebrow, transparent background, secondary text color). Same content shape, visually quieter.

**Edge cases (covered by 121 checks in `recommendation-engine.test.js`):**
- Empty responses → returns 1 stage fallback only, no crash
- Null/undefined response values → silently skipped
- Unknown scores (e.g., legacy localStorage with `score: 5`) → silently skipped
- Sparse responses (only 1–2 domains answered) → Pass 2/Pass 3 fill in additional scored entries from the answered domains
- Missing `insight` on an option → body falls back to `next_step` alone
- 384-combo exhaustive fuzz over (question × score × segment) verifies no `"undefined"` or `"null"` strings ever leak into a rendered body

### Executive summary templates

`executive_summary_templates` top-level key, keyed by `seg_*` → team-size band. The engine inserts the matching template as a third paragraph. Missing keys fall back cleanly.

**Important:** when adding a new question or restructuring the JSON, update both:
1. The actual JSON content (add `insight` + `next_step` to each option)
2. The test fixtures in `recommendation-engine.test.js`

Run `node src/scripts/recommendation-engine.test.js` to verify.

---

## 7. Shared reports

### The payload schema

```js
{
  v: <number>,          // meta.assessment_version from JSON (mandatory)
  c?: <string>,         // company name (omitted if user toggled it off or left blank)
  p?: <object>,         // profile { customer_segment, company_arr, ... } — id strings only
  r?: <object>,         // responses { sc_q1: 3, sc_q2: 4, ... } — values 1-4 only
  t?: <string>          // ISO timestamp of original assessment
}
```

Encoded via `JSON.stringify` → UTF-8 bytes → `btoa` → URL-safe base64 (`+/=` → `-_<padding stripped>`). Decoded with the reverse pipeline.

### Encoder/decoder contract (`share-encoder.js`)

| Function | Behavior |
|---|---|
| `encodeReport({ version, companyName, profile, responses, timestamp })` | Throws if `version` is missing/non-number. Strips `company_name` from `profile` (lives in `c` instead). Drops empty strings, non-integer responses, out-of-range responses (1-4 only). |
| `decodeReport(payload)` | Returns `null` on malformed input, missing `v`, JSON array root, etc. Sanitizes: keeps only string profile values, only integer 1-4 responses. Caller-visible: `{ version, companyName, profile, responses, timestamp }`. |
| `filterResponsesToKnownIds(responses, knownIds)` | Drops IDs not in the current schema. Used to reconcile older payloads with the current question set. |

### Versioning strategy

The encoder uses **ID-keyed** encoding plus a **version field**. This means:

| Schema change | Impact on old links |
|---|---|
| Wording change on a question or option label | None — IDs unchanged, score semantics unchanged |
| New question added | Old links don't have an answer for it; domain scores on the remaining answers, domain is dropped from the breakdown if all questions are missing |
| Question removed | Silently dropped on decode (`filterResponsesToKnownIds`) |
| Question ID renamed | **Old answer is lost.** If you must rename, add a migration map in the caller before calling `filterResponsesToKnownIds`. Strongly avoided in practice. |
| Score-level semantics change (what "3" means on q_xyz) | Old links silently misinterpret. **Bump `meta.assessment_version` in this case**, and the recipient sees the version-mismatch footnote. |

### The `assessment_version` field

Single integer at `meta.assessment_version` in `lean-cs-data.json`. Stamped into every shared URL as `v`. On decode, compared against the current JSON value — if they differ, `versionMismatch: true` flows through `ReportData` and `renderReport` prepends a yellow notice at the top of the body:

> Note: this shared report was generated against an earlier version of the assessment. Some recommendations may have shifted since.

**That is the only behavioral effect.** No refusal to render, no migration logic, no recomputation. The recipient still sees the report, just with a heads-up.

**Bump-or-not decision table:**

| Change | Bump? | Why |
|---|---|---|
| Fix a typo in a question label | ❌ No | Same scale, same meaning |
| Reword a question for clarity | ❌ No | Same scale, same meaning |
| Add a new `insight` or `next_step` fragment | ❌ No | Affects recommendations going forward, not how to interpret an existing answer |
| Add a new question to a domain | ❌ No | Old links score on remaining answers; no semantic shift |
| Remove a question | ❌ No | Old answer for it is dropped on decode |
| Reorder questions or options within a domain | ❌ No | IDs unchanged |
| Change what a score level **means** on an existing question (e.g. "3" used to mean "we have a process," now means "we have a documented, repeatable process") | ✅ Yes | Old "3" answers no longer represent the same thing |
| Rebalance `score_range` thresholds on `maturity_stages` | ✅ Yes | Same numeric scores now produce different stages |
| Change how `next_step_by_segment` maps segments to advice | Maybe | Only if it changes which advice a given score+segment receives — usually no |

**Why a single integer, not semver:** the only thing we need to express is "same meaning or not." There's no partial compatibility — either the recipient sees what the assessor saw, or they don't.

**What happens with a severe mismatch:** if so many question IDs were renamed that `filterResponsesToKnownIds` drops most responses, `tryDecodeSharedReport` returns null and the page falls back to the unassessed CTA rather than rendering nonsense.

### Decoding into a render

`tryDecodeSharedReport()` (in `cs-maturity-report.astro`):

1. Reads `?d=` from `window.location.search`.
2. Calls `decodeReport`.
3. Calls `filterResponsesToKnownIds(decoded.responses, ALL_QUESTION_IDS)` to drop unknown IDs.
4. **Re-scores from responses** using `calculateAllDomainScores` + `calculateOverallScore` + `determineStage`. We don't trust pre-computed scores in the payload — re-scoring with the current engine keeps the view consistent with whatever the engine produces today.
5. Returns the full `ReportData` shape with `isSharedView: true` and `versionMismatch` set by comparing `decoded.version` to `ASSESSMENT_VERSION`.

### Shared-view UI changes (`applySharedViewChrome`)

When `data.isSharedView === true`:

- The **shared-banner** (static markup outside `#report-assessed`, hidden by default) is revealed. Its `id="report-shared-banner"` element gets a `stage-crawl|walk|run` class added so the left-stripe inherits `--stage-color`.
- The banner headline is JS-built from the company name:
  - With name: `You are viewing <strong>${escapeHtml(name)}</strong>'s CS assessment shared with you via a link`
  - Without name: `You are viewing a CS assessment shared with you via a link`
- The **overflow menu** ("Update My Answers" / "Clear & Restart") is hidden — those actions belong to the viewer's own report, not someone else's.
- The **Share button** is hidden — secondary shares cause confusion and the payload was tailored for the original viewer.

The Share modal markup remains in the DOM but is unreachable without the trigger button.

### The Share modal

Title: **"Share your CS report"** (in Source Serif 4, weight 600, `--color-text-secondary` muted gray — softer than primary text so it reads as a section heading without being stark).

Two tabs:

1. **Share this report** — generates `?d=<payload>` URL, copy button, "Include my company name in the shared report" toggle (default on). Toggling the checkbox re-encodes via `refreshShareModal()`.
2. **Share your score** — generates a clean `/assess/` URL + pre-filled social text using the score and stage. LinkedIn / X intent URLs encoded via `encodeURIComponent`. No SDKs.

Copy buttons use `navigator.clipboard.writeText` with a `document.execCommand('copy')` fallback. A `.is-copied` class flips the button label to "Copied" for 1.6s.

**Privacy footer** (`.share-modal-footer`) — a static strip at the bottom of the modal, shown for both tabs. Small padlock icon + muted text: *"We don't store/track any of your report data, it stays only in your browser and the share link itself."* This is a factual statement, not marketing — the site has no backend, responses live in localStorage, and shared links encode the payload directly into the URL. If the architecture ever changes (backend, account system, telemetry), this note must be revisited.

---

## 8. Print / PDF

Toolbar button is labeled **"Save as PDF"** with a document-plus-down-arrow icon. The button calls `window.print()` — the browser's print dialog opens, and the user picks "Save as PDF" as the destination (the default in most modern browsers on the second visit). The 99% case is PDF download; physical printing is supported via the same dialog. The label and icon reflect user intent, not the underlying implementation. **Do not introduce html2pdf.js or html2canvas** — those tools clone the document into hidden iframes, which under Astro's dev server triggers cascading HMR reloads and crashes Vite.

Print rules to be aware of:

- Hides: header, footer, ContextBar, `.report-toolbar` and all its buttons (`.report-overflow-menu`, `.report-share-btn`, `.report-download-btn`), `.shared-banner`, `.share-modal`
- Forces light-mode CSS variables on both `:root` and `:root[data-theme="dark"]`
- Forces solid stage colors (Material 700) regardless of theme
- Strips the header background image and falls back to a flat surface
- Restores the site nav logo at the top of the report (`.report-header-logo`) — it's hidden on screen to avoid duplication with the page chrome
- Forces both `.report-header-content-reveal` and `.report-body-reveal` to `opacity: 1 !important` so the print captures the full content even if it's mid-animation

When adding a new element to the toolbar or banner, **add it to the print-hide list** in the same edit.

---

## 9. Header layout (full-bleed image + glass cards)

The `.report-header` is a full-bleed band:
- `width: 100vw; margin-left: calc(50% - 50vw)` breaks out of the `.container` constraint
- Greyscale `public/images/cs-report-header.png` is the background
- A `.report-header-tint` div absolutely positioned at `inset: 0` applies a stage-colored overlay at `opacity: 0.62`
- **Walk stage is a special case**: amber (`#F57C00`) renders too light at 62%, so walk uses `#e07100` at 75% instead (overridden in the same scoped CSS block)
- **Dark mode is a special case**: stage pastels would *brighten* the image rather than darken it, so dark mode overrides the tint to `rgba(0, 0, 0, 0.65)`. The selector `.report-header .report-header-tint` raises specificity to (0,4,0) to beat per-stage overrides at (0,3,0)

Two glass cards sit inside `.report-header-content`:
- Card backgrounds use `rgba(255,255,255,0.12)` with `backdrop-filter: blur(10px)`
- Cards are equal-width via `display: grid; grid-template-columns: 1fr 1fr`
- In dark mode, the stage name, score number, and SVG ring fill all switch to `var(--stage-color)` (the pastel) for vivid contrast against the dark image

Toolbar floats above the image at `position: absolute; top: 1.25rem`. **Anchor**: it's positioned relative to `#report-assessed`, which is `position: relative`. Don't put anything between `#report-assessed` and the toolbar's positioning context, or the toolbar will land on the wrong element. (This is exactly why the shared-banner is rendered as a sibling of `.container.report-page`, not inside `#report-assessed`.)

**Mobile toolbar (`< 640px`)** — labels hide, all three buttons become icon-only with reduced padding and a tightened inter-button gap. Without this, the three labeled buttons (Options + Share + Save as PDF) wrap onto a second row and overlap the header content below, because the absolutely-positioned toolbar doesn't push the header down. Each button retains an `aria-label` so screen readers still announce the action. The media query lives **after** all three base button definitions in the stylesheet — equal-specificity selectors rely on source order, and an earlier draft accidentally placed `.report-share-btn`'s base rule after the media query, which silently re-introduced the larger padding on mobile. If you add a new toolbar button, normalize its base padding to match its peers (`0.625rem 0.875rem`) and ensure the mobile media query is still the last block touching button sizing.

---

## 10. Animations

| Animation | Where | Trigger | Reduced-motion behavior |
|---|---|---|---|
| Loading overlay | `dismissLoadingOverlay` | When `sessionStorage.distilledcs_just_assessed` is set | Skips fade; jumps straight to dismissed |
| Header content reveal | `.report-header-content-reveal` → `.is-visible` | Double-RAF after header HTML is set | Class added immediately; no transform/opacity transition |
| Body reveal | `.report-body-reveal` → `.is-visible` | `setTimeout(500)` after header settles | Class added immediately |
| Score count-up + ring fill | `animateScoreCountUp` | After overlay dismissed | Skip count-up; set final stroke-dashoffset directly |
| Domain bar reveal | **DISABLED on report page** | — | — |

**Why the domain bar animation is disabled on the report page:** if a user prints before scrolling to the domain breakdown, the bars would freeze mid-animation and print at the wrong width. The shared `animate-domain-bars.js` helper is therefore not called from the report page, even though `transform.astro` and `assess.astro` do call it.

---

## 11. localStorage keys

The report page reads but does not write these:

| Key | Type | Purpose |
|---|---|---|
| `distilledcs_profile` | JSON object | Profile + optional `company_name` |
| `distilledcs_scores` | JSON object | `{ domainScores, overallScore, stage, responses, timestamp }` |
| `distilledcs_completed` | `"true"` string | Whether to render the report or fall back |
| `distilledcs_previous_scores` | JSON object | Re-assessment comparison data |
| `distilledcs_checklist` | JSON object | Checklist completion (read for execution progress) |
| `distilledcs_theme` | `"light"\|"dark"` | Theme preference |
| `sessionStorage.distilledcs_just_assessed` | `"new"\|"update"` | Triggers the loading overlay; cleared after dismissal |

**Shared view does not write to localStorage** — the viewer's own state stays intact. This is deliberate: a colleague sharing their report shouldn't overwrite your assessment.

---

## 12. Style isolation (Astro scoped styles vs JS innerHTML)

The report page is the most complex consumer of this pattern in the codebase. Rules:

- Container elements that exist in the `.astro` markup at build time get **scoped styles** (the regular `<style>` block).
- All `renderXxx()` functions inject HTML via `innerHTML` — those elements get the `:where(.astro-xxx)` hash applied to selectors but the elements themselves are not tagged, so the rules don't match.
- Therefore: **every class set in JS-injected HTML must be styled in a `<style is:global>` block.**

Current report page has both. The scoped block styles container elements (`.report-page`, `.report-toolbar`, `.shared-banner`, the share modal). The global block styles everything injected by render functions (`.report-section`, `.report-stage-card`, `.report-domain-bar-row`, etc.).

If you add new JS-injected classes, put them in the global block. If you add new static elements, put them in the scoped block. Mixing leads to silently missing styles.

---

## 13. Theme-aware scoped styles

Per the project gotcha note: `:where(.astro-xxx)` is appended to bare selectors. `:root`, `html`, `body` are exempted, but **bare attribute selectors like `[data-theme="dark"]` are not.**

In scoped blocks: always write `:root[data-theme="dark"] .foo` — never `[data-theme="dark"] .foo`. The latter compiles to a selector that requires `<html>` to carry the component hash, which it doesn't.

---

## 14. When you change X, check Y

| If you change | Also verify |
|---|---|
| A question's wording in `lean-cs-data.json` | No code change needed; old shared links still work |
| A question's option `insight`/`next_step` | Re-run `recommendation-engine.test.js`. **The insight is now rendered as a sentence-leading lead-in before `next_step`** — make sure the two flow naturally when concatenated. |
| `MAX_SCORED` or the per-domain cap logic in `composePriorityActions` | Update the test assertions for total cap, scored cap, and domain-distribution expectations. The two-tier template split (cards 1–5 vs 6–9) is hardcoded to `prominentScored.slice(0, 4)` — adjust both if the headline target changes. |
| Anything in `renderMaturityModel` | The deliberate choice is **same shape for all 3 cards** (badge + description, no characteristics list). Reintroducing the characteristics list per stage would re-introduce the "implies completion of every capability" problem. If you need per-capability detail, send the user to `/customer-success-maturity-model/`. |
| What a score level (1-4) **means** on any question | **Bump `meta.assessment_version` in `lean-cs-data.json`**. Old links now show the version-mismatch footnote |
| A question ID | Add to a migration map before `filterResponsesToKnownIds`. Old links lose that answer otherwise |
| The number of questions per domain | Domain scoring tolerates fewer answers (averages over `answered.length`), but verify `recommendation-engine` doesn't expect a specific count |
| `domain.id` | Updates needed in `scoring-engine`, `recommendation-engine`, `renderDomainBreakdown`, and the JSON `principles[].related_metrics` reverse-lookup |
| Header image | Verify the stage tint still reads correctly at 62% (Walk uses 75%/`#e07100`) and dark-mode override still applies |
| Anything in the toolbar | Add it to the `@media print` hide-list AND to the mobile icon-only media query selector list. Normalize base padding to match peers (`0.625rem 0.875rem`). Add an `aria-label` since the text label is hidden on mobile. |
| Anything in `applySharedViewChrome` | Test both shared and non-shared rendering — the function gates on `data.isSharedView` |
| The `ReportData` shape | Update both `tryDecodeSharedReport` and `buildFromLocalStorage` so they emit the same shape |

---

## 15. Testing checklist (manual)

When you touch the report page substantively, run through this:

1. **Fresh assessment flow** — take the assessment, click "View Full Report," verify the loading overlay → header → body sequence
2. **Direct visit** — open `/cs-maturity-report/` directly with completed assessment in localStorage; verify silent render with score count-up
3. **Unassessed visit** — clear localStorage, open `/cs-maturity-report/`; verify the fallback CTA renders, no errors
4. **Shared view** — click Share → Share this report → copy URL → open in incognito; verify:
   - Banner appears with stage-colored stripe
   - Company name personalizes (or fallback when blank)
   - Score and stage match the source
   - Overflow menu and Share button are hidden
   - Footer shows the original assessor's timestamp
5. **Toggle "include company name"** — banner falls back to generic phrasing
6. **Share your score tab** — copy text + LinkedIn + X intent URLs all work
7. **Print preview** — verify nav, footer, ContextBar, toolbar, banner, modal are all hidden; report renders in light mode with solid stage colors
8. **Dark mode** — verify glass cards, ring fill, stage name color, banner stripe all read correctly
9. **Mobile (375px width)** — verify all three toolbar buttons are icon-only on one row (no wrap, no overlap with header content), banner CTA stays accessible, glass cards stack, modal footer note wraps cleanly
10. **Reduced motion** — DevTools → emulate `prefers-reduced-motion: reduce`; verify no animations fire, content visible on first paint
11. **Re-run encoder tests** — `node src/scripts/share-encoder.test.js` (should be 35 passed, 0 failed)
12. **Re-run engine tests** — `node src/scripts/recommendation-engine.test.js`
13. **`npm run build`** — must complete without TS errors

---

## Appendix A — Why html2pdf was rejected

Tried during initial report build. html2canvas clones the entire document into hidden iframes for rasterization. Each iframe loads the full page, including Astro's dev toolbar custom elements, Vite HMR scripts, and all module imports — triggering 15+ cascading page reloads that crash the Vite HMR websocket and freeze the page. `window.print()` + comprehensive `@media print` CSS is the safer path: zero dependencies, works on iOS Safari 15+, no dev-server interaction.

## Appendix B — Why we re-score shared reports from responses

The payload could carry pre-computed `domainScores`, `overallScore`, and `stage` directly. We don't. Reasons:

1. The scoring engine's behavior may evolve (rounding, weighting). Re-scoring keeps the view consistent with current behavior.
2. Smaller URL — every duplicated number costs base64 bytes.
3. Single source of truth — responses are the canonical data, derived values are not stored.

The tradeoff: if scoring changes substantively, an old shared link will render slightly different scores than the original assessor saw. The version-mismatch footnote covers this — if you change scoring math, bump `assessment_version`.
