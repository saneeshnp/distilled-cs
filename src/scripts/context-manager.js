// Context Manager — localStorage read/write utilities for Distilled CS
// Manages user profile, assessment scores, and completion state.

const PROFILE_KEY = 'distilledcs_profile';
const SCORES_KEY = 'distilledcs_scores';
const COMPLETED_KEY = 'distilledcs_completed';
const PREVIOUS_SCORES_KEY = 'distilledcs_previous_scores';
const DRAFT_KEY = 'distilledcs_draft';

// Stage score ranges (from framework data — D1 bands, ordered ascending by min)
const STAGE_RANGES = [
  { id: 'crawl', label: 'Crawl', min: 1.0, max: 2.0 },
  { id: 'walk',  label: 'Walk',  min: 2.0, max: 3.0 },
  { id: 'run',   label: 'Run',   min: 3.0, max: 4.0 },
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

function migrateFlyStagesToRun() {
  try {
    for (const key of [SCORES_KEY, PREVIOUS_SCORES_KEY]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = safeParse(raw);
      if (parsed && parsed.stage === 'fly') {
        parsed.stage = 'run';
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    }
  } catch {
    // ignore migration errors
  }
}

// Run migrations on load
migrateFromLeanCS();
migrateFlyStagesToRun();

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

// In-progress assessment draft (resume support)
// Holds partial answers so a user who leaves mid-assessment can pick up
// where they left off. Separate from SCORES_KEY, which only holds a completed
// assessment. Cleared once the assessment is finished or reset.
export function saveDraft(draft) {
  return safeSetItem(DRAFT_KEY, JSON.stringify(draft));
}

export function getDraft() {
  return safeParse(safeGetItem(DRAFT_KEY));
}

export function clearDraft() {
  safeRemoveItem(DRAFT_KEY);
}

// Full reset
export function resetAll() {
  safeRemoveItem(PROFILE_KEY);
  safeRemoveItem(SCORES_KEY);
  safeRemoveItem(COMPLETED_KEY);
  safeRemoveItem(DRAFT_KEY);
  try {
    localStorage.removeItem('distilledcs_checklist');
  } catch {
    // ignore
  }
}

// Determine maturity stage from an overall score (1.0–4.0).
// Uses min-only selection (same pattern as determineStage() in scoring-engine.js):
// picks the highest stage whose min the score has passed, so boundary values
// like 2.0 land in Walk and 3.0 land in Run, not the lower stage.
export function getMaturityStage(overallScore) {
  if (typeof overallScore !== 'number' || isNaN(overallScore)) return null;
  let result = STAGE_RANGES[0];
  for (const stage of STAGE_RANGES) {
    if (overallScore >= stage.min) result = stage;
  }
  return result;
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

// Data backup / restore
const BACKUP_KEYS = [
  PROFILE_KEY,
  SCORES_KEY,
  COMPLETED_KEY,
  PREVIOUS_SCORES_KEY,
  'distilledcs_checklist',
];

export function exportData() {
  const data = {};
  for (const key of BACKUP_KEYS) {
    const val = safeGetItem(key);
    if (val !== null) data[key] = val;
  }
  return { version: 1, exported: new Date().toISOString(), data };
}

export function downloadBackup() {
  const payload = exportData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `distilledcs-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(jsonString) {
  let parsed;
  try {
    parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  } catch {
    return { ok: false, reason: 'File could not be read as JSON.' };
  }
  if (!parsed || typeof parsed.data !== 'object' || parsed.data === null) {
    return { ok: false, reason: 'File does not look like a Distilled CS backup.' };
  }
  for (const [key, val] of Object.entries(parsed.data)) {
    if (BACKUP_KEYS.includes(key) && typeof val === 'string') {
      safeSetItem(key, val);
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('distilledcs:updated'));
  } catch {
    // ignore
  }
  return { ok: true };
}
