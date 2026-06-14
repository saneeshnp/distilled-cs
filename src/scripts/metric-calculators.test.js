// Manual test harness for metric-calculators.js
// Run: node src/scripts/metric-calculators.test.js

import { calculators } from './metric-calculators.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const specs = require('../data/metric-calculators.json');

let passed = 0;
let failed = 0;

function assert(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function close(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

// ── Known-value results ───────────────────────────────────────────────────────
// Each metric's `example` (from the JSON) run through its function must equal the
// hand-computed value below. This is the core guard against an arithmetic typo.

const expected = {
  nrr: 105.0,
  grr: 90.0,
  logo_retention: 90.0,
  time_to_value: 45,
  ttfv: 30,
  csat: 85.0,
  adoption_rate: 70.0,
  onboarding_completion: 75.0,
  product_adoption_depth: 40.0,
  stickiness_ratio: 30.0,
  expansion_rate: 12.0,
  cac_payback: 15.0,
  ces: 3.5,
  escalation_rate: 3.0,
  ai_assisted_resolution_rate: 40.0,
  csm_ai_adoption_rate: 75.0,
  clv: 100000,
  nps: 45,
  acv: 30000,
};

console.log('Known-value results (JSON example → function):');
for (const [id, want] of Object.entries(expected)) {
  const fn = calculators[id];
  const spec = specs[id];
  if (!fn || !spec) {
    assert(`${id} has both a function and a spec`, false);
    continue;
  }
  const got = fn(spec.example);
  assert(
    `${id} → ${want}`,
    typeof got === 'number' && Number.isFinite(got) && close(got, want),
    `got ${got}`,
  );
}

// ── JSON ↔ function sync ───────────────────────────────────────────────────────
// Every spec must have a function and vice versa; no orphans in either direction.

console.log('\nJSON ↔ function sync:');
{
  const specIds = Object.keys(specs);
  const fnIds = Object.keys(calculators);

  for (const id of specIds) {
    assert(`spec "${id}" has a function`, typeof calculators[id] === 'function');
  }
  for (const id of fnIds) {
    assert(`function "${id}" has a spec`, !!specs[id]);
  }
  assert(
    `count matches (${specIds.length} specs, ${fnIds.length} functions)`,
    specIds.length === fnIds.length,
  );
  // Every expected-value entry is itself covered, so the known-value block can't
  // silently drift behind a newly added metric.
  for (const id of specIds) {
    assert(`spec "${id}" has a known-value expectation`, id in expected);
  }
}

// ── Spec shape ─────────────────────────────────────────────────────────────────
// Each variable key must appear in the example, and each example key must be a
// declared variable. A function referencing an undeclared key would read
// `undefined` → NaN, which the known-value block already catches; this localizes
// the failure to the spec.

console.log('\nSpec shape:');
for (const [id, spec] of Object.entries(specs)) {
  assert(`${id} has result_unit`, typeof spec.result_unit === 'string');
  assert(
    `${id} has integer result_precision`,
    Number.isInteger(spec.result_precision),
  );
  assert(
    `${id} has a non-empty variables array`,
    Array.isArray(spec.variables) && spec.variables.length > 0,
  );

  const varKeys = (spec.variables || []).map((x) => x.key);
  const exampleKeys = Object.keys(spec.example || {});

  for (const v of spec.variables || []) {
    assert(
      `${id}.${v.key} has label + type`,
      typeof v.label === 'string' && v.label.length > 0 && typeof v.type === 'string',
    );
  }
  assert(
    `${id} example keys match variable keys`,
    varKeys.length === exampleKeys.length &&
      varKeys.every((k) => exampleKeys.includes(k)),
    `vars [${varKeys}] vs example [${exampleKeys}]`,
  );
}

// ── Purity ─────────────────────────────────────────────────────────────────────
// Calling a function must not mutate the input object.

console.log('\nPurity:');
{
  const input = { ...specs.nrr.example };
  const snapshot = JSON.stringify(input);
  calculators.nrr(input);
  assert('nrr does not mutate its input', JSON.stringify(input) === snapshot);
}

// ── Edge cases ───────────────────────────────────────────────────────────────--
// Division-by-zero should surface as a non-finite number (the page guards on
// Number.isFinite) rather than throwing.

console.log('\nEdge cases:');
{
  const r = calculators.csat({ satisfied_responses: 10, total_responses: 0 });
  assert('zero denominator yields non-finite (not a throw)', !Number.isFinite(r));

  const neg = calculators.time_to_value({
    contract_start: '2026-02-15',
    value_milestone: '2026-01-01',
  });
  assert('reversed dates yield a negative day count', neg < 0);
}

// ── Summary ─────────────────────────────────────────────────────────────────--

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
