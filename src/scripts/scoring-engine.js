// Scoring Engine — calculates maturity scores from assessment responses
// All scores are on a 1.0–4.0 scale.

import frameworkData from '../data/lean-cs-data.json';

const domains = frameworkData.assessment_domains.domains;
const stages = frameworkData.maturity_stages.stages;

// Calculate score for a single domain from question responses
// responses: { "sc_q1": 2, "sc_q2": 3, "sc_q3": 2 }
export function calculateDomainScore(domainId, responses) {
  const domain = domains.find(d => d.id === domainId);
  if (!domain) return null;

  const questionIds = domain.questions.map(q => q.id);
  const answered = questionIds.filter(id => typeof responses[id] === 'number');

  if (answered.length === 0) return null;

  const sum = answered.reduce((acc, id) => acc + responses[id], 0);
  return Math.round((sum / answered.length) * 100) / 100;
}

// Calculate all domain scores at once
// allResponses: { "sc_q1": 2, "sc_q2": 3, ..., "os_q3": 4 }
export function calculateAllDomainScores(allResponses) {
  const scores = {};
  for (const domain of domains) {
    const score = calculateDomainScore(domain.id, allResponses);
    if (score !== null) {
      scores[domain.id] = score;
    }
  }
  return scores;
}

// Calculate overall maturity score (average of all domain scores)
export function calculateOverallScore(domainScores) {
  const values = Object.values(domainScores).filter(v => typeof v === 'number');
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 100) / 100;
}

// Determine maturity stage from overall score.
// Stages are selected by the highest min threshold the score has passed.
// score_range[1] is display-only (shown on the model page); not used for logic,
// so scores between display ranges (e.g. 1.75) still map to a valid stage.
// Assumes `stages` is ordered ascending by score_range[0].
export function determineStage(overallScore) {
  if (typeof overallScore !== 'number') return null;
  let chosen = stages[0];
  for (const stage of stages) {
    if (overallScore >= stage.score_range[0]) chosen = stage;
  }
  return chosen.id;
}

// Generate full assessment result object
export function generateAssessmentResult(profile, responses) {
  const domainScores = calculateAllDomainScores(responses);
  const overallScore = calculateOverallScore(domainScores);
  const stage = determineStage(overallScore);

  // Find strongest and weakest domains
  const entries = Object.entries(domainScores);
  let strongest = null;
  let weakest = null;
  if (entries.length > 0) {
    entries.sort((a, b) => b[1] - a[1]);
    strongest = { id: entries[0][0], score: entries[0][1] };
    weakest = { id: entries[entries.length - 1][0], score: entries[entries.length - 1][1] };
  }

  return {
    profile,
    responses,
    domainScores,
    overallScore,
    stage,
    strongest,
    weakest,
    timestamp: new Date().toISOString(),
  };
}
