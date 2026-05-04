# Distilled CS

**The open Customer Success strategy framework.** Available at [distilledcs.org](https://distilledcs.org).

---

## What is Distilled CS?

Customer Success teams have a shared problem: there is no industry standard for how to build, measure, and grow a CS function. Every team starts from scratch — guessing at benchmarks, improvising health scores, and hoping their metrics are the right ones. Existing frameworks are either paywalled, vendor-locked, or too generic to be actionable.

Distilled CS is an open, vendor-neutral framework that gives CS leaders a structured system for maturing their function — from a scrappy, reactive team to a strategic, data-driven operation. Think of it as what the [FinOps Foundation](https://www.finops.org/) did for cloud cost management, but for Customer Success.

It is free, open source, and designed by practitioners for practitioners.

## The Strategy Loop

Distilled CS is built around a **continuous improvement loop** — a repeatable cycle your team returns to as it grows:

```
    ┌──────────┐
    │  Assess  │  Know where you stand
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │ Execute  │  Act on what matters most
    └────┬─────┘
         │
         ▼
    ┌───────────┐
    │ Transform │  Measure, re-assess, level up
    └─────┬─────┘
          │
          └──────→ (back to Assess)
```

- **Assess** — Score your CS maturity across 8 capability domains. Understand your strengths, your gaps, and which maturity stage you're in.
- **Execute** — Follow stage-specific strategy playbooks. Track the metrics that matter at your stage. Work through a prioritized execution checklist.
- **Transform** — Measure your progress against your previous assessment. See what improved, what needs attention, and when you're ready to graduate to the next maturity stage.

The loop is designed to be repeated. Each cycle moves your team closer to the next stage.

## The Maturity Model

The framework is anchored by a **4-stage maturity model** that describes how CS functions evolve:

| Stage | Profile | What it looks like |
|-------|---------|-------------------|
| **Crawl** | Reactive / Foundational | CS exists but runs on instinct and firefighting. Metrics are sparse, engagement is inconsistent, and most effort goes into reacting to problems. |
| **Walk** | Structured / Proactive | Processes are documented, health scoring is in place, and the team has moved from reactive to proactive. Segmentation and lifecycle management are emerging. |
| **Run** | Scalable / Predictive | Digital-led engagement scales the long tail. Predictive models identify churn risk early. CS contributes directly to expansion revenue. |
| **Fly** | Strategic / Transformative | CS is a company-wide culture, not just a department. Predictive intelligence drives strategy. CS owns a revenue number and influences product direction. |

Your maturity stage is determined by your scores across 8 domains — not by team size, ARR, or tenure. A 3-person team can be at Walk stage, and a 40-person team can still be at Crawl.

## The 8 Capability Domains

The assessment evaluates your CS function across these domains:

1. **Segmentation & Coverage** — How you divide your customer base and allocate CS resources across segments
2. **Journey & Lifecycle** — How you map, manage, and optimize the customer journey from onboarding through renewal
3. **Health Scoring & Risk** — How you monitor customer health, detect risk, and intervene before churn
4. **Metrics & Data** — How you measure CS performance, instrument data, and use it to drive decisions
5. **Expansion & Value** — How you identify and drive growth within existing accounts
6. **CS Organization & Strategy** — How CS is structured, resourced, and positioned within the company
7. **CS Culture & Cross-Functional Alignment** — How deeply CS principles are embedded across the organization
8. **AI Leverage in CS** — How your team is adopting AI to improve coverage, speed, and insight across CS operations

Each domain is scored independently, giving you a nuanced view of where you're strong and where to focus.

## Context-Aware Guidance

Not every CS team operates the same way. A $2M ARR startup with 3 CSMs managing SMB accounts faces very different challenges than a $100M enterprise with a 40-person CS org.

Distilled CS adapts to your context. When you take the assessment, you provide your company profile — ARR, customer segment, team size, product complexity — and the framework personalizes everything:

- **Benchmarks** shift to match your segment (SMB vs. enterprise metrics are different)
- **Playbooks** are filtered to your current maturity stage
- **Metrics** are priority-sorted based on what matters most at your stage
- **Recommendations** reflect your team size and growth trajectory

## Strategy Playbooks

The framework includes **16 strategy playbooks** — 4 for each maturity stage — covering the highest-leverage moves for that stage of growth:

**Crawl stage**: Establish a retention baseline, build your first customer segmentation, create a basic onboarding program, and set up foundational CS processes

**Walk stage**: Implement health scoring, build lifecycle journey maps, operationalize QBR/EBR cadence, and introduce proactive risk management

**Run stage**: Scale with digital-led engagement, build predictive churn models, formalize expansion motion, and operationalize data-driven segmentation

**Fly stage**: CS-led revenue strategy, predictive customer intelligence, embed CS culture company-wide, and drive strategic customer partnerships

Each playbook includes a clear objective, a step-by-step action plan, the metrics to watch, common pitfalls to avoid, and an estimated duration.

## Guiding Principles

Six principles underpin the entire framework:

1. **Customer Success Is a Culture, Not Just a Department** — CS outcomes require cross-functional alignment, not just a dedicated team
2. **Proactive Over Reactive** — Build systems that surface risk before customers feel pain
3. **Segment, Then Scale** — The right engagement for each segment at a cost the business can sustain
4. **Outcomes Over Activities** — Measure value delivered, not tasks completed
5. **Context Drives Strategy** — Best practices without context are just guesses
6. **Data-Informed, Not Data-Paralyzed** — Act on one trustworthy signal rather than staring at a dozen unreliable ones

## Metrics Directory

The framework tracks **24 CS metrics**, each with:

- A clear definition and formula
- Priority level by maturity stage (what to focus on now vs. later)
- Benchmarks by company segment
- Common measurement mistakes to avoid
- Connections to the playbooks that reference them

Metrics include: NRR, GRR, Logo Retention, Time to Value, Health Score, Expansion Revenue, CSAT, Adoption Rate, TTFV, Onboarding Completion, Product Adoption Depth, Stickiness Ratio, Expansion Rate, CAC Payback, CES, Escalation Rate, CSQLs, and AI-leverage signals.

---

## Tech Stack

- **[Astro 6](https://astro.build)** — Core framework
- **Tailwind CSS v4** — Utility-first styling
- **Vanilla JavaScript** — No frontend frameworks (no React or Vue)
- **Cloudflare Pages** — Hosting

The site is fully static — no backend, no database, no API calls. All user data (assessment results, checklist progress) is stored locally in the browser via localStorage.

## Data Architecture

All framework content — assessment questions, metrics, benchmarks, playbooks, stage definitions, and recommendations — lives in a single JSON file (`src/data/lean-cs-data.json`). This is the single source of truth. Pages read from this file at build time and at runtime for contextual overlays.

## Contributing

Distilled CS is a community project. The framework content, assessment questions, benchmarks, and playbooks are all open for contribution and improvement. If you have experience building or leading CS teams, your perspective makes this better.

Contributions are welcome via [GitHub Issues](https://github.com/saneeshnp/distilled-cs/issues) or through the [Distilled CS LinkedIn page](https://www.linkedin.com/company/distilled-cs/).

## License

Licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Free to use, adapt, and share — with attribution. Any adaptations must be shared under the same license.
