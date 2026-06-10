## Goal

Match the Dashboard sheet's dual input pattern: every cost/maintenance parameter (rows 1–9) should let the user either override the value at a specific year (2026–2055) OR adjust the CAGR % for one of the six year-ranges. The current UI exposes only CAGRs. This change is UI + state only — no engine math changes beyond a tiny interpolation tweak in `timeSeries.ts`.

## UX

Each parameter row in `InputPanel` stays compact (label + small "current 2025 value" + chevron). Clicking the row expands an inline panel containing:

- **Spot-year editor** — Year dropdown (2026…2055) + numeric value input + "Pin" button. Pinned years are listed below as removable chips ("2032: ₹95.40 ✕").
- **CAGR editor** — Six rows, one per range (2025-30 / 31-35 / 36-40 / 41-45 / 46-50 / 51-55), each a small `%` input (±10% cap, existing inline error).
- **Sparkline** of the resulting 2025-2055 trajectory, so the user sees the combined effect.

For params 7-9 the existing bucket dropdown sits at the top of the expanded panel; everything below is per-bucket.

Params 10-13 (battery life, FC life, funding rate+tenure) are unchanged.

## Behaviour

- Pinning year Y sets `overrides[Y] = value`.
- Editing the CAGR for a range clears all overrides whose year falls inside that range (decision: CAGR wins).
- Reset-to-defaults clears all overrides too.
- "Apply Changes" / "Discard" still gate engine recompute.

## Technical

**`src/lib/types.ts`** — extend `ParameterConfig`:
```ts
overrides?: Record<number, number>;  // year → absolute value
```

**`src/lib/sim/timeSeries.ts`** — single change in the per-year loop: after computing `arr[i] = arr[i-1] * (1+delta)`, if `p.overrides?.[year]` is defined, set `arr[i] = p.overrides[year]`. The next year's compounding then proceeds from the override. (One-line interpolation tweak, no formula rewrite.)

**`src/components/ParameterRow.tsx`** — replace inline 6-CAGR layout with collapsed-by-default summary; on expand, render new `ParameterEditor` panel (extract into a sibling component) containing:
- spot-year `Select` (2026-2055) + value `Input` + "Pin" button
- list of pin chips with remove (✕)
- six CAGR `Input`s with their existing ±10% validation
- mini sparkline (reuse `recharts` `LineChart`; the editor will compute its own preview series via `buildTimeSeries` on the single draft param)

**`src/components/BucketMaintenanceInput.tsx`** — switch the per-bucket editor to use the same `ParameterEditor` panel so params 7-9 inherit the spot-year + CAGR + sparkline UX.

**`src/contexts/ScenarioContext.tsx`** — add `setOverride(paramKey, year, value)` and `clearOverride(paramKey, year)` mutators; CAGR mutator clears overrides whose year falls in the edited range.

**Defaults / presets** — `BAU_PARAMETERS` and the other presets need no schema change; `overrides` is optional and defaults to undefined.

## Out of scope

- No changes to `tco.ts`, `choiceModel.ts`, `pttm.ts`, `stockEmissions.ts`.
- No changes to chart components or scenario presets.
- Per-param cap values, ±10% CAGR cap, bucket dropdown, funding inputs, policy-levers accordion — all stay as-is.
