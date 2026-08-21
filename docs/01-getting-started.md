# 1. Getting Started

## What you need

| Tool | Version used here | Notes |
|---|---|---|
| Node.js | **22.14.0** | Anything from 18 up works. 20 or 22 LTS is best. No version is pinned in the repo — see [07](07-known-issues.md). |
| npm | 11.6.2 | Use `package-lock.json`. |
| Git | any | |

Nothing else. No database, no Python, no environment variables, no `.env` file.
(The `scripts/*.py` files are old one-offs, see below.)

## Install and run

```bash
git clone git@github.com:coezet-pt/ptcm_v2.git
cd ptcm_v2
npm install
npm run dev          # → http://localhost:8080
```

The dev port is **8080**, set in `vite.config.ts`. It is not Vite's usual 5173.

> The current owner's git remote uses `github.com-coezet`, which is an SSH alias for a
> second GitHub account. On a new machine, just use the plain
> `git@github.com:coezet-pt/ptcm_v2.git` or HTTPS.

## Commands

```bash
npm run dev        # Dev server with hot reload, port 8080
npm run build      # Production build → dist/
npm run preview    # Serve dist/ locally (port 4173) — same as what Vercel ships
npm test           # Vitest, 37 tests, ~20s
npm run lint       # ESLint
```

### A healthy `npm test`

```
PASS total_sales_2026: Total sales in 2026: 3,01,120 (target: 3,01,120 ±2%)
PASS total_sales_2045: Total sales in 2045: 7,07,250 (target: 7,07,250 ±2%)
PASS total_sales_2055: Total sales in 2055: 10,29,830 (target: 10,29,830 ±2%)
PASS zet_share_2045: ZET share 2045: 79.6% (exp 70%–90%)
PASS zet_share_2055: ZET share 2055: 100.0% (exp 95%–100%)
PASS diesel_2026_units: Diesel sales 2026: 2,86,925 (exp 2,70,000–3,00,000)
... 12 checks total ...
 Test Files  8 passed (8)
      Tests  37 passed (37)
```

Those twelve `PASS` lines are the **model health check** — the same checks behind the
green/amber badge in the app header. If one turns to `FAIL` after your change, the model
has moved away from Excel. That might be on purpose. It must never be by accident.

### A healthy `npm run build`

```
✓ 2886 modules transformed.
dist/index.html                     0.90 kB │ gzip:   0.44 kB
dist/assets/index-*.css            66.24 kB │ gzip:  11.66 kB
dist/assets/index-*.js          1,373.11 kB │ gzip: 432.80 kB
dist/assets/jspdf.es.min-*.js     416.14 kB │ gzip: 136.51 kB
dist/assets/html2canvas.esm-*.js  201.42 kB │ gzip:  48.03 kB
✓ built in ~37s
```

The "chunks larger than 500 kB" warning is expected and harmless. [07](07-known-issues.md)
says how to fix it if you want to.

## Around `src/`

```
src/
├── main.tsx                     Entry point — mounts <App/>
├── App.tsx                      Providers + router (only "/" matters)
├── index.css                    Tailwind layers + colour tokens
│
├── pages/
│   ├── Index.tsx                THE dashboard. Header, sidebar, KPIs, charts.
│   └── NotFound.tsx             404
│
├── contexts/
│   └── ScenarioContext.tsx      All user input state. Draft vs applied. ★
│
├── hooks/
│   └── useSimulation.ts         Runs the 5 stages, waits 300 ms after edits. ★
│
├── lib/
│   ├── types.ts                 ScenarioConfig / PolicyConfig / AnnualResult / … ★
│   ├── sim/                     THE MODEL — see 03
│   │   ├── timeSeries.ts        (1) cost trajectories 2026→2055
│   │   ├── tco.ts               (2) cost of ownership per bucket × powertrain × year
│   │   ├── choiceModel.ts       (3) 5-factor share model → 2045 / 2050 / 2055 targets
│   │   ├── adjustments.ts       share adjustments used by stage 3
│   │   ├── parity.ts            first year each ZET's TCO matches diesel
│   │   ├── pttm.ts              (4) Gompertz + Weibull curves → yearly shares
│   │   ├── stockEmissions.ts    (5) fleet stock, CO₂, energy, segment splits
│   │   ├── maintenance.ts       per-bucket maintenance defaults
│   │   └── sanityCheck.ts       the 12 health checks
│   ├── constants/
│   │   ├── extracted.ts         ★ 1,000+ lines pulled out of Excel. The most
│   │   │                          important data file in the repo.
│   │   ├── segmentAppShares.ts  segment/application share tables by year
│   │   ├── segments.ts          7 size bands, 9 applications, colours
│   │   ├── scenarios.ts         BAU / BWS-1 / BWS-2 / BEST preset configs
│   │   ├── configurableParams.ts  which inputs show in the sidebar, grouped
│   │   ├── parameterMeta.ts     labels and units for every input
│   │   └── displayLabels.ts     readable powertrain names
│   ├── paramFile.ts             CSV/XLSX download and upload of all settings
│   ├── paramSummary.ts          the "Configured Parameters (Inputs)" table
│   ├── report.tsx               PDF report (jsPDF + html-to-image)
│   └── exporters.ts             PNG / CSV / XLSX helpers used by every chart
│
├── components/
│   ├── InputPanel.tsx           The left sidebar.
│   ├── ChartSections.tsx        The 3 chart tabs and what is in each.
│   ├── ChartCard.tsx            Chart shell: title, data table, export buttons.
│   ├── charts/                  13 mounted charts (+ 1 unused, see 07)
│   ├── ui/                      shadcn/ui parts — generated, do not hand-edit
│   └── …                        one component per input group (see 04)
│
└── test/                        Vitest suites
```

★ = read these four files before your first change.

## `scripts/` — old, not part of the build

| File | What it was for |
|---|---|
| `extract_constants.py` | Pulled constants out of the workbook into `extracted.ts`. Needs Python + openpyxl. Run it if the workbook is updated. |
| `gen_2026_base.py` | Made the 2026 base values (commit `c406730`). |
| `validate_against_xlsx.ts` | Compares a full BAU run against the workbook's `Output Summary` sheet. Written for Bun, **will not run on plain Node** without edits. |
| `extracted_audit.json` | Cached workbook extract used by the validator. |

None of these run in CI or in the build. Treat them as reference, not as tools you maintain.

## Debugging in the browser

Open the console. Every recalculation already prints a dump of stages 1–4: choice-model
shares, 2055 targets, Gompertz parameters, and the yearly output.

For more detail, run this and reload:

```js
window.__SIM_DEBUG__ = true;
```

That adds a per-bucket TCO breakdown, the choice-model factor trace, and expected-vs-actual
comparisons against the Excel BAU values.

> The basic dump also runs in production right now. See [07](07-known-issues.md) — it should
> be turned off before a public IITM launch.

## Testing the app end to end

`.claude/skills/verify/SKILL.md` explains how to build, serve and drive the dashboard with
Playwright, including how to test the parameter file upload/download and how to screenshot
the off-screen PDF report. The export paths have no unit tests, so this is the only way to
check them.
