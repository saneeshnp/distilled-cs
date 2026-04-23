// Recommendation Engine — composes personalized report sections from user responses + profile.
// Pure functions only: no DOM access, no side effects, no imports from context-manager.
// Callers pass frameworkData (lean-cs-data.json) and allPlaybooks (frameworkData.playbooks).

// Compose the priority actions section of the report.
// Returns up to 3 entries: the 2 lowest-scoring response-specific next steps,
// augmented by 1 stage-level action from the JSON when it adds something new.
export function composePriorityActions(profile, responses, frameworkData) {
  const domains = frameworkData.assessment_domains.domains;
  const stage = _getUserStage(responses, frameworkData);
  const stageData = frameworkData.maturity_stages.stages.find(s => s.id === stage);
  const segment = profile?.customer_segment;
  const deprioritize = _buildDeprioritizeSet(profile, frameworkData);

  const scoredEntries = [];
  for (const domain of domains) {
    for (const question of domain.questions) {
      const userScore = responses?.[question.id];
      if (typeof userScore !== 'number') continue;
      const option = question.options.find(o => o.score === userScore);
      if (!option?.next_step) continue;
      // Skip options whose tags overlap with the user's profile deprioritize set
      if (deprioritize.size > 0 && (option.tags ?? []).some(t => deprioritize.has(t))) continue;
      scoredEntries.push({ domain, question, option, userScore, segment });
    }
  }

  // Lowest scores first; ties broken by higher domain weight (more important domain = higher priority)
  scoredEntries.sort((a, b) =>
    a.userScore - b.userScore ||
    (b.domain.weight ?? 1) - (a.domain.weight ?? 1)
  );

  const actions = scoredEntries.slice(0, 2).map(entry => {
    const body =
      (entry.segment && entry.option.next_step_by_segment?.[entry.segment]) ||
      entry.option.next_step;
    return {
      title: entry.option.label,
      body,
      source_question_id: entry.question.id,
      score_level: entry.userScore,
    };
  });

  // Add 1 stage-level action that isn't already represented and isn't deprioritized
  if (stageData?.priority_actions?.length) {
    const usedBodies = new Set(actions.map(a => a.body));
    const fallback = stageData.priority_actions.find(pa =>
      !usedBodies.has(pa.text) &&
      !(deprioritize.size > 0 && (pa.tags ?? []).some(t => deprioritize.has(t)))
    );
    if (fallback) {
      actions.push({
        title: fallback.text,
        body: fallback.why_it_matters,
        source_question_id: null,
        score_level: null,
        estimated_time: fallback.estimated_time ?? null,
      });
    }
  }

  return actions.slice(0, 3);
}

// Compose the strengths section: up to 3 insights from the user's highest-scoring responses.
// Returns an empty array when fewer than 2 score-3+ responses have insight text,
// so callers can omit the section rather than show a thin list.
export function composeStrengths(profile, responses, frameworkData) {
  const domains = frameworkData.assessment_domains.domains;
  const highEntries = [];

  for (const domain of domains) {
    for (const question of domain.questions) {
      const userScore = responses?.[question.id];
      if (typeof userScore !== 'number' || userScore < 3) continue;
      const option = question.options.find(o => o.score === userScore);
      if (!option?.insight) continue;
      highEntries.push({ score: userScore, body: option.insight, source_question_id: question.id, domain_id: domain.id });
    }
  }

  if (highEntries.length < 2) return [];

  // Highest score first; stable — JSON domain order breaks ties
  highEntries.sort((a, b) => b.score - a.score);

  // At most 1 per domain so the section shows breadth, not just the user's best domain repeated
  const seenDomains = new Set();
  const result = [];
  for (const entry of highEntries) {
    if (seenDomains.has(entry.domain_id)) continue;
    seenDomains.add(entry.domain_id);
    result.push({ score: entry.score, body: entry.body, source_question_id: entry.source_question_id });
    if (result.length === 3) break;
  }

  return result.length >= 2 ? result : [];
}

// Compose playbook recommendations into three groups:
//   currentStage — playbooks for the user's maturity stage
//   weakestDomain — up to 2 playbooks targeting the user's lowest-score domain (deduped)
//   comingNext — playbooks for the next stage up
export function composePlaybookRecommendations(profile, responses, frameworkData, allPlaybooks) {
  const stage = _getUserStage(responses, frameworkData);
  const stageOrder = frameworkData.maturity_stages.stages.map(s => s.id);
  const stageIndex = stageOrder.indexOf(stage);
  const nextStage = stageIndex >= 0 ? (stageOrder[stageIndex + 1] ?? null) : null;

  const currentStage = allPlaybooks[stage] ?? [];
  const comingNext = nextStage ? (allPlaybooks[nextStage] ?? []) : [];

  // Weakest domain: surface playbooks from a lower implied stage when the user has
  // a meaningful gap (weakest domain stage < overall stage).
  // Spec intent: filter by metrics_to_watch overlap with domain-associated metrics.
  // That requires a domain→metric map not yet in the JSON — upgrade once Task 5
  // adds associated_metrics to each domain. Until then, stage-based heuristic.
  const weakestDomainId = _getWeakestDomain(responses, frameworkData);
  let weakestDomain = [];
  if (weakestDomainId) {
    const domainScore = _getDomainScore(weakestDomainId, responses, frameworkData);
    if (domainScore !== null) {
      const domainStage = _scoreToStage(domainScore, frameworkData);
      // Only surface when there is a genuine gap — weakest domain lags overall stage.
      // If domainStage === stage, dedup removes all candidates, so skip cleanly.
      if (domainStage !== stage) {
        const currentIds = new Set(currentStage.map(p => p.id));
        weakestDomain = (allPlaybooks[domainStage] ?? [])
          .filter(p => !currentIds.has(p.id))
          .slice(0, 2);
      }
    }
  }

  return { currentStage, weakestDomain, comingNext };
}

// Compose metric priorities: returns all metrics annotated with relevance and segment benchmark.
// Metrics with 'high' stage priority come first; within that, ties broken by id order.
// Callers use the relevance field to group into high/medium/low sections.
// Spec intent: also boost metrics tied to the user's weakest domain. Requires
// associated_metrics on each domain — not yet in JSON. Upgrade in Task 5.
export function composeMetricPriorities(profile, responses, frameworkData, allMetrics) {
  const stage = _getUserStage(responses, frameworkData);
  const segment = profile?.customer_segment;
  const arr = profile?.company_arr;

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

  const annotated = allMetrics.map(metric => {
    const relevance = metric.priority_by_stage?.[stage] ?? 'low';
    const benchmark = _getSegmentBenchmark(metric, segment, arr);
    return { metric, relevance, segmentBenchmark: benchmark };
  });

  annotated.sort((a, b) =>
    (PRIORITY_ORDER[a.relevance] ?? 2) - (PRIORITY_ORDER[b.relevance] ?? 2)
  );

  return annotated;
}

// --- Private helpers ---

// Builds a Set of deprioritize tag identifiers from all applicable profile dimensions.
// Options or stage actions whose tags overlap this set are skipped in composePriorityActions.
function _buildDeprioritizeSet(profile, frameworkData) {
  const mods = frameworkData.profile_modifiers;
  const set = new Set();
  if (!mods || !profile) return set;
  for (const tag of mods.customer_segment?.[profile.customer_segment]?.deprioritizes ?? []) set.add(tag);
  for (const tag of mods.company_arr?.[profile.company_arr]?.deprioritizes ?? []) set.add(tag);
  for (const tag of mods.cs_team_size?.[profile.cs_team_size]?.deprioritizes ?? []) set.add(tag);
  return set;
}

function _getUserStage(responses, frameworkData) {
  const domains = frameworkData.assessment_domains.domains;
  const stages = frameworkData.maturity_stages.stages;
  const domainAvgs = [];

  for (const domain of domains) {
    const answered = domain.questions.filter(q => typeof responses?.[q.id] === 'number');
    if (answered.length === 0) continue;
    const sum = answered.reduce((acc, q) => acc + responses[q.id], 0);
    domainAvgs.push(sum / answered.length);
  }

  if (domainAvgs.length === 0) return stages[0].id;
  const overall = domainAvgs.reduce((a, b) => a + b, 0) / domainAvgs.length;
  return _scoreToStage(overall, frameworkData);
}

function _getWeakestDomain(responses, frameworkData) {
  const domains = frameworkData.assessment_domains.domains;
  let weakestId = null;
  let lowestAvg = Infinity;

  for (const domain of domains) {
    const answered = domain.questions.filter(q => typeof responses?.[q.id] === 'number');
    if (answered.length === 0) continue;
    const avg = answered.reduce((acc, q) => acc + responses[q.id], 0) / answered.length;
    if (avg < lowestAvg) { lowestAvg = avg; weakestId = domain.id; }
  }

  return weakestId;
}

function _getDomainScore(domainId, responses, frameworkData) {
  const domain = frameworkData.assessment_domains.domains.find(d => d.id === domainId);
  if (!domain) return null;
  const answered = domain.questions.filter(q => typeof responses?.[q.id] === 'number');
  if (answered.length === 0) return null;
  return answered.reduce((acc, q) => acc + responses[q.id], 0) / answered.length;
}

function _scoreToStage(score, frameworkData) {
  const stages = frameworkData.maturity_stages.stages;
  let chosen = stages[0];
  for (const s of stages) {
    if (score >= s.score_range[0]) chosen = s;
  }
  return chosen.id;
}

function _getSegmentBenchmark(metric, segment, arr) {
  const ctx = metric.benchmarks_by_context;
  if (!ctx) return null;
  return ctx[segment] ?? ctx[arr] ?? null;
}
