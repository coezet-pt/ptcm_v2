# PTCM Dashboard — Handover Docs

**PTCM = Powertrain Choice Model.**

This is a React web app that reproduces a CoEZET (IIT Madras) Excel model of India's
medium & heavy-duty truck fleet moving from diesel to zero-emission trucks, 2026 to 2055.

These docs are written for someone who has never seen this repo.

## What to read

| # | Doc | Read it when |
|---|---|---|
| 1 | [01-getting-started.md](01-getting-started.md) | Day 1. Install, run, test, find your way around. |
| 2 | [02-architecture.md](02-architecture.md) | Before your first code change. How the app is put together. |
| 3 | [03-model-reference.md](03-model-reference.md) | When you change the model — formulas and where they come from in Excel. |
| 4 | [04-parameters-and-ui.md](04-parameters-and-ui.md) | When you change an input, a chart, or an export. |
| 5 | [05-deployment.md](05-deployment.md) | To understand the current Vercel setup and how to redeploy. |
| 6 | [06-iitm-integration.md](06-iitm-integration.md) | To move this onto an IIT Madras website. |
| 7 | [07-known-issues.md](07-known-issues.md) | Before you trust a number. Known gaps and the to-do list. |

Short on time? Read **01**, the pipeline diagram in **02**, then **07**.

## The short version

- **What it is** — one React page. No backend, no database, no API keys, no environment
  variables. Every number is calculated in the browser from constants stored in this repo.
- **What it replaces** — `CoEZET PTCM v2.xlsx` at the repo root (~50 sheets). That workbook
  is the source of truth. If the app and the workbook disagree, the workbook is right,
  unless [07](07-known-issues.md) says otherwise.
- **What it shows** — annual sales, fleet stock, market share, CO₂ and energy demand for
  6 powertrains × 14 truck types × 30 years. Users change costs and policy settings and
  watch the result change.
- **Where it runs** — GitHub `coezet-pt/ptcm_v2` (branch `main`) deploys automatically to
  Vercel at <https://ptcm-rho.vercel.app>.
- **Tests** — `npm test` runs 37 tests. Twelve of them check the model against known
  Excel values.

## Words you will see

| Term | Meaning |
|---|---|
| PTCM | Powertrain Choice Model — this app |
| PTTM | Powertrain Transition Trajectory Model — stage 4, the year-by-year curves |
| CoEZET | Centre of Excellence for Zero Emission Trucks, IIT Madras |
| M&HDT | Medium & Heavy-Duty Trucks |
| ZET | Zero Emission Truck (see [07](07-known-issues.md) — the code has two definitions) |
| BET | Battery Electric Truck |
| H2-ICE | Hydrogen Internal Combustion Engine truck |
| H2-FCET / FCET | Hydrogen Fuel Cell Electric Truck |
| TCO | Total Cost of Ownership |
| TIV | Total Industry Volume — total truck sales in a year |
| TAT | Turnaround Time |
| GVW / ULW | Gross Vehicle Weight / Unladen Weight |
| Bucket | One use case + one truck size. There are 14. All maths runs per bucket. |
| CAGR | Compound annual growth rate — how a cost changes each year |
| Anchor | A year the model prices directly: 2045, 2050, 2055 |

## Repo layout

```
ptcm_v2/
├── CoEZET PTCM v2.xlsx      # The source workbook — committed on purpose
├── docs/                    # These docs
├── src/                     # The app (see 02)
├── scripts/                 # Old one-off Excel extraction scripts
├── public/                  # Static files copied into the build
├── dist/                    # Build output (gitignored)
├── dump/                    # Local scratch files (gitignored)
└── .claude/skills/verify/   # How to drive the app headlessly for testing
```

## Who owns what

The model — formulas, numbers, scenarios — belongs to **CoEZET, IIT Madras**. The workbook
in this repo is theirs. Any "why is this number like this" question is a workbook question
first. [03](03-model-reference.md) tells you which sheet to open.
