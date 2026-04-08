// Context Manager — localStorage read/write utilities for Distilled CS
// Manages user profile, assessment scores, and completion state.

const PROFILE_KEY = 'distilledcs_profile';
const SCORES_KEY = 'distilledcs_scores';
const COMPLETED_KEY = 'distilledcs_completed';
const PREVIOUS_SCORES_KEY = 'distilledcs_previous_scores';

// Stage score ranges (from framework data)
const STAGE_RANGES = [
  { id: 'crawl', label: 'Crawl', min: 1.0, max: 1.7 },
  { id: 'walk',  label: 'Walk',  min: 1.8, max: 2.5 },
  { id: 'run',   label: 'Run',   min: 2.6, max: 3.3 },
  { id: 'fly',   label: 'Fly',   min: 3.4, max: 4.0 },
];

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// One-time migration from old leancs_* keys to distilledcs_*
function migrateFromLeanCS() {
  try {
    const migrations = [
      ['leancs_profile', PROFILE_KEY],
      ['leancs_scores', SCORES_KEY],
      ['leancs_completed', COMPLETED_KEY],
      ['leancs_checklist', 'distilledcs_checklist'],
    ];
    for (const [oldKey, newKey] of migrations) {
      const oldVal = localStorage.getItem(oldKey);
      if (oldVal !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldVal);
      }
      if (oldVal !== null) {
        localStorage.removeItem(oldKey);
      }
    }
    // Also migrate sessionStorage key
    try {
      const oldDismissed = sessionStorage.getItem('leancs_bar_dismissed');
      if (oldDismissed !== null) {
        sessionStorage.setItem('distilledcs_bar_dismissed', oldDismissed);
        sessionStorage.removeItem('leancs_bar_dismissed');
      }
    } catch {
      // ignore sessionStorage errors
    }
  } catch {
    // ignore migration errors
  }
}

// Run migration on load
migrateFromLeanCS();

// Profile management
export function saveProfile(profile) {
  return safeSetItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getProfile() {
  return safeParse(safeGetItem(PROFILE_KEY));
}

export function clearProfile() {
  safeRemoveItem(PROFILE_KEY);
}

// Scores management
export function saveScores(scores) {
  return safeSetItem(SCORES_KEY, JSON.stringify(scores));
}

export function getScores() {
  return safeParse(safeGetItem(SCORES_KEY));
}

export function clearScores() {
  safeRemoveItem(SCORES_KEY);
}

// Assessment completion
export function isAssessmentCompleted() {
  return safeGetItem(COMPLETED_KEY) === 'true';
}

export function setAssessmentCompleted(value) {
  safeSetItem(COMPLETED_KEY, String(!!value));
}

// Full reset
export function resetAll() {
  safeRemoveItem(PROFILE_KEY);
  safeRemoveItem(SCORES_KEY);
  safeRemoveItem(COMPLETED_KEY);
  try {
    localStorage.removeItem('distilledcs_checklist');
  } catch {
    // ignore
  }
}

// Determine maturity stage from an overall score (1.0–4.0)
export function getMaturityStage(overallScore) {
  if (typeof overallScore !== 'number' || isNaN(overallScore)) return null;
  for (const stage of STAGE_RANGES) {
    if (overallScore >= stage.min && overallScore <= stage.max) {
      return stage;
    }
  }
  // Edge case: clamp to nearest
  if (overallScore < 1.0) return STAGE_RANGES[0];
  return STAGE_RANGES[STAGE_RANGES.length - 1];
}

// Get a single value from the saved profile
export function getProfileValue(key) {
  const profile = getProfile();
  if (!profile || typeof profile !== 'object') return null;
  return profile[key] ?? null;
}

// Previous scores management (for re-assessment comparison)
export function savePreviousScores() {
  const current = safeGetItem(SCORES_KEY);
  if (current) {
    return safeSetItem(PREVIOUS_SCORES_KEY, current);
  }
  return false;
}

export function getPreviousScores() {
  return safeParse(safeGetItem(PREVIOUS_SCORES_KEY));
}

export function hasPreviousAssessment() {
  return safeGetItem(PREVIOUS_SCORES_KEY) !== null;
}

export function getAssessmentAge() {
  const scores = getScores();
  if (!scores || !scores.timestamp) return null;
  const assessedDate = new Date(scores.timestamp);
  const now = new Date();
  const diffMs = now - assessedDate;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
