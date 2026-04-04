# Distilled CS

An open, vendor-neutral customer success maturity framework. Available at [distilledcs.org](https://distilledcs.org).

## What it does

- **Maturity assessment** across 7 CS domains (21 questions + 7 context profile questions)
- **Context-aware guidance** based on your company's ARR, segment, and team size
- **Metrics directory** with stage-specific benchmarks and recommendations
- **Interactive checklist** with progress saved in the browser

## Tech stack

- [Astro 6](https://astro.build) 
- Tailwind CSS v4
- Vanilla JavaScript

## Getting started

```sh
npm install
npm run dev       # Start dev server at localhost:4321
npm run build     # Build static site to dist/
npm run preview   # Preview built site locally
```

## Data

All framework content (questions, metrics, benchmarks, stages) lives in `src/data/lean-cs-data.json`. Do not hardcode framework content in templates.

## License

Open source. See [LICENSE](./LICENSE) for details.
