# PTCM Dashboard — Handover Documentation

This folder is the knowledge-transfer pack for the **Powertrain Choice Model (PTCM)
dashboard** — the React app that reproduces CoEZET IIT Madras' Excel model of India's
medium & heavy-duty truck fleet transition, 2026–2055.

It is written for someone who has **never seen this repo before** and has to keep it
running, change the model, and eventually host it on an IIT Madras website.

---

## Read in this order

| # | Document | Read it when |
|---|---|---|
| 1 | [01-getting-started.md](01-getting-started.md) | Day 1. Clone, install, run, test, and find your way around the repo. |
| 2 | [02-architecture.md](02-architecture.md) | Before your first code change. How the app is wired: state, the 5-stage simulation pipeline, rendering. |
| 3 | [03-model-reference.md](03-model-reference.md) | When you need to change the *model* — formulas, Excel provenance, calibration constants, deliberate Excel quirks. |
| 4 | [04-parameters-and-ui.md](04-parameters-and-ui.md) | When you need to change an *input*, a chart, or an export. Maps every UI control to the code that consumes it. |
| 5 | [05-deployment.md](05-deployment.md) | To understand the current GitHub → Vercel deployment and how to redeploy. |
| 6 | [06-iitm-integration.md](06-iitm-integration.md) | To move/embed this into an IIT Madras website. Four options with trade-offs and exact steps. |
| 7 | [07-gotchas-and-backlog.md](07-gotchas-and-backlog.md) | Before you trust a number, and before you plan the next sprint. Known discrepancies, traps, cleanup list. |

If you only have twenty minutes: read **01**, then the "Pipeline in one picture" section
of **02**, then **07**.

---

## The 60-second version

- **What it is** — a single-page React app. No backend, no database, no API keys,
  no environment variables. Every number on screen is computed in the browser from
  constants committed to this repo.
- **What it replaces** — `CoEZET PTCM v2.xlsx` (committed at the repo root, ~50 sheets).
  That workbook is the source of truth; the app is a faithful, interactive re-implementation
  of it. When the app and the workbook disagree, the workbook wins unless
  [07-gotchas-and-backlog.md](07-gotchas-and-backlog.md) says otherwise.
- **What it does** — projects annual sales, fleet stock, market share, CO₂ emissions and
  energy demand for 6 powertrains × 14 truck buckets × 30 years, and lets the user push
  cost trajectories and policy levers around to see the transition respond.
- **Where it lives** — GitHub `coezet-pt/ptcm_v2` (branch `main`) → auto-deployed to
  Vercel at <https://ptcm-rho.vercel.app>.
- **How it is tested** — `npm test` runs 17 Vitest tests, including a 12-check
  sanity suite that compares the simulation against Excel reference values.

## Repository map (top level)

```
ptcm_v2/
├── CoEZET PTCM v2.xlsx      # Source-of-truth workbook — deliberately committed
├── docs/                    # ← you are here
├── src/                     # The application (see 02-architecture.md)
├── scripts/                 # One-off Excel extraction / validation harnesses
├── public/                  # Static assets copied verbatim into the build
├── dist/                    # Build output (gitignored)
├── dump/                    # Local debug dumps and dead scratch files (gitignored)
├── .claude/skills/verify/   # Instructions for driving the app headlessly
└── .lovable/plan.md         # Historical artefact — see 07, it is out of date
```

## Who to ask

The model itself (formulas, calibration, scenario definitions) is owned by
**CoEZET, IIT Madras**. The workbook in this repo is their artefact. Any question that
starts "why is this number…" is a workbook question before it is a code question —
open the relevant sheet first. [03-model-reference.md](03-model-reference.md) tells you
which sheet.
