#!/usr/bin/env node
/*
 * validate-roadmap.mjs
 * ────────────────────
 * Schema check on `src/data/roadmap.json`. Catches:
 *   - Missing or malformed `last_updated`
 *   - Items with status outside the allowed set
 *   - `status: "shipped"` items missing a `shipped` date
 *   - Malformed ISO dates (anything that doesn't parse)
 *   - Required fields (title, description, status) missing or empty
 *   - Items with `shipped` date but non-"shipped" status (likely mistake)
 *
 * Collects all violations before exiting.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataPath = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../src/data/roadmap.json'
);
const roadmap = JSON.parse(readFileSync(dataPath, 'utf8'));

const ALLOWED_STATUSES = new Set(['planned', 'exploring', 'in-progress', 'shipped']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const violations = [];

function isValidIsoDate(s) {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime());
}

// ── Top-level checks ───────────────────────────────────────────────────────
if (!roadmap.last_updated) {
  violations.push('  Missing top-level `last_updated` field');
} else if (!isValidIsoDate(roadmap.last_updated)) {
  violations.push(
    `  Top-level \`last_updated\` is not a valid YYYY-MM-DD date: "${roadmap.last_updated}"`
  );
}

if (!Array.isArray(roadmap.items)) {
  violations.push('  Top-level `items` is missing or not an array');
}

// ── Per-item checks ────────────────────────────────────────────────────────
for (const [idx, item] of (roadmap.items ?? []).entries()) {
  const src = `items[${idx}] "${item.title ?? '<no title>'}"`;

  if (typeof item.title !== 'string' || item.title.trim() === '') {
    violations.push(`  ${src}: missing or empty \`title\``);
  }
  if (typeof item.description !== 'string' || item.description.trim() === '') {
    violations.push(`  ${src}: missing or empty \`description\``);
  }
  if (!ALLOWED_STATUSES.has(item.status)) {
    violations.push(
      `  ${src}: invalid status "${item.status}" — must be one of ${[...ALLOWED_STATUSES].join(', ')}`
    );
  }

  // Shipped items must have a `shipped` ISO date.
  if (item.status === 'shipped') {
    if (!item.shipped) {
      violations.push(`  ${src}: status is "shipped" but no \`shipped\` date set`);
    } else if (!isValidIsoDate(item.shipped)) {
      violations.push(
        `  ${src}: \`shipped\` is not a valid YYYY-MM-DD date: "${item.shipped}"`
      );
    }
  }

  // Non-shipped items shouldn't carry a `shipped` date (probably a mistake).
  if (item.status !== 'shipped' && item.shipped) {
    violations.push(
      `  ${src}: has \`shipped\` date but status is "${item.status}" — drop the date or flip the status`
    );
  }

  // Links shape check.
  if (item.links) {
    if (!Array.isArray(item.links)) {
      violations.push(`  ${src}: \`links\` must be an array`);
    } else {
      for (const [i, link] of item.links.entries()) {
        if (!link || typeof link.url !== 'string' || typeof link.label !== 'string') {
          violations.push(
            `  ${src}: links[${i}] must have string \`label\` and \`url\``
          );
        }
      }
    }
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
if (violations.length > 0) {
  console.error(
    `✗ roadmap.json has ${violations.length} schema violation${violations.length === 1 ? '' : 's'}:\n`
  );
  for (const v of violations) console.error(v);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ roadmap.json schema valid (${roadmap.items.length} items, last_updated ${roadmap.last_updated})`
);
