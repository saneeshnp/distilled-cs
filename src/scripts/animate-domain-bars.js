/**
 * Animate a set of domain-score rows on first reveal.
 *
 * Each row should contain:
 *   - a fill element with an inline `style="width:NN%"` (the target width)
 *   - a value element whose number text should count up to its final value
 *
 * The helper resets both to zero, waits until the container is in view, then:
 *   - lets the existing CSS `transition: width …` animate the bar fill
 *   - drives a short requestAnimationFrame count-up for the number
 *
 * Respects `prefers-reduced-motion: reduce` by leaving the final state untouched.
 *
 * Usage:
 *   import { animateDomainBars } from '../scripts/animate-domain-bars.js';
 *   animateDomainBars({
 *     container: document.getElementById('results-container'),
 *     rowSelector: '.domain-score-row',
 *     fillSelector: '.domain-score-bar',
 *     valueSelector: '.domain-score-value',
 *   });
 */
export function animateDomainBars({
  container,
  rowSelector,
  fillSelector,
  valueSelector,
  numberDuration = 800,
}) {
  if (!container) return;
  const rows = container.querySelectorAll(rowSelector);
  if (!rows.length) return;

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Pre-collect targets and reset to zero for every row, regardless of reduced-motion.
  // For reduced-motion users we'll skip the animation but still want correct final state.
  const items = [];
  rows.forEach((row) => {
    const fill = row.querySelector(fillSelector);
    const value = row.querySelector(valueSelector);
    if (!fill || !value) return;

    const targetWidth = fill.style.width || '0%';

    // The value element may either be plain text (assess) or have child markup
    // like " / 10" wrapped in a sibling span (transform). Find the leading
    // text node so we can update the number without clobbering the suffix.
    let textNode = null;
    for (const node of value.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '') {
        textNode = node;
        break;
      }
    }
    const targetText = (textNode ? textNode.nodeValue : value.textContent).trim();
    const targetNum = parseFloat(targetText);

    items.push({ fill, value, textNode, targetWidth, targetNum, targetText });

    if (reduced) return;

    // Reset to zero state.
    fill.style.width = '0%';
    const zeroDisplay = formatLikeTarget(0, targetText);
    if (textNode) textNode.nodeValue = zeroDisplay;
    else value.textContent = zeroDisplay;
  });

  if (reduced || !items.length) return;

  let started = false;
  const start = () => {
    if (started) return;
    started = true;

    // Force reflow so the 0% baseline is committed before we set the target.
    // eslint-disable-next-line no-unused-expressions
    container.offsetWidth;

    requestAnimationFrame(() => {
      items.forEach((item) => {
        item.fill.style.width = item.targetWidth;
        animateNumber(item, numberDuration);
      });
    });
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            start();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(container);
  } else {
    start();
  }
}

function animateNumber(item, duration) {
  const start = performance.now();
  const target = isFinite(item.targetNum) ? item.targetNum : 0;

  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    const current = target * eased;
    const display = t < 1 ? formatLikeTarget(current, item.targetText) : item.targetText;
    if (item.textNode) item.textNode.nodeValue = display;
    else item.value.textContent = display;
    if (t < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

// Match the decimal precision of the original target string and preserve any
// trailing non-numeric suffix, so "7.5" stays one-decimal, "8" stays integer,
// and "75%" keeps the percent sign during the count-up.
function formatLikeTarget(value, targetText) {
  const match = targetText.match(/^(-?\d+\.?\d*)(.*)$/);
  if (!match) return targetText;
  const numStr = match[1];
  const suffix = match[2] || '';
  const dotIdx = numStr.indexOf('.');
  const decimals = dotIdx === -1 ? 0 : numStr.length - dotIdx - 1;
  return value.toFixed(decimals) + suffix;
}
