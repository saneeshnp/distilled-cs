// Contextual Renderer — runtime DOM updates based on user context
// Reads localStorage state and updates page elements accordingly.

import { isAssessmentCompleted, getProfile, getScores, getMaturityStage } from './context-manager.js';

// Initialize contextual rendering on page load
export function initContextualRendering() {
  const completed = isAssessmentCompleted();

  // Toggle visibility of assessed/non-assessed elements
  document.querySelectorAll('[data-show-if-assessed]').forEach(el => {
    el.style.display = completed ? '' : 'none';
  });
  document.querySelectorAll('[data-hide-if-assessed]').forEach(el => {
    el.style.display = completed ? 'none' : '';
  });

  if (completed) {
    // Process all contextual containers
    document.querySelectorAll('[data-contextual]').forEach(el => {
      const type = el.getAttribute('data-contextual');
      switch (type) {
        case 'stage-indicator':
          renderStageIndicator(el);
          break;
        case 'assessment-cta':
          // Hide CTAs when assessed
          el.style.display = 'none';
          break;
      }
    });

    renderStageContent(document.body);
  } else {
    // Show CTAs for non-assessed users
    document.querySelectorAll('[data-contextual="assessment-cta"]').forEach(el => {
      renderAssessmentCTA(el);
    });
  }
}

// Render contextual metric panel for a specific metric
export function renderMetricContext(metricId, containerElement) {
  if (!containerElement) return;

  const completed = isAssessmentCompleted();
  if (!completed) {
    renderAssessmentCTA(containerElement);
    return;
  }

  const profile = getProfile();
  const scores = getScores();
  if (!scores || !scores.stage) return;

  // Dynamically import data (already bundled at build time for Astro)
  // The caller should pass metric data directly if available
  const stage = scores.stage;
  const segment = profile?.customer_segment;
  const complexity = profile?.product_complexity;

  containerElement.setAttribute('data-rendered', 'true');
}

// Render stage-specific content — shows/hides elements based on user's stage
export function renderStageContent(containerElement) {
  if (!containerElement) return;

  const scores = getScores();
  if (!scores || !scores.stage) return;

  const userStage = scores.stage;

  containerElement.querySelectorAll('[data-stage]').forEach(el => {
    const elStage = el.getAttribute('data-stage');
    if (elStage !== userStage) {
      el.style.display = 'none';
    }
  });
}

// Show CTA for non-assessed users
export function renderAssessmentCTA(containerElement) {
  if (!containerElement) return;
  if (containerElement.getAttribute('data-rendered') === 'true') return;

  containerElement.innerHTML = `
    <div style="
      padding: 1.5rem;
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      background: var(--color-surface);
      text-align: center;
    ">
      <p style="
        font-family: var(--font-display);
        font-size: 1.125rem;
        color: var(--color-text-primary);
        margin-bottom: 0.75rem;
      ">Take the assessment to see personalized guidance</p>
      <p style="
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        margin-bottom: 1.25rem;
      ">Our 5-minute assessment will tailor recommendations to your team's context and maturity stage.</p>
      <a href="/assess/" style="
        display: inline-block;
        padding: 0.625rem 1.5rem;
        background: var(--color-accent);
        color: var(--color-bg);
        border-radius: 0.5rem;
        font-weight: 500;
        font-size: 0.875rem;
        text-decoration: none;
      ">Take the Assessment</a>
    </div>
  `;
  containerElement.setAttribute('data-rendered', 'true');
}

// Render a stage indicator element
function renderStageIndicator(el) {
  const scores = getScores();
  if (!scores || !scores.stage) return;

  const stageInfo = getMaturityStage(scores.overallScore);
  if (!stageInfo) return;

  const stageColors = {
    crawl: 'var(--color-stage-crawl)',
    walk: 'var(--color-stage-walk)',
    run: 'var(--color-stage-run)',
    fly: 'var(--color-stage-fly)',
  };

  el.innerHTML = `
    <span style="
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      background: ${stageColors[scores.stage] || 'var(--color-accent)'};
      color: var(--color-bg);
      font-size: 0.8125rem;
      font-weight: 500;
    ">
      <span style="
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      "></span>
      ${stageInfo.label} (${scores.overallScore})
    </span>
  `;
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContextualRendering);
  } else {
    initContextualRendering();
  }
}
