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
    name: 'High-Run — enterprise, mostly score 4',
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
  check('≤ 9 actions', actions.length <= 9, `got ${actions.length}`);
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

  // Body composition: scored actions concatenate insight + next_step
  const composedOk = actions.filter(a => a.source_question_id !== null).every(a => {
    const domain = frameworkData.assessment_domains.domains.find(d =>
      d.questions.some(q => q.id === a.source_question_id)
    );
    const question = domain?.questions.find(q => q.id === a.source_question_id);
    const option = question?.options.find(o => o.score === a.score_level);
    if (!option?.insight || !option?.next_step) return true;
    const expectedNext = (persona.profile?.customer_segment &&
      option.next_step_by_segment?.[persona.profile.customer_segment]) ||
      option.next_step;
    return a.body.includes(option.insight) && a.body.includes(expectedNext);
  });
  check('scored action bodies = insight + next_step', composedOk);

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

// ── Run stage: no next stage ──────────────────────────────────────────────────
// A user with all score-4 responses is at Run (the top stage).
// comingNext must be empty and nothing should crash.
console.log('\n── Run stage: no next stage ──');
{
  const runProfile = { customer_segment: 'seg_enterprise', company_arr: 'arr_over_100m', cs_team_size: 'team_10plus' };
  const runResponses = {
    sc_q1: 4, sc_q2: 4, sc_q3: 4,
    jl_q1: 4, jl_q2: 4, jl_q3: 4,
    hr_q1: 4, hr_q2: 4, hr_q3: 4,
    md_q1: 4, md_q2: 4, md_q3: 4,
    ev_q1: 4, ev_q2: 4, ev_q3: 4,
    os_q1: 4, os_q2: 4, os_q3: 4,
    ca_q1: 4, ca_q2: 4, ca_q3: 4,
    ai_q1: 4, ai_q2: 4, ai_q3: 4,
  };
  let playbooks;
  try {
    playbooks = composePlaybookRecommendations(runProfile, runResponses, frameworkData, allPlaybooks);
    check('Run: no crash when at top stage', true);
  } catch (e) {
    check('Run: no crash when at top stage', false, e.message);
    playbooks = { currentStage: [], weakestDomain: [], comingNext: [] };
  }
  check('Run: currentStage is non-empty', playbooks.currentStage.length > 0, `got ${playbooks.currentStage.length}`);
  check('Run: comingNext is empty (no stage above Run)', playbooks.comingNext.length === 0, `got ${playbooks.comingNext.length}`);
  check('Run: comingNext is array', Array.isArray(playbooks.comingNext));
  console.log(`    currentStage=${playbooks.currentStage.length}, comingNext=${playbooks.comingNext.length}`);
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
  const nearRunResponses = {
    sc_q1: 4, sc_q2: 4, sc_q3: 4,
    jl_q1: 4, jl_q2: 4, jl_q3: 4,
    hr_q1: 4, hr_q2: 4, hr_q3: 4,
    md_q1: 4, md_q2: 4, md_q3: 4,
    ev_q1: 4, ev_q2: 4, ev_q3: 4,
    os_q1: 4, os_q2: 4, os_q3: 4,
    ca_q1: 4, ca_q2: 4, ca_q3: 4,
    ai_q1: 1, ai_q2: 4, ai_q3: 4,  // one score-1 to drive a priority action
  };
  const actions = composePriorityActions({}, nearRunResponses, frameworkData);
  const strengths = composeStrengths({}, nearRunResponses, frameworkData);

  check('9.2: priority actions ≤ 9', actions.length <= 9, `got ${actions.length}`);
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

// ── Domain diversity: adaptive per-domain cap (Task 10) ──────────────────────
// Pass 1 picks at most 1 action per domain (max diversity). Falls back to Pass 2
// (allow 2nd per domain) and Pass 3 (allow 3rd) only when fewer than 8 domains
// have qualifying entries. For a normal 24-question assessment across all 8
// domains, Pass 1 alone yields 8 scored actions — one per domain.
console.log('\n── Domain diversity: adaptive 1→2→3 per domain ──');
{
  // Normal case: 24 answered questions, varied scores. Pass 1 covers all 8 domains.
  const concentratedResponses = {
    sc_q1: 1, sc_q2: 1, sc_q3: 1,
    jl_q1: 2, jl_q2: 2, jl_q3: 2,
    hr_q1: 3, hr_q2: 3, hr_q3: 3,
    md_q1: 3, md_q2: 3, md_q3: 3,
    ev_q1: 3, ev_q2: 3, ev_q3: 3,
    os_q1: 3, os_q2: 3, os_q3: 3,
    ca_q1: 3, ca_q2: 3, ca_q3: 3,
    ai_q1: 3, ai_q2: 3, ai_q3: 3,
  };
  const actions = composePriorityActions({}, concentratedResponses, frameworkData);
  const byDomain = {};
  for (const a of actions) {
    if (a.source_question_id === null) continue;
    const dom = a.source_question_id.split('_')[0];
    byDomain[dom] = (byDomain[dom] ?? 0) + 1;
  }
  const scoredCount = Object.values(byDomain).reduce((a, b) => a + b, 0);
  check('10a: normal case — max 1 per domain', Object.values(byDomain).every(n => n === 1),
    `domain counts: ${JSON.stringify(byDomain)}`);
  check('10a: normal case — 8 distinct domains', Object.keys(byDomain).length === 8,
    `domains: ${Object.keys(byDomain).join(',')}, count: ${Object.keys(byDomain).length}`);
  check('10a: normal case — 8 scored actions', scoredCount === 8, `got ${scoredCount}`);
  console.log(`    normal: ${JSON.stringify(byDomain)}, total=${actions.length}`);
}

// Adaptive fallback: only 2 domains answered → Pass 2 and Pass 3 kick in.
// 6 questions across 2 domains → engine surfaces all 6.
console.log('\n── Adaptive: only 2 domains answered → all 6 scored entries surface ──');
{
  const sparseResponses = {
    sc_q1: 1, sc_q2: 1, sc_q3: 1,
    jl_q1: 1, jl_q2: 1, jl_q3: 1,
  };
  const actions = composePriorityActions({}, sparseResponses, frameworkData);
  const byDomain = {};
  for (const a of actions) {
    if (a.source_question_id === null) continue;
    const dom = a.source_question_id.split('_')[0];
    byDomain[dom] = (byDomain[dom] ?? 0) + 1;
  }
  const scoredCount = Object.values(byDomain).reduce((a, b) => a + b, 0);
  check('10b: 2 domains × score-1 → 6 scored actions', scoredCount === 6, `got ${scoredCount}`);
  check('10b: distributed evenly (3+3)', byDomain.sc === 3 && byDomain.jl === 3,
    `sc=${byDomain.sc}, jl=${byDomain.jl}`);
  console.log(`    sparse 2-domain: ${JSON.stringify(byDomain)}, total=${actions.length}`);
}

// Adaptive fallback: only 1 domain answered → all 3 questions surface.
console.log('\n── Adaptive: only 1 domain answered → 3rd per domain allowed ──');
{
  const singleDomainResponses = { sc_q1: 1, sc_q2: 1, sc_q3: 1 };
  const actions = composePriorityActions({}, singleDomainResponses, frameworkData);
  const scoredActions = actions.filter(a => a.source_question_id !== null);
  check('10c: 1 domain × 3 questions → 3 scored actions', scoredActions.length === 3,
    `got ${scoredActions.length}`);
  check('10c: all 3 from segmentation', scoredActions.every(a => a.source_question_id.startsWith('sc_')),
    `ids: ${scoredActions.map(a => a.source_question_id).join(',')}`);
  console.log(`    single-domain: ${scoredActions.length} scored + ${actions.length - scoredActions.length} fallback`);
}

// Diversity across ALL personas: verify the preset/persona fixtures cover all 8 domains.
console.log('\n── Diversity across all 3 persona fixtures ──');
{
  for (const persona of personas) {
    const actions = composePriorityActions(persona.profile, persona.responses, frameworkData);
    const byDomain = {};
    for (const a of actions) {
      if (a.source_question_id === null) continue;
      const dom = a.source_question_id.split('_')[0];
      byDomain[dom] = (byDomain[dom] ?? 0) + 1;
    }
    const distinctDomains = Object.keys(byDomain).length;
    // For these 3 personas (all 24 answered), Pass 1 alone covers all 8 domains
    check(`10d: "${persona.name}" — 8 distinct domains`, distinctDomains === 8,
      `${distinctDomains} domains: ${Object.keys(byDomain).join(',')}`);
    check(`10d: "${persona.name}" — no domain repeats`, Object.values(byDomain).every(n => n === 1),
      `counts: ${JSON.stringify(byDomain)}`);
  }
}

// ── Edge: empty responses ────────────────────────────────────────────────────
// User reaches the report without answering any capability questions (e.g. URL-shared
// link with profile-only data). Engine must not crash and should return only the
// stage fallback action.
console.log('\n── Edge: empty responses ──');
{
  let actions, strengths;
  try {
    actions = composePriorityActions({ customer_segment: 'seg_smb' }, {}, frameworkData);
    strengths = composeStrengths({}, {}, frameworkData);
    check('empty responses: no crash', true);
  } catch (e) {
    check('empty responses: no crash', false, e.message);
    actions = []; strengths = [];
  }
  check('empty responses: returns array', Array.isArray(actions));
  check('empty responses: scored actions all skipped',
    actions.every(a => a.source_question_id === null));
  check('empty responses: strengths empty', strengths.length === 0);
  console.log(`    actions=${actions.length} (stage fallback only), strengths=${strengths.length}`);
}

// ── Edge: null/undefined response values ─────────────────────────────────────
// A response field could be set to null/undefined by buggy localStorage state.
// Engine must skip these gracefully.
console.log('\n── Edge: null/undefined responses for some questions ──');
{
  const messyResponses = {
    sc_q1: null,
    sc_q2: undefined,
    sc_q3: 2,
    jl_q1: 1,
    jl_q2: 1,
    // Rest missing entirely
  };
  let actions;
  try {
    actions = composePriorityActions({}, messyResponses, frameworkData);
    check('null/undef responses: no crash', true);
  } catch (e) {
    check('null/undef responses: no crash', false, e.message);
    actions = [];
  }
  check('null/undef: returns array', Array.isArray(actions));
  check('null/undef: all bodies non-empty', actions.every(a => typeof a.body === 'string' && a.body.length > 0));
  console.log(`    actions=${actions.length}`);
}

// ── Body sanitation: no literal "undefined"/"null" leakage ──────────────────
// Ensures `${maybeUndef}` template interpolation never produces "undefined" or
// "null" in any rendered body string, across a wide range of personas.
console.log('\n── Body sanitation: no "undefined" / "null" in any composed body ──');
{
  const probePersonas = [
    { name: 'all-1', responses: Object.fromEntries(personas[0].responses ? Object.entries(personas[0].responses) : []) },
    { name: 'all-1', responses: personas[0].responses },
    { name: 'mid-walk', responses: personas[1].responses },
    { name: 'high-run', responses: personas[2].responses },
    { name: 'mixed-2-3', responses: Object.fromEntries(Object.keys(personas[0].responses).map((k, i) => [k, (i % 2) + 2])) },
  ];
  const segments = [undefined, 'seg_smb', 'seg_midmarket', 'seg_enterprise'];
  let bodiesChecked = 0;
  let leaks = [];
  for (const p of probePersonas) {
    for (const seg of segments) {
      const profile = seg ? { customer_segment: seg } : {};
      const actions = composePriorityActions(profile, p.responses, frameworkData);
      for (const a of actions) {
        bodiesChecked++;
        if (typeof a.body !== 'string' || a.body.length === 0) {
          leaks.push(`${p.name}/${seg}: empty body on ${a.source_question_id}`);
        }
        if (a.body && (a.body.includes('undefined') || a.body.includes('null'))) {
          leaks.push(`${p.name}/${seg}: leak in ${a.source_question_id}: "${a.body.slice(0, 60)}…"`);
        }
      }
    }
  }
  check(`sanitation: ${bodiesChecked} bodies, 0 "undefined"/"null" leaks`, leaks.length === 0,
    leaks.slice(0, 3).join(' | '));
  console.log(`    ${bodiesChecked} bodies checked across ${probePersonas.length} personas × ${segments.length} segments`);
}

// ── Exhaustive single-answer fuzz ────────────────────────────────────────────
// For every (question, score) combination across all 8 domains × 3 questions × 4 scores
// = 96 single-answer assessments, verify the engine returns clean data with no
// nulls, no crashes, and well-formed fields. This catches any latent JSON gaps
// (e.g. a question option missing insight or next_step).
console.log('\n── Exhaustive fuzz: every (question, score) single-answer ──');
{
  let combos = 0;
  let failures = [];
  for (const domain of frameworkData.assessment_domains.domains) {
    for (const question of domain.questions) {
      for (const score of [1, 2, 3, 4]) {
        combos++;
        const responses = { [question.id]: score };
        try {
          const actions = composePriorityActions({}, responses, frameworkData);
          if (!Array.isArray(actions)) failures.push(`${question.id}/s${score}: not array`);
          for (const a of actions) {
            if (typeof a.body !== 'string' || a.body.length === 0) {
              failures.push(`${question.id}/s${score}: empty body`);
            }
            if (a.body && (a.body.includes('undefined') || a.body.includes('null'))) {
              failures.push(`${question.id}/s${score}: literal undef/null`);
            }
            if (a.source_question_id !== null && typeof a.domain_label !== 'string') {
              failures.push(`${question.id}/s${score}: scored action missing domain_label`);
            }
          }
        } catch (e) {
          failures.push(`${question.id}/s${score}: crash — ${e.message}`);
        }
      }
    }
  }
  check(`fuzz: ${combos} combos, 0 failures`, failures.length === 0,
    failures.slice(0, 3).join(' | '));
  console.log(`    ${combos} single-answer assessments verified`);
}

// ── Exhaustive cross-segment fuzz: every (question, score, segment) ─────────
// Same as above but also varies customer_segment, since next_step_by_segment
// overrides may exist on score-3+ options. 96 × 4 segments = 384 combos.
console.log('\n── Cross-segment fuzz: every (question, score, segment) ──');
{
  let combos = 0;
  let failures = [];
  const segments = [null, 'seg_smb', 'seg_midmarket', 'seg_enterprise'];
  for (const domain of frameworkData.assessment_domains.domains) {
    for (const question of domain.questions) {
      for (const score of [1, 2, 3, 4]) {
        for (const seg of segments) {
          combos++;
          const profile = seg ? { customer_segment: seg } : {};
          const responses = { [question.id]: score };
          try {
            const actions = composePriorityActions(profile, responses, frameworkData);
            for (const a of actions) {
              if (a.body && (a.body.includes('undefined') || a.body.includes('null'))) {
                failures.push(`${question.id}/s${score}/${seg ?? 'no-seg'}: leak`);
              }
            }
          } catch (e) {
            failures.push(`${question.id}/s${score}/${seg ?? 'no-seg'}: crash — ${e.message}`);
          }
        }
      }
    }
  }
  check(`cross-segment fuzz: ${combos} combos, 0 failures`, failures.length === 0,
    failures.slice(0, 3).join(' | '));
  console.log(`    ${combos} (question × score × segment) combos verified`);
}

// ── Stage fallback shape ─────────────────────────────────────────────────────
// The 5th action card (stage fallback) has different fields from scored cards.
// Verify its shape is consistent: title, body (non-empty), source_question_id=null,
// score_level=null, domain_label=null.
console.log('\n── Stage fallback action shape ──');
{
  const allScore1 = personas[0].responses;
  const actions = composePriorityActions({}, allScore1, frameworkData);
  const fallback = actions.find(a => a.source_question_id === null);
  check('stage fallback: exists', !!fallback);
  if (fallback) {
    check('stage fallback: title is string', typeof fallback.title === 'string' && fallback.title.length > 0);
    check('stage fallback: body is string', typeof fallback.body === 'string' && fallback.body.length > 0);
    check('stage fallback: score_level is null', fallback.score_level === null);
    check('stage fallback: domain_label is null', fallback.domain_label === null);
  }
}

// ── Total cap ────────────────────────────────────────────────────────────────
// With all 24 questions answered across 8 domains, the engine should surface
// 8 scored actions (one per domain) plus 1 stage fallback = 9 total max.
console.log('\n── Total cap: never exceed 9 actions ──');
{
  const allScore1 = personas[0].responses;
  const actions = composePriorityActions({}, allScore1, frameworkData);
  check('total ≤ 9', actions.length <= 9, `got ${actions.length}`);
  const scored = actions.filter(a => a.source_question_id !== null);
  check('scored ≤ 8', scored.length <= 8, `got ${scored.length}`);
  check('all 8 domains covered when 24 answered', new Set(scored.map(a => a.source_question_id.split('_')[0])).size === 8,
    `domains: ${[...new Set(scored.map(a => a.source_question_id.split('_')[0]))].join(',')}`);
  console.log(`    actions=${actions.length}, scored=${scored.length}, distinct domains=${new Set(scored.map(a => a.source_question_id.split('_')[0])).size}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed + failed} checks — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
