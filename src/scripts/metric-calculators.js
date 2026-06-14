// Pure compute functions for the per-metric calculators on the metric detail pages.
//
// One function per metric id. Each takes a flat `v` object of the variable values
// declared in `metric-calculators.json` (numbers, or ISO date strings for `date`
// variables) and returns a single numeric result. Functions are pure: no DOM, no
// side effects, no I/O. The metric page formats the result using the entry's
// `result_unit` / `result_precision`.
//
// JSON holds the input metadata (labels, units, examples); these functions hold
// the math. The two are kept in sync by metric-calculators.test.js.

// Whole-day difference between two ISO date strings (later minus earlier order is
// caller-defined; result can be negative if the second date precedes the first).
function daysBetween(fromDate, toDate) {
  const MS_PER_DAY = 86400000;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export const calculators = {
  nrr: (v) =>
    ((v.starting_arr + v.expansion - v.contraction - v.churn) / v.starting_arr) * 100,

  grr: (v) =>
    ((v.starting_arr - v.contraction - v.churn) / v.starting_arr) * 100,

  logo_retention: (v) =>
    ((v.customers_end - v.new_customers) / v.customers_start) * 100,

  time_to_value: (v) => daysBetween(v.contract_start, v.value_milestone),

  ttfv: (v) => daysBetween(v.contract_start, v.first_milestone),

  csat: (v) => (v.satisfied_responses / v.total_responses) * 100,

  adoption_rate: (v) => (v.active_users / v.licensed_users) * 100,

  onboarding_completion: (v) => (v.completed / v.cohort) * 100,

  product_adoption_depth: (v) => (v.features_used / v.features_available) * 100,

  stickiness_ratio: (v) => (v.dau / v.mau) * 100,

  expansion_rate: (v) => (v.expansion_arr / v.starting_arr) * 100,

  cac_payback: (v) => v.cac / (v.mrr * (v.gross_margin / 100)),

  ces: (v) => v.sum_ratings / v.responses,

  escalation_rate: (v) => (v.escalated_accounts / v.total_accounts) * 100,

  ai_assisted_resolution_rate: (v) =>
    (v.ai_interventions / v.total_interventions) * 100,

  csm_ai_adoption_rate: (v) => (v.csms_with_ai / v.total_csms) * 100,

  clv: (v) => v.avg_acv * v.avg_lifespan,

  nps: (v) => {
    const total = v.promoters + v.passives + v.detractors;
    return ((v.promoters - v.detractors) / total) * 100;
  },

  acv: (v) => v.total_contract_value / v.contract_length_years,
};
