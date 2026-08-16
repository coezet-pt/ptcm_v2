# 1. Getting Started

## Prerequisites

| Tool | Version used to build this | Notes |
|---|---|---|
| Node.js | **22.14.0** | Anything ≥ 18 should work; 20 or 22 LTS recommended. There is no `.nvmrc` or `engines` field — see [07](07-gotchas-and-backlog.md). |
| npm | 11.6.2 | `package-lock.json` is the lockfile you should use. |
| Git | any | The repo is cloned over SSH. |

There is **nothing else to install** — no database, no Python runtime (the `scripts/*.py`
files are historical, see below), no environment variables, no `.env` file.

## Clone and run

```bash
git clone git@github.com:coezet-pt/ptcm_v2.git
cd ptcm_v2
npm install
npm run dev          # → http://localhost:8080
```

> The current owner's remote is `git@github.com-coezet:coezet-pt/ptcm_v2.git` — the
> `github.com-coezet` host is an SSH-config alias for a second GitHub identity. On a fresh
> machine just use the plain `git@github.com:coezet-pt/ptcm_v2.git` form, or HTTPS.

The dev port is **8080**, set in `vite.config.ts` (not Vite's default 5173).

## The four commands you will actually use

```bash
npm run dev        # Dev server with HMR, port 8080
npm run build      # Production build → dist/
npm run preview    # Serve dist/ locally (default port 4173) — what Vercel ships
npm test           # Vitest, 17 tests, ~40s
npm run lint       # ESLint
```

### What a healthy `npm test` looks like

```
PASS total_sales_2026: Total sales in 2026: 3,01,120 (target: 3,01,120 ±2%)
PASS total_sales_2045: Total sales in 2045: 7,07,250 (target: 7,07,250 ±2%)
PASS total_sales_2055: Total sales in 2055: 10,29,830 (target: 10,29,830 ±2%)
PASS zet_share_2045: ZET share 2045: 79.6% (exp 70%–90%)
PASS zet_share_2055: ZET share 2055: 100.0% (exp 95%–100%)
PASS diesel_2026_units: Diesel sales 2026: 2,86,925 (exp 2,70,000–3,00,000)
... 12 checks total ...
 Test Files  4 passed (4)
      Tests  17 passed (17)
```

Those twelve `PASS` lines are the **model health suite** — the same checks that drive the
green/amber badge in the app header. If one of them flips to `FAIL` after your change,
you have moved the model away from the Excel reference. That may be intentional; it must
never be accidental.

### What a healthy `npm run build` looks like

```
✓ 2884 modules transformed.
dist/index.html                     0.90 kB │ gzip:   0.44 kB
dist/assets/index-*.css            66.24 kB │ gzip:  11.66 kB
dist/assets/index-*.js          1,369.89 kB │ gzip: 431.66 kB
dist/assets/jspdf.es.min-*.js     416.14 kB │ gzip: 136.51 kB
dist/assets/html2canvas.esm-*.js  201.42 kB │ gzip:  48.03 kB
✓ built in ~43s
```

The "chunks larger than 500 kB" warning is expected and harmless — see
[07](07-gotchas-and-backlog.md) if you want to fix it.

## Finding your way around `src/`

```
src/
├── main.tsx                     Entry point — mounts <App/>
├── App.tsx                      Providers + react-router (only route that matters is "/")
├── index.css                    Tailwind layers + the CSS custom-property design tokens
│
├── pages/
│   ├── Index.tsx                THE dashboard. Header, sidebar, KPI rail, chart area.
│   └── NotFound.tsx             404
│
├── contexts/
│   └── ScenarioContext.tsx      All user input state. draft vs applied config. ★
│
├── hooks/
│   └── useSimulation.ts         Runs the 5-stage pipeline, debounced 300 ms. ★
│
├── lib/
│   ├── types.ts                 ScenarioConfig / PolicyConfig / AnnualResult / … ★
│   ├── sim/                     THE MODEL — see 03-model-reference.md
│   │   ├── timeSeries.ts        (1) cost trajectories 2026→2055
│   │   ├── tco.ts               (2) total cost of ownership per bucket × PT × year
│   │   ├── choiceModel.ts       (3) 5-factor share model → 2045 / 2050 / 2055 targets
│   │   ├── pttm.ts              (4) Gompertz + Weibull diffusion → annual shares
│   │   ├── stockEmissions.ts    (5) stock roll-forward, CO₂, energy, segment splits
│   │   ├── maintenance.ts       per-bucket maintenance defaults
│   │   └── sanityCheck.ts       the 12 Excel-reference checks
│   ├── constants/
│   │   ├── extracted.ts         ★ 1,000+ lines of Excel-extracted constants. The
│   │   │                          single most important data file in the repo.
│   │   ├── segmentAppShares.ts  year-varying segment/application share tables
│   │   ├── segments.ts          7 segment bands, 9 applications, colours
│   │   ├── scenarios.ts         BAU / BWS-1 / BWS-2 / BEST preset configs
│   │   ├── configurableParams.ts  which params appear in the sidebar, grouped
│   │   ├── parameterMeta.ts     labels + units for every parameter
│   │   └── displayLabels.ts     human-readable powertrain names
│   ├── paramFile.ts             CSV/XLSX round-trip of the whole parameter set
│   ├── paramSummary.ts          the "Configured Parameters (Inputs)" table
│   ├── report.tsx               PDF report generator (jsPDF + html-to-image)
│   └── exporters.ts             PNG / CSV / XLSX helpers used by every chart
│
├── components/
│   ├── InputPanel.tsx           The left sidebar. Composes the input widgets.
│   ├── ChartSections.tsx        The 3 chart tabs and what each contains.
│   ├── ChartCard.tsx            Reusable chart shell: title, data table, export row.
│   ├── charts/                  13 chart components
│   ├── ui/                      shadcn/ui primitives — generated, do not hand-edit
│   └── …                        one component per input group (see 04)
│
└── test/                        Vitest suites
```

★ = read these four files before your first change.

## `scripts/` — historical, not part of the build

| File | What it was for |
|---|---|
| `extract_constants.py` | Pulled constants out of the workbook into `extracted.ts`. Run with Python + openpyxl if you need to re-extract after a workbook update. |
| `gen_2026_base.py` | Generated the 2026-rebased base values (commit `c406730`). |
| `validate_against_xlsx.ts` | Diffs a full BAU run against the workbook's `Output Summary` sheet. Written for the Bun runtime (`import.meta.dir`) — it will **not** run under plain Node without edits. |
| `extracted_audit.json` | Cached workbook extract used by the validator. |

None of these run in CI or in the build. Treat them as reference material for
"how did that number get here", not as a maintained toolchain.

## Debugging the simulation in the browser

Open the console. Every recompute already prints a diagnostic dump (Layers 1–4:
choice-model shares, aggregated 2055 targets, Gompertz params, PTTM output).

For the extra verification blocks, run this and reload:

```js
window.__SIM_DEBUG__ = true;
```

That adds a per-bucket TCO breakdown, the choice-model factor trace, and expected-vs-actual
comparisons against the Excel BAU values.

> **Note:** the base diagnostic dump currently runs in production too. See
> [07](07-gotchas-and-backlog.md) — it should be gated before a public IITM launch.

## Driving the app headlessly

`.claude/skills/verify/SKILL.md` documents how to build, serve, and drive the dashboard
with Playwright — including the selectors for the parameter file upload/download flow and
the trick needed to screenshot the off-screen PDF report host. Useful for regression
checks on the export paths, which have no unit tests.
