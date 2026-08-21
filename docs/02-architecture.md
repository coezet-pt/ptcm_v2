# 2. Architecture

## Stack

| Layer | What | Notes |
|---|---|---|
| Framework | React 18 + TypeScript | Function components and hooks only. |
| Build | Vite 5 (`@vitejs/plugin-react-swc`) | Dev port 8080. `@` means `./src`. |
| Styling | Tailwind CSS 3 + shadcn/ui | Colour tokens are CSS variables in `src/index.css`. |
| Charts | Recharts 3 | Always `type="monotone"`, `dot={false}`. |
| State | React Context (`ScenarioContext`) | No Redux, no Zustand. |
| Routing | react-router-dom 6 | Two routes: `/` and a catch-all. |
| Exports | `html-to-image`, `papaparse`, `xlsx`, `jspdf` | All in the browser. |
| Backend | **none** | Supabase was removed in commit `94b0b9d`. |

Nothing is saved anywhere. Reloading the page resets everything to the BAU defaults. The
only way data leaves the browser is the export buttons (PNG / CSV / XLSX / PDF) and the
parameter file download.

## The pipeline

```
                       ScenarioContext
             ┌──────────────────────────────────────────┐
  UI edits ─▶│ draftConfig  ──[Apply Changes]──▶  config │
             └──────────────────────────────────────────┘
                                │  (ScenarioConfig)
                                ▼
                    useSimulation(config)     ← waits 300 ms after the last edit
                                │
                                ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ 1. timeSeries.ts    buildTimeSeries()                           │
  │    17 inputs × 30 years. Each grows through 6 CAGR bands        │
  │    (2026-30, 31-35, 36-40, 41-45, 46-50, 51-55). A year can     │
  │    also be pinned to a fixed value.                             │
  ├─────────────────────────────────────────────────────────────────┤
  │ 2. tco.ts           computeTCO()  ×3, for 2045 / 2050 / 2055    │
  │    Per bucket × powertrain: vehicle price, then cost per km     │
  │    over 7 years = capex + fuel + maintenance + manpower + toll  │
  │      + insurance − resale.                                      │
  ├─────────────────────────────────────────────────────────────────┤
  │ 3. choiceModel.ts   computeShares() ×3                          │
  │    5-factor share model per bucket → target shares at 2045,     │
  │    2050 and 2055. The 2055 run is ZET-only by design (the       │
  │    Excel "100% ZET 2055" sheet).                                │
  ├─────────────────────────────────────────────────────────────────┤
  │ 4. pttm.ts          computePTTM()                               │
  │    Fills in every year between those three anchors. Gompertz    │
  │    curves for BET / H2-ICE / H2-FCET, Weibull for CNG / LNG.    │
  │    Diesel is whatever is left over.                             │
  ├─────────────────────────────────────────────────────────────────┤
  │ 5. stockEmissions.ts computeStockEmissions()                    │
  │    Adds sales into the fleet, retires old trucks, then works    │
  │    out CO₂, energy demand and the segment/application splits.   │
  └─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                        SimulationResult
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
   ModelHealthBadge        KpiRail /            ChartSections
   (12 health checks)      KpiCard              (13 charts, 3 tabs)
                                                       │
                                                       ▼
                                          PNG / CSV / XLSX / PDF export
```

Every stage is a pure function with no side effects. The whole run takes well under 100 ms.
The 300 ms delay in `useSimulation` is there to avoid rerunning on every keystroke, not
because the maths is slow.

## Draft vs applied — the key design decision

`ScenarioContext` keeps **two** copies of the settings:

| | What it is |
|---|---|
| `draftConfig` | What the user is typing into the sidebar right now. |
| `config` | What the charts are actually showing. |

Every `updateParameter` / `updatePolicy` / `updateFixed` / `updateSegmentPrice` /
`updateBucketMaintenance` / `setParameterOverride` writes to **`draftConfig` only**, switches
`activeScenario` to `Custom`, and sets `isDirty = true`.

`config` only changes when the user clicks **Apply Changes**, which deep-copies draft into
config. `useSimulation` reads `config`, so nothing recalculates until that click.

What this means in practice:

- Uploading a parameter file loads into the **draft**. Charts do not move until Apply
  Changes is clicked. That is on purpose.
- New input widgets must write to a `draftConfig` setter, never to `config`.
- `discardChanges()` copies config back into draft. `resetToDefaults()` / `resetToBAU()`
  reset both to the BAU values.

### The settings shape

```ts
interface ScenarioConfig {
  parameters:        Record<ParameterKey, ParameterConfig>;  // cost trajectories
  policy:            PolicyConfig;                           // policy settings
  fixed:             FixedParameters;                        // values that don't vary by year
  segmentBasePrices: SegmentBasePrices;                      // vehicle price per size
}

interface ParameterConfig {
  baseValue: number;                      // the 2026 value
  d2530: number; d3135: number;           // growth rate per 5-year band
  d3640: number; d4145: number;
  d4650: number; d5155: number;
  overrides?: Record<number, number>;     // pin a specific year to a fixed value
}
```

All in `src/lib/types.ts`. Defaults are in `extracted.ts` as `BAU_PARAMETERS`, `BAU_POLICY`,
`BAU_FIXED` and `BAU_SEGMENT_BASE_PRICES`.

**Growth rates and pinned years interact.** Editing a growth rate clears any pinned years
inside that band (`clearOverridesInRangeIfCagr` in `ScenarioContext.tsx`). This stops
"I pinned 2033 to ₹95, then changed the 2031–35 growth rate" from producing a curve that
contradicts itself.

## Scenario presets

`src/lib/constants/scenarios.ts` has four full configs: **BAU**, **BWS-1**, **BWS-2** and
**BEST**. They differ in policy settings (incentives, interest rate, electricity subsidy,
toll waiver, inflection and maturity years) and, for BEST, in three cost trajectories.

> **Only BAU (shown as "Default") and Custom appear in the UI.** `ScenarioPicker.tsx` has
> `const SCENARIOS = ['BAU', 'Custom']`, and `Custom` is rendered disabled — it just shows
> that the user has edited something. BWS-1, BWS-2 and BEST work fine and are reachable from
> code and tests, but were deliberately hidden. To show them, add them to that array. Their
> description text is already written in `SCENARIO_DIFFS`.

## Page layout (`pages/Index.tsx`)

```
┌── header (sticky) ─────────────────────────────────────────────┐
│ PTCM Dashboard · India M&HDT Trucks   [Health badge] [Scenario]│
├───────────┬─────────────────────────────────────┬──────────────┤
│ aside     │ main                                │ aside        │
│ 360px     │                                     │ KpiRail      │
│           │ Title + [Download report]           │ (collapsible)│
│ InputPanel│ ParameterSummaryTable               │              │
│           │ ChartSections (3 tabs)              │ 5 KPI cards  │
│ ───────── │                                     │              │
│ Action bar│                                     │              │
│ Apply /   │                                     │              │
│ Discard   │                                     │              │
└───────────┴─────────────────────────────────────┴──────────────┘
```

Below the `lg` breakpoint the sidebar moves above the content and the KPI rail becomes a
2- or 3-column grid.

### Chart tabs (`ChartSections.tsx`)

**Only one tab is rendered at a time.** That is why the PDF report has to build its own
separate copy of every chart (`lib/report.tsx`).

| Tab | Charts |
|---|---|
| `projection - powertrain` | TotalSales, AnnualSales, Share, Stock, ZETPenetration, plus a collapsed "Applications & segments" group of 4 charts with an Overall / per-powertrain filter |
| `impact - emission` | Emissions, CumulativeAvoided |
| `impact - fuel/energy requirement` | DieselSavings, EnergyRequirements |

Every chart sits inside `ChartCard`, which adds the title, an expandable data table, and the
export buttons (View table / CSV / Excel / PNG).

## Conventions to follow

- **Say where a number came from.** Almost every constant has a comment naming the Excel
  sheet and cell (`'Changing with year' rows 92-100`, `'No change with year' D22`). Keep
  doing this — it is the only thing that makes the model checkable later. See
  [03](03-model-reference.md).
- **Copied Excel mistakes are labelled `Excel quirk:`.** They reproduce errors in the source
  workbook on purpose. Do not "fix" one without asking CoEZET.
- **`src/components/ui/` is generated shadcn/ui code.** Do not hand-edit; regenerate or wrap.
- **Powertrain order is fixed** by `POWERTRAINS` in `extracted.ts`. Charts, tables and
  exports all loop over that array so the order stays the same everywhere.
- **Colours** come from `POWERTRAIN_COLORS` / `SEGMENT_COLORS` / `APPLICATION_COLORS`, not
  from hex values typed into chart files.
