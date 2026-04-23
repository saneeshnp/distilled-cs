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

// ── Edge case: missing fragments (Task 9.1) ───────────────────────────────────
// Simulates a "transition period" where the JSON has no insight/next_step on any
// option. The engine should fall back cleanly to stage.priority_actions and
// return 0 strengths rather than crashing or showing empty strings.
console.log('\n── Edge case: all fragments missing ──');
{
  // Deep-clone frameworkData and strip all insight/next_step fields
  const stripped = JSON.parse(JSON.stringify(frameworkData));
  for (const domain of stripped.assessment_domains.domains) {
    for (const question of domain.questions) {
      for (const option of question.options) {
        delete option.insight;
        delete option.next_step;
        delete option.next_step_by_segment;
      }
    }
  }
  const midWalkProfile = { customer_segment: 'seg_midmarket', company_arr: 'arr_5m_20m', cs_team_size: 'team_1_3' };
  const midWalkResponses = {
    sc_q1: 2, sc_q2: 3, sc_q3: 2,
    jl_q1: 2, jl_q2: 2, jl_q3: 3,
    hr_q1: 3, hr_q2: 2, hr_q3: 2,
    md_q1: 2, md_q2: 3, md_q3: 2,
    ev_q1: 2, ev_q2: 2, ev_q3: 2,
    os_q1: 3, os_q2: 2, os_q3: 3,
    ca_q1: 2, ca_q2: 2, ca_q3: 3,
    ai_q1: 2, ai_q2: 2, ai_q3: 2,
  };

  const actions = composePriorityActions(midWalkProfile, midWalkResponses, stripped);
  const strengths = composeStrengths(midWalkProfile, midWalkResponses, stripped);

  check('actions: returns array even with no fragments', Array.isArray(actions));
  check('actions: falls back to stage priority_actions (≥ 1)', actions.length >= 1, `got ${actions.length}`);
  check('actions: all entries have non-empty body', actions.every(a => typeof a.body === 'string' && a.body.length > 0));
  check('actions: fallback entry has null source_question_id', actions.some(a => a.source_question_id === null));
  check('strengths: empty array when no insight fragments', strengths.length === 0, `got ${strengths.length}`);
  console.log(`    actions=${actions.length} (stage fallback), strengths=${strengths.length}`);
}

// ── Edge case: caps enforced (Task 9.2) ──────────────────────────────────────
// All score-4 except one score-1 → many strength candidates, few action candidates.
// Engine must cap at ≤3 priority actions and ≤3 strengths.
console.log('\n── Edge case: all score-4 except one score-1 ──');
{
  const nearFlyResponses = {
    sc_q1: 4, sc_q2: 4, sc_q3: 4,
    jl_q1: 4, jl_q2: 4, jl_q3: 4,
    hr_q1: 4, hr_q2: 4, hr_q3: 4,
    md_q1: 4, md_q2: 4, md_q3: 4,
    ev_q1: 4, ev_q2: 4, ev_q3: 4,
    os_q1: 4, os_q2: 4, os_q3: 4,
    ca_q1: 4, ca_q2: 4, ca_q3: 4,
    ai_q1: 1, ai_q2: 4, ai_q3: 4,  // one score-1 to drive a priority action
  };
  const actions = composePriorityActions({}, nearFlyResponses, frameworkData);
  const strengths = composeStrengths({}, nearFlyResponses, frameworkData);

  check('9.2: priority actions ≤ 3', actions.length <= 3, `got ${actions.length}`);
  check('9.2: priority actions ≥ 1', actions.length >= 1, `got ${actions.length}`);
  check('9.2: strengths ≤ 3', strengths.length <= 3, `got ${strengths.length}`);
  check('9.2: strengths ≥ 2 (enough high scores)', strengths.length >= 2, `got ${strengths.length}`);
  check('9.2: strengths from distinct domains', (() => {
    const ids = strengths.map(s => s.source_question_id);
    const domains = ids.map(id => id?.split('_')[0]);
    return new Set(domains).size === domains.length;
  })(), `strengths: ${strengths.map(s=>s.source_question_id).join(', ')}`);
  console.log(`    actions=${actions.length}, strengths=${strengths.length}`);
}

// ── Edge case: missing customer_segment (Task 9.3) ───────────────────────────
// Engine must use next_step only, not next_step_by_segment, and must not crash.
console.log('\n── Edge case: missing customer_segment ──');
{
  const noSegmentProfile = { company_arr: 'arr_10_50m', cs_team_size: 'team_4_10' };
  const midWalkResponses = {
    sc_q1: 2, sc_q2: 3, sc_q3: 2,
    jl_q1: 2, jl_q2: 2, jl_q3: 3,
    hr_q1: 3, hr_q2: 2, hr_q3: 2,
    md_q1: 2, md_q2: 3, md_q3: 2,
    ev_q1: 2, ev_q2: 2, ev_q3: 2,
    os_q1: 3, os_q2: 2, os_q3: 3,
    ca_q1: 2, ca_q2: 2, ca_q3: 3,
    ai_q1: 2, ai_q2: 2, ai_q3: 2,
  };
  const actions = composePriorityActions(noSegmentProfile, midWalkResponses, frameworkData);
  const strengths = composeStrengths(noSegmentProfile, midWalkResponses, frameworkData);

  check('9.3: actions returns array', Array.isArray(actions));
  check('9.3: actions ≥ 1', actions.length >= 1, `got ${actions.length}`);
  check('9.3: all action bodies are non-empty strings', actions.every(a => typeof a.body === 'string' && a.body.length > 0));
  // Confirm no segment-specific text leaked in (sc_q1 score-2 has no next_step_by_segment, safe)
  // Key check: no action body is undefined/null
  check('9.3: no null/undefined bodies', actions.every(a => a.body != null));
  check('9.3: strengths returns array', Array.isArray(strengths));
  console.log(`    actions=${actions.length}, strengths=${strengths.length}`);
  if (actions[0]) console.log(`    [0] ${actions[0].body.slice(0, 80)}…`);
}

// ── Edge case: response score has no matching JSON option (Task 9.4) ─────────
// Simulates a saved response whose numeric score doesn't match any option in the
// current JSON (e.g. old data with score=5, or a question removed from the JSON).
// Engine must skip it and not crash.
console.log('\n── Edge case: responses with unknown/out-of-range scores ──');
{
  const weirdResponses = {
    sc_q1: 5,  // no option with score=5 exists
    sc_q2: 0,  // no option with score=0 exists
    sc_q3: 2,  // valid
    jl_q1: 2, jl_q2: 2, jl_q3: 2,
    hr_q1: 2, hr_q2: 2, hr_q3: 2,
    md_q1: 2, md_q2: 2, md_q3: 2,
    ev_q1: 2, ev_q2: 2, ev_q3: 2,
    os_q1: 2, os_q2: 2, os_q3: 2,
    ca_q1: 2, ca_q2: 2, ca_q3: 2,
    ai_q1: 2, ai_q2: 2, ai_q3: 2,
    nonexistent_q: 3,  // question ID not in JSON — silently ignored
  };
  let actions, strengths;
  try {
    actions = composePriorityActions({}, weirdResponses, frameworkData);
    strengths = composeStrengths({}, weirdResponses, frameworkData);
    check('9.4: no crash on unknown scores', true);
  } catch (e) {
    check('9.4: no crash on unknown scores', false, e.message);
    actions = []; strengths = [];
  }
  check('9.4: actions returns array', Array.isArray(actions));
  check('9.4: actions ≥ 1 (stage fallback fires)', actions.length >= 1, `got ${actions.length}`);
  check('9.4: all action bodies non-empty', actions.every(a => typeof a.body === 'string' && a.body.length > 0));
  check('9.4: strengths returns array', Array.isArray(strengths));
  console.log(`    actions=${actions.length}, strengths=${strengths.length}`);
}

// ── Purity audit (Task 9.5) ───────────────────────────────────────────────────
// Composition functions must be deterministic (same inputs → same outputs)
// and must not mutate their input arguments.
console.log('\n── Purity: determinism and no input mutation ──');
{
  const profile = { customer_segment: 'seg_enterprise', company_arr: 'arr_over_100m', cs_team_size: 'team_10plus' };
  const responses = {
    sc_q1: 4, sc_q2: 3, sc_q3: 4,
    jl_q1: 4, jl_q2: 4, jl_q3: 3,
    hr_q1: 4, hr_q2: 4, hr_q3: 4,
    md_q1: 3, md_q2: 4, md_q3: 4,
    ev_q1: 4, ev_q2: 3, ev_q3: 4,
    os_q1: 4, os_q2: 4, os_q3: 4,
    ca_q1: 4, ca_q2: 4, ca_q3: 4,
    ai_q1: 1, ai_q2: 2, ai_q3: 3,
  };

  // Snapshot inputs before calling
  const profileSnap = JSON.stringify(profile);
  const responsesSnap = JSON.stringify(responses);
  const dataSnap = JSON.stringify(frameworkData.meta); // spot-check: meta not mutated

  const r1 = composePriorityActions(profile, responses, frameworkData);
  const r2 = composePriorityActions(profile, responses, frameworkData);
  const s1 = composeStrengths(profile, responses, frameworkData);
  const s2 = composeStrengths(profile, responses, frameworkData);

  check('9.5: composePriorityActions is deterministic', JSON.stringify(r1) === JSON.stringify(r2));
  check('9.5: composeStrengths is deterministic', JSON.stringify(s1) === JSON.stringify(s2));
  check('9.5: profile not mutated', JSON.stringify(profile) === profileSnap);
  check('9.5: responses not mutated', JSON.stringify(responses) === responsesSnap);
  check('9.5: frameworkData.meta not mutated', JSON.stringify(frameworkData.meta) === dataSnap);
  console.log(`    actions run 1=${r1.length}, run 2=${r2.length} — identical: ${JSON.stringify(r1)===JSON.stringify(r2)}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed + failed} checks — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
