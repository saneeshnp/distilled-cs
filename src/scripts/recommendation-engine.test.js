// Manual test harness for recommendation-engine.js
// Run: node src/scripts/recommendation-engine.test.js
// Verifies composed output for three representative personas.
// Only segmentation_coverage questions have fragments at this stage (pilot domain).

import frameworkData from '../../src/data/lean-cs-data.json' with { type: 'json' };
import {
  composePriorityActions,
  composeStrengths,
  composePlaybookRecommendations,
  composeMetricPriorities,
} from './recommendation-engine.js';

const allPlaybooks = frameworkData.playbooks;
const allMetrics = frameworkData.metrics_directory.metrics;

// ── Persona fixtures ──────────────────────────────────────────────────────────

const personas = [
  {
    name: 'Fresh Crawl — no profile, all score 1',
    profile: {},
    responses: {
      sc_q1: 1, sc_q2: 1, sc_q3: 1,
      jl_q1: 1, jl_q2: 1, jl_q3: 1,
      hr_q1: 1, hr_q2: 1, hr_q3: 1,
      md_q1: 1, md_q2: 1, md_q3: 1,
      ev_q1: 1, ev_q2: 1, ev_q3: 1,
      os_q1: 1, os_q2: 1, os_q3: 1,
      ca_q1: 1, ca_q2: 1, ca_q3: 1,
      ai_q1: 1, ai_q2: 1, ai_q3: 1,
    },
  },
  {
    name: 'Mid-Walk — midmarket, mixed scores 2-3',
    profile: { customer_segment: 'seg_midmarket', company_arr: 'arr_5m_20m', cs_team_size: 'team_1_3' },
    responses: {
      sc_q1: 2, sc_q2: 3, sc_q3: 2,
      jl_q1: 2, jl_q2: 2, jl_q3: 3,
      hr_q1: 3, hr_q2: 2, hr_q3: 2,
      md_q1: 2, md_q2: 3, md_q3: 2,
      ev_q1: 2, ev_q2: 2, ev_q3: 2,
      os_q1: 3, os_q2: 2, os_q3: 3,
      ca_q1: 2, ca_q2: 2, ca_q3: 3,
      ai_q1: 2, ai_q2: 2, ai_q3: 2,
    },
  },
  {
    name: 'High-Fly — enterprise, mostly score 4',
    profile: { customer_segment: 'seg_enterprise', company_arr: 'arr_over_100m', cs_team_size: 'team_10plus' },
    responses: {
      sc_q1: 4, sc_q2: 4, sc_q3: 4,
      jl_q1: 4, jl_q2: 4, jl_q3: 3,
      hr_q1: 4, hr_q2: 4, hr_q3: 4,
      md_q1: 3, md_q2: 4, md_q3: 4,
      ev_q1: 4, ev_q2: 3, ev_q3: 4,
      os_q1: 4, os_q2: 4, os_q3: 4,
      ca_q1: 4, ca_q2: 4, ca_q3: 4,
      ai_q1: 3, ai_q2: 4, ai_q3: 3,
    },
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

for (const persona of personas) {
  console.log(`\n── ${persona.name} ──`);

  const actions = composePriorityActions(persona.profile, persona.responses, frameworkData);
  const strengths = composeStrengths(persona.profile, persona.responses, frameworkData);
  const playbooks = composePlaybookRecommendations(persona.profile, persona.responses, frameworkData, allPlaybooks);
  const metrics = composeMetricPriorities(persona.profile, persona.responses, frameworkData, allMetrics);

  // Priority actions
  console.log('\n  composePriorityActions:');
  check('returns array', Array.isArray(actions));
  check('≤ 3 actions', actions.length <= 3, `got ${actions.length}`);
  check('≥ 1 action', actions.length >= 1, `got ${actions.length}`);
  check('each action has body', actions.every(a => typeof a.body === 'string' && a.body.length > 0));
  if (actions.length > 0) {
    const a = actions[0];
    check('first action has required fields', 'title' in a && 'body' in a && 'source_question_id' in a && 'score_level' in a);
    console.log(`    [0] score=${a.score_level} — ${a.body.slice(0, 80)}…`);
  }
  // Actions should be sorted lowest-score first (nulls from stage fallback last)
  const nonNullScores = actions.filter(a => a.score_level !== null).map(a => a.score_level);
  const sorted = [...nonNullScores].sort((x, y) => x - y);
  check('scored actions in ascending order', JSON.stringify(nonNullScores) === JSON.stringify(sorted));

  // Strengths
  console.log('\n  composeStrengths:');
  check('returns array', Array.isArray(strengths));
  check('≤ 3 strengths', strengths.length <= 3, `got ${strengths.length}`);
  check('each strength has body + source', strengths.every(s => s.body && s.source_question_id));
  if (strengths.length === 0) {
    const highCount = Object.values(persona.responses).filter(v => v >= 3).length;
    // Should be empty when 0 or 1 fragment-backed score-3+ answers exist
    // Only sc_q* have fragments — count how many sc scores are >= 3
    const scHighWithFragments = ['sc_q1','sc_q2','sc_q3'].filter(id => (persona.responses[id] ?? 0) >= 3).length;
    check('empty return justified (< 2 fragment-backed highs)', scHighWithFragments < 2,
      `sc highs with fragments: ${scHighWithFragments}`);
  } else {
    const scores = strengths.map(s => s.score_level ?? '?');
    console.log(`    ${strengths.length} strengths, scores: ${scores.join(', ')}`);
    console.log(`    [0] ${strengths[0].body.slice(0, 80)}…`);
  }

  // Playbooks
  console.log('\n  composePlaybookRecommendations:');
  check('has currentStage array', Array.isArray(playbooks.currentStage));
  check('has comingNext array', Array.isArray(playbooks.comingNext));
  check('has weakestDomain array', Array.isArray(playbooks.weakestDomain));
  check('currentStage non-empty', playbooks.currentStage.length > 0, `got ${playbooks.currentStage.length}`);
  check('weakestDomain ≤ 2', playbooks.weakestDomain.length <= 2);
  // Dedup: weakestDomain IDs should not appear in currentStage
  const currentIds = new Set(playbooks.currentStage.map(p => p.id));
  const dupes = playbooks.weakestDomain.filter(p => currentIds.has(p.id));
  check('weakestDomain deduped from currentStage', dupes.length === 0, `dupes: ${dupes.map(p=>p.id)}`);
  console.log(`    stage=${playbooks.currentStage[0]?.id?.split('-')[0] ?? '?'}, currentStage=${playbooks.currentStage.length}, weakestDomain=${playbooks.weakestDomain.length}, comingNext=${playbooks.comingNext.length}`);

  // Metrics
  console.log('\n  composeMetricPriorities:');
  check('returns all metrics', metrics.length === allMetrics.length);
  check('each entry has metric + relevance', metrics.every(m => m.metric && m.relevance));
  check('valid relevance values', metrics.every(m => ['high','medium','low'].includes(m.relevance)));
  // High priority metrics come before low
  const firstLowIdx = metrics.findIndex(m => m.relevance === 'low');
  const lastHighIdx = [...metrics].reverse().findIndex(m => m.relevance === 'high');
  const allHighBeforeLow = firstLowIdx === -1 || (metrics.length - 1 - lastHighIdx) < firstLowIdx;
  check('high-priority metrics sorted before low', allHighBeforeLow);
  const highCount = metrics.filter(m => m.relevance === 'high').length;
  console.log(`    ${highCount} high-priority, ${metrics.filter(m=>m.relevance==='medium').length} medium, ${metrics.filter(m=>m.relevance==='low').length} low`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed + failed} checks — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
