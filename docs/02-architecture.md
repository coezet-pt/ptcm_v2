# 2. Architecture

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + TypeScript | Function components + hooks only. No class components. |
| Build | Vite 5 (`@vitejs/plugin-react-swc`) | Dev port 8080. `@` aliases `./src`. |
| Styling | Tailwind CSS 3 + shadcn/ui | Design tokens are CSS custom properties in `src/index.css`. |
| Charts | Recharts 3 | Always `type="monotone"`, `dot={false}` for smooth lines. |
| State | React Context (`ScenarioContext`) | No Redux, no Zustand, no server state. |
| Routing | react-router-dom 6 | Two routes: `/` and the `*` catch-all. |
| Exports | `html-to-image`, `papaparse`, `xlsx`, `jspdf` | All client-side. |
| Backend | **none** | Removed in commit `94b0b9d` ("Remove Supabase; load scenario presets from local constants"). |

There is no server, no API call, no persistence. Reloading the page resets everything to
the BAU defaults. The only way state leaves the browser is through the export buttons
(PNG / CSV / XLSX / PDF) and the parameter-file download.

## Pipeline in one picture

```
                       ScenarioContext
             ┌──────────────────────────────────┐
  UI edits ─▶│ draftConfig  ──[Apply Changes]──▶ config │
             └──────────────────────────────────┘
                                │  (ScenarioConfig)
                                ▼
                    useSimulation(config)     ← 300 ms debounce
                                │
                                ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ 1. timeSeries.ts    buildTimeSeries()                           │
  │    17 parameters × 30 years. Compound growth through 6 CAGR     │
  │    bands (2026-30, 31-35, 36-40, 41-45, 46-50, 51-55), with     │
  │    optional per-year absolute "pins".                           │
  ├─────────────────────────────────────────────────────────────────┤
  │ 2. tco.ts           computeTCO()  ×3, for 2045 / 2050 / 2055    │
  │    Per bucket × powertrain: vehicle price, then 7-year TCO/km   │
  │    = capex + fuel + maintenance + manpower + toll + insurance   │
  │      − resale.                                                  │
  ├─────────────────────────────────────────────────────────────────┤
  │ 3. choiceModel.ts   computeShares() ×3                          │
  │    5-factor exponential share model per bucket → target shares  │
  │    at 2045, 2050, 2055. 2055 runs ZET-only (diesel/CNG/LNG      │
  │    excluded by design — Excel "100% ZET 2055" sheet).           │
  ├─────────────────────────────────────────────────────────────────┤
  │ 4. pttm.ts          computePTTM()                               │
  │    Interpolates the anchors into a year-by-year trajectory:     │
  │    Gompertz-family for BET / H2-ICE / H2-FCET, Weibull-family   │
  │    for CNG / LNG. Diesel is the residual.                       │
  ├─────────────────────────────────────────────────────────────────┤
  │ 5. stockEmissions.ts computeStockEmissions()                    │
  │    Rolls annual sales into fleet stock with scrappage, then     │
  │    computes CO₂, energy demand, and the segment / application   │
  │    breakdowns.                                                  │
  └─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                        SimulationResult
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
   ModelHealthBadge        KpiRail /            ChartSections
   (12 sanity checks)      KpiCard              (13 charts, 3 tabs)
                                                       │
                                                       ▼
                                          PNG / CSV / XLSX / PDF export
```

The whole pipeline is pure and synchronous. It runs in well under 100 ms; the 300 ms
debounce in `useSimulation` exists to avoid re-running it on every keystroke, not because
the computation is slow.

## State model — draft vs applied

This is the single most important thing to understand about the UI.

`ScenarioContext` holds **two** copies of the configuration:

| | Purpose |
|---|---|
| `draftConfig` | What the user is currently typing into the sidebar. |
| `config` | What the charts are actually showing. |

Every `updateParameter` / `updatePolicy` / `updateFixed` / `updateSegmentPrice` /
`updateBucketMaintenance` / `setParameterOverride` call writes to **`draftConfig` only**,
flips `activeScenario` to `'Custom'`, and sets `isDirty = true`.

`config` changes only when the user clicks **Apply Changes** (`applyChanges()` deep-clones
draft → config). `useSimulation` is fed `config`, so nothing recomputes until then.

Consequences you will trip over:

- Uploading a parameter CSV/XLSX loads into **draft**. The charts do not move until
  Apply Changes is clicked. This is deliberate (`importConfig` sets `isDirty = true`).
- If you add a new input widget, wire it to a `draftConfig` setter, never to `config`.
- `discardChanges()` copies config → draft. `resetToDefaults()` / `resetToBAU()` reset both
  to the BAU constants.

### The ScenarioConfig shape

```ts
interface ScenarioConfig {
  parameters:        Record<ParameterKey, ParameterConfig>;  // cost trajectories
  policy:            PolicyConfig;                           // policy levers
  fixed:             FixedParameters;                        // non-year-varying
  segmentBasePrices: SegmentBasePrices;                      // per-size vehicle prices
}

interface ParameterConfig {
  baseValue: number;                      // the 2026 value
  d2530: number; d3135: number;           // CAGR per 5-year band
  d3640: number; d4145: number;
  d4650: number; d5155: number;
  overrides?: Record<number, number>;     // per-year absolute "pins"
}
```

All of it is defined in `src/lib/types.ts`. Defaults live in `extracted.ts` as
`BAU_PARAMETERS`, `BAU_POLICY`, `BAU_FIXED`, `BAU_SEGMENT_BASE_PRICES`.

**CAGR bands and pins interact:** editing a CAGR clears any per-year pins that fall inside
that band (`clearOverridesInRangeIfCagr` in `ScenarioContext.tsx`). This keeps "I set 2033
to ₹95 then changed the 2031–35 growth rate" from producing a silently inconsistent curve.

## Scenario presets

`src/lib/constants/scenarios.ts` defines four full configs: **BAU**, **BWS-1**, **BWS-2**,
**BEST**. They differ in policy levers (incentives, interest rate, electricity subsidy,
toll waiver, inflection/maturity years) and, for BEST, in three cost trajectories.

> **Only BAU (labelled "Default") and Custom are exposed in the UI.**
> `ScenarioPicker.tsx` has `const SCENARIOS = ['BAU', 'Custom']`, and the `Custom` item is
> rendered `disabled` — it is a status indicator, not a selectable option. BWS-1, BWS-2 and
> BEST are fully implemented and reachable from code/tests but were deliberately hidden
> from users. To re-expose them, add them to that array. Their descriptive badge strings
> are already written in `SCENARIO_DIFFS`.

## Rendering layout (`pages/Index.tsx`)

```
┌── header (sticky) ─────────────────────────────────────────────┐
│ PTCM Dashboard · India M&HDT Trucks   [Health badge] [Scenario]│
├───────────┬─────────────────────────────────────┬──────────────┤
│ aside     │ main                                │ aside        │
│ 360px     │                                     │ KpiRail      │
│           │ H2 title + [Download report]        │ (collapsible)│
│ InputPanel│ ParameterSummaryTable               │              │
│           │ ChartSections (3 tabs)              │ 5 KPI cards  │
│ ───────── │                                     │              │
│ Action bar│                                     │              │
│ Apply /   │                                     │              │
│ Discard   │                                     │              │
└───────────┴─────────────────────────────────────┴──────────────┘
```

Below `lg`, the sidebar stacks above the content and the KPI rail is replaced by a
2/3-column KPI grid.

### Chart tabs (`ChartSections.tsx`)

Only **one tab is mounted at a time** (`useState<SectionId>`), which is why the PDF report
has to render its own detached copy of every chart (see `lib/report.tsx`).

| Tab | Charts |
|---|---|
| `projection - powertrain` | TotalSales, AnnualSales, Share, Stock, ZETPenetration, plus a collapsed "Applications & segments" group of 4 charts with an Overall/per-powertrain filter |
| `impact - emission` | Emissions, CumulativeAvoided |
| `impact - fuel/energy requirement` | DieselSavings, EnergyRequirements |

Every chart is wrapped in `ChartCard`, which supplies the title, an expandable data table,
and the footer export row (View table / CSV / Excel / PNG).

## Conventions worth matching

- **Excel provenance in comments.** Nearly every non-obvious constant or branch carries a
  comment naming the sheet and cell it came from (`'Changing with year' rows 92-100`,
  `'No change with year' D22`). Keep doing this — it is the only thing that makes the
  model auditable. See [03](03-model-reference.md).
- **Deliberate Excel quirks are labelled `Excel quirk:`.** They reproduce bugs in the
  source workbook on purpose. Do not "fix" one without checking with CoEZET.
- **`src/components/ui/` is generated shadcn/ui code.** Do not hand-edit; regenerate or
  wrap.
- **Powertrain order is fixed** by `POWERTRAINS` in `extracted.ts`. Charts, tables and
  exports all iterate that array so the ordering stays consistent everywhere.
- **Colours** come from `POWERTRAIN_COLORS` / `SEGMENT_COLORS` / `APPLICATION_COLORS`, not
  from ad-hoc hex values in chart components.
