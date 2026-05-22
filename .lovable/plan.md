# Dashboard Improvements — Implementation Plan

Six focused UX changes. No simulation logic touched.

## 1. Summary KPI Row

**New:** `src/components/KpiCard.tsx` — `{ label, value, context? }`. Tabular-nums, muted label, large bold value, optional small context line.

**Edit:** `src/pages/Index.tsx` — insert a 5-column grid (`grid-cols-2 md:grid-cols-3 lg:grid-cols-5`) between `<InputPanel />` and the charts section. Cards:


| Label             | Value                                                        | Source          |
| ----------------- | ------------------------------------------------------------ | --------------- |
| Year of 50% ZET   | `result.year50PctZet ?? '—'`                                 | direct          |
| ZET Share 2045    | `(years.find(y=>y.year===2045).zetShare*100).toFixed(1)+'%'` | computed inline |
| Total ZET Sales   | `(totalZetSales/1e6).toFixed(1)+'M trucks'`                  | direct          |
| Diesel Stock Peak | `result.dieselStockPeakYear`                                 | direct          |
| CO₂ Avoided       | `Math.round(cumulativeCO2Avoided).toLocaleString()+' Mt'`    | direct          |


No sparklines.

## 2. Powertrain Color Consistency

**New:** `src/lib/constants/colors.ts` exporting `PT_COLORS` with the 6 hexes from the spec.

**Edit chart files** to import `PT_COLORS` instead of `POWERTRAIN_COLORS`:

- `AnnualSalesChart.tsx`, `ShareChart.tsx`, `StockChart.tsx`, `EmissionsChart.tsx`, `ZETPenetrationChart.tsx`, `TCOParityChart.tsx`

(Leave the existing `POWERTRAIN_COLORS` in `extracted.ts` alone per "don't touch extracted.ts" — just stop referencing it from charts.)

## 3. Chart Header — Subtitle Prop

**Edit:** `src/components/ChartCard.tsx` — add optional `subtitle?: string` prop, render below title as `text-xs text-muted-foreground`. Existing `description` stays as-is (it already serves this role); rename usage so `subtitle` shows scenario context like `"Units sold per year · BAU scenario"`. To pass scenario name, each chart accepts a new optional `scenarioName` prop from `Index.tsx` (passed once) and composes its own subtitle string.

Subtitle strings per the spec.

## 4. Scenario Diff Pills

**Edit:** `src/components/ScenarioPicker.tsx` — below the `<Select>`, render a flex-wrap row of small `<Badge variant="secondary">` pills computed from a static lookup:

```ts
const SCENARIO_DIFFS: Record<ScenarioName, string[]> = {
  BAU: [],
  'BWS-1': ['Interest 11%', 'BET incentive ₹5k/kWh', 'Toll 50% waiver 5yr'],
  'BWS-2': ['Interest 10%', 'BET incentive ₹7.5k/kWh', 'Toll 75% waiver 5yr'],
  BEST: ['Interest 10%', 'BET incentive ₹10k/kWh', 'Toll 100% waiver 5yr'],
};
```

Hidden when `activeScenario === 'BAU'` or `'Custom'`.

## 5. Recalculation Feedback

**Edit:** `src/hooks/useSimulation.ts` — change return to `{ result, isComputing }`. Set `isComputing=true` on configKey change, `false` after `setResult`. Update existing call sites (`Index.tsx`, anywhere else) to destructure.

**Edit:** `src/pages/Index.tsx` — wrap charts grid in a div with `style={{ opacity: isComputing ? 0.6 : 1, transition: 'opacity 0.2s' }}`. Optional: pulse a thin `bg-primary` bar at top of charts section while computing. Skip the green-flash for now (border flicker is more annoying than helpful on multiple charts).

## 6. Model Health Tooltip

**Edit:** `src/components/ModelHealthBadge.tsx` — wrap the existing trigger badge in a shadcn `<Tooltip>` (in addition to current click-to-expand `Collapsible`). Tooltip content shows: `"X/Y checks passing"` plus, if failures exist, `"Failing: " + checks.filter(c=>!c.passed).map(c=>c.message).join('; ')` (truncated to ~200 chars). Add `<TooltipProvider>` in `Index.tsx` if not already present (it usually is via App).

## Files

**New:**

- `src/components/KpiCard.tsx`
- `src/lib/constants/colors.ts`

**Edited:**

- `src/pages/Index.tsx`
- `src/components/ChartCard.tsx`
- `src/components/ScenarioPicker.tsx`
- `src/components/ModelHealthBadge.tsx`
- `src/hooks/useSimulation.ts`
- 6 chart files (color import swap + receive `scenarioName` prop for subtitle)

**Not touched:** simulation, `extracted.ts`, `scenarios.ts`, chart data structures.

&nbsp;

> Approved. One fix to the Scenario Diff Pills (item 4):
>
> The diff values you listed don't match the actual scenario configs. Use these instead (from the original `scenarios.ts`):
>
> ts
>
> ```ts
> const SCENARIO_DIFFS: Record<string, string[]> = {
>   BAU: [],
>   'BWS-1': ['BET ₹5k/kWh till 2035', 'FCET ₹15k/kWh till 2035', 'H₂ blending allowed'],
>   'BWS-2': ['BWS-1 + cheaper H₂', '₹2/kWh elec subsidy', '50% toll 10yr', 'GVW relief'],
>   'BEST': ['₹10k→5k BET', '₹30k→15k FCET', '10% interest', '100% toll 5yr', 'Range concern gone'],
> };
> ```
>
> Interest rate is 12% for BAU, BWS-1, AND BWS-2. Only BEST gets 10%. Your plan says BWS-1 = 11% and BWS-2 = 10% — those are wrong.
>
> Everything else: ship as written.

&nbsp;