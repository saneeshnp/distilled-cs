// One-off generator for public/og-default.png.
// Run with: node scripts/generate-og-default.mjs
// Re-run if the brand mark, tagline, or palette changes.

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, '..', 'public', 'og-default.png');

// 1200x630 is the canonical OG dimension. Light-mode palette to match the site.
const W = 1200;
const H = 630;

// Brand colors (from src/styles/global.css :root)
const BG = '#FAFAF7';           // --color-bg
const TEXT = '#1A1A1A';         // --color-text-primary
const MUTED = '#5C5C5C';        // --color-text-secondary
const ACCENT = '#2D6A5A';       // --color-accent
const BORDER = '#E5E3DC';       // approx --color-border

// SVG is rendered with librsvg. We use Georgia for the serif headline (broadly
// available, similar feel to Instrument Serif) and system-ui sans for body.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${BG}"/>

  <!-- Subtle diagonal line pattern (matches homepage hero) -->
  <defs>
    <pattern id="diag" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
      <line x1="0" y1="0" x2="0" y2="28" stroke="${BORDER}" stroke-width="1" opacity="0.55"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#diag)"/>

  <!-- Loop echo: three connected nodes in the upper right -->
  <g transform="translate(940, 130)" opacity="0.85">
    <circle cx="0" cy="0" r="60" fill="none" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="3 6" opacity="0.5"/>
    <circle cx="0" cy="-60" r="6" fill="${ACCENT}"/>
    <circle cx="52" cy="30" r="6" fill="${ACCENT}"/>
    <circle cx="-52" cy="30" r="6" fill="${ACCENT}"/>
  </g>

  <!-- Wordmark (top-left) -->
  <text x="80" y="130" font-family="Georgia, 'Times New Roman', serif" font-size="56" fill="${TEXT}" font-weight="400">
    Distilled<tspan fill="${ACCENT}" font-weight="600">CS</tspan>
  </text>

  <!-- Eyebrow line -->
  <line x1="80" y1="180" x2="200" y2="180" stroke="${ACCENT}" stroke-width="3"/>

  <!-- Headline -->
  <text x="80" y="320" font-family="Georgia, 'Times New Roman', serif" font-size="72" fill="${TEXT}" font-weight="400" letter-spacing="-1">
    <tspan x="80" dy="0">The Open Customer Success</tspan>
    <tspan x="80" dy="86">Strategy &amp; Maturity Framework</tspan>
  </text>

  <!-- Subhead -->
  <text x="80" y="510" font-family="-apple-system, 'Helvetica Neue', sans-serif" font-size="26" fill="${MUTED}" font-weight="400">
    Assess. Execute. Transform. Free, vendor-neutral, built by practitioners.
  </text>

  <!-- Domain footer -->
  <text x="80" y="580" font-family="-apple-system, 'Helvetica Neue', sans-serif" font-size="22" fill="${ACCENT}" font-weight="600" letter-spacing="1">
    distilledcs.org
  </text>
</svg>
`.trim();

const png = await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toBuffer();

writeFileSync(out, png);
console.log(`Wrote ${out} (${(png.length / 1024).toFixed(1)} KB, ${W}x${H})`);
