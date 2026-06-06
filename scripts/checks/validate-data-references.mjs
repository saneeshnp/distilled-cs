#!/usr/bin/env node
/*
 * validate-data-references.mjs
 * ────────────────────────────
 * Walks every cross-reference inside `src/data/lean-cs-data.json` and asserts
 * that every referenced ID points to a real entity in the same file.
 *
 * Catches the "added a playbook, forgot to add its id to a principle's
 * related_playbooks" class of bug, which Astro would render as broken sections
 * on the live site without erroring.
 *
 * Collects ALL violations before exiting (don't fail on first — a long list is
 * more useful than a single error followed by re-runs).
 *
 * Cross-references checked:
 *   principles[].related_playbooks    → playbook IDs
 *   principles[].related_metrics      → metric IDs
 *   principles[].related_principles   → principle IDs (id field, NOT slug)
 *   metrics_directory.metrics[].related_metrics  → metric IDs
 *   playbooks.{stage}[].metrics_to_watch          → metric IDs
 *
 * Exit codes:
 *   0 — no violations
 *   1 — one or more violations (printed to stderr)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataPath = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../src/data/lean-cs-data.json'
);
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

const violations = [];

// ── Build the ID sets ───────────────────────────────────────────────────────
const principleIds = new Set((data.principles ?? []).map((p) => p.id));
const metricIds = new Set((data.metrics_directory?.metrics ?? []).map((m) => m.id));
const playbookIds = new Set(
  ['crawl', 'walk', 'run'].flatMap((stage) =>
    (data.playbooks?.[stage] ?? []).map((p) => p.id)
  )
);

// ── Helpers ────────────────────────────────────────────────────────────────
function checkRefs(refs, validSet, source, fieldName, validSetName) {
  if (!Array.isArray(refs)) return;
  for (const ref of refs) {
    if (!validSet.has(ref)) {
      violations.push(
        `  ${source} → ${fieldName}: "${ref}" is not a known ${validSetName}`
      );
    }
  }
}

// ── principles[] cross-refs ────────────────────────────────────────────────
for (const p of data.principles ?? []) {
  const src = `principles[id=${p.id}]`;
  checkRefs(p.related_playbooks, playbookIds, src, 'related_playbooks', 'playbook id');
  checkRefs(p.related_metrics, metricIds, src, 'related_metrics', 'metric id');
  checkRefs(p.related_principles, principleIds, src, 'related_principles', 'principle id');
}

// ── metrics_directory.metrics[].related_metrics ────────────────────────────
for (const m of data.metrics_directory?.metrics ?? []) {
  const src = `metrics[id=${m.id}]`;
  checkRefs(m.related_metrics, metricIds, src, 'related_metrics', 'metric id');
}

// ── playbooks.{stage}[].metrics_to_watch ───────────────────────────────────
for (const stage of ['crawl', 'walk', 'run']) {
  for (const p of data.playbooks?.[stage] ?? []) {
    const src = `playbooks.${stage}[id=${p.id}]`;
    checkRefs(p.metrics_to_watch, metricIds, src, 'metrics_to_watch', 'metric id');
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
if (violations.length > 0) {
  console.error(
    `✗ lean-cs-data.json has ${violations.length} broken cross-reference${violations.length === 1 ? '' : 's'}:\n`
  );
  for (const v of violations) console.error(v);
  console.error('');
  process.exit(1);
}

const totalChecked =
  principleIds.size + metricIds.size + playbookIds.size;
console.log(
  `✓ lean-cs-data.json cross-references resolved cleanly ` +
    `(${principleIds.size} principles, ${metricIds.size} metrics, ${playbookIds.size} playbooks)`
);
