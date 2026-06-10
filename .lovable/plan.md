
# Input Panel — v4 Dashboard Rebuild

UI/input-structure change driven by the Dashboard sheet of `CoEZET_PTCM_v4.xlsx`. The simulation engine (`tco.ts`, `choiceModel.ts`, `pttm.ts`, `stockEmissions.ts`) is not touched. The only sim-adjacent edit is extending `timeSeries.ts` from 4 to 6 CAGR ranges (mechanical).

## Confirmed decisions
- Battery & Fuel Cell base value: **no hard cap** (only ±10% applies to CAGRs, ₹500 cap applies only to fuel rows 1–4).
- Diesel / LNG / CNG: **independent CAGR set per fuel** (3 × 6 = 18 CAGR fields).
- Funding rate **and** tenure are **both editable** for ZET and non-ZET.
- Maintenance per bucket: **dropdown — one bucket at a time** for params 7–9.

## Final parameter inventory (13)

Pattern A (base value + 6 CAGR ranges: 2025-30, 2031-35, 2036-40, 2041-45, 2046-50, 2051-55):
1. Diesel Price (₹/L, default 88.93, cap ₹500)
   LNG Price (₹/kg, default 83, cap ₹500)
   CNG Price (₹/kg, default 87, cap ₹500)
2. Energy Price incl. CAAS (₹/kWh, default 11.93, cap ₹500)
3. Green H₂ Production (₹/kg, default 546.50, cap ₹500)
4. H₂ Compression/Transport/Dispense (₹/kg, default 175, cap ₹500)
5. Battery Price (₹/kWh, default 9,900, no cap)
6. Fuel Cell Price (₹/kW, default 36,000, no cap)

Pattern A + Bucket selector (B1–B14):
7. Diesel Maintenance ₹/km per bucket
8. BET Aggregates Maintenance ₹/km per bucket (incl. battery replacement)
9. FCET Aggregates Maintenance ₹/km per bucket (incl. battery + FC replacement)

Pattern B (simple constants):
10. Battery Life — cycles (default 3,000; 4-digit)
11. Fuel Cell Life — hours (default 25,000; 5-digit)
12. Funding non-ZET — Rate % (12) + Tenure yrs (7)
13. Funding ZET — Rate % (12) + Tenure yrs (7)

All CAGR inputs capped ±10% with inline error (no silent clamp).

## UI layout

```text
┌─ Primary Cost Trajectories (always open) ───────────────────┐
│  Fuel Prices                                                │
│    Diesel  [88.93] ₹/L   CAGR % per range: [ ][ ][ ][ ][ ][]│
│    LNG     [83.00] ₹/kg  CAGR % per range: [ ][ ][ ][ ][ ][]│
│    CNG     [87.00] ₹/kg  CAGR % per range: [ ][ ][ ][ ][ ][]│
│  Energy Price (incl. CAAS)  [11.93] ₹/kWh   CAGR: [..]      │
│  Green H₂ Production        [546.50] ₹/kg   CAGR: [..]      │
│  H₂ Compression & Dispense  [175]    ₹/kg   CAGR: [..]      │
│  Battery Price              [9,900]  ₹/kWh  CAGR: [..]      │
│  Fuel Cell Price            [36,000] ₹/kW   CAGR: [..]      │
└─────────────────────────────────────────────────────────────┘
┌─ Advanced (collapsed) ──────────────────────────────────────┐
│  ▸ Maintenance (per bucket)                                 │
│      Bucket: [B1 ▼]                                         │
│      Diesel Maint    [..] ₹/km  CAGR: [..]                  │
│      BET Maint       [..] ₹/km  CAGR: [..]                  │
│      FCET Maint      [..] ₹/km  CAGR: [..]                  │
│  ▸ Constants                                                │
│      Battery Life [3000] cycles                             │
│      Fuel Cell Life [25000] hours                           │
│      Funding non-ZET   Rate [12]%  Tenure [7] yrs           │
│      Funding ZET       Rate [12]%  Tenure [7] yrs           │
└─────────────────────────────────────────────────────────────┘
[Reset to defaults]            [Discard]  [Apply Changes ▶]
```

Sticky Apply/Discard bar is preserved.

## Files to change

- **`src/lib/types.ts`** — extend `ParameterConfig` from 4 deltas to 6: `d2530, d3135, d3640, d4145, d4650, d5155`. Add new Pattern-B field types on `FixedParameters` (battery_life_cycles already exists; add `fc_life_hours`, `funding_nonzet_rate`, `funding_nonzet_tenure`, `funding_zet_rate`, `funding_zet_tenure`). Add a `bucketMaintenance: Record<'diesel'|'bet'|'fcet', Record<BucketId, ParameterConfig>>` shape.
- **`src/lib/sim/timeSeries.ts`** — replace the 4-range if/else with a 6-range mapping (≤2030 → d2530; ≤2035 → d3135; ≤2040 → d3640; ≤2045 → d4145; ≤2050 → d4650; else d5155). Same compound logic.
- **`src/lib/constants/extracted.ts`** — refresh defaults for the 13 params with 6-range CAGRs computed from the Dashboard "Changing with year" rows: range CAGR = `(V_end / V_start)^(1/years) − 1`. Bucket maintenance defaults read from the per-bucket section.
- **`src/lib/constants/parameterMeta.ts`** — update labels/units/tooltips/caps for the 13 params; mark cap policy (per-row max + per-CAGR ±10%).
- **`src/components/ParameterRow.tsx`** — render 6 CAGR inputs (label row 2025-30 / 2031-35 / 2036-40 / 2041-45 / 2046-50 / 2051-55), enforce caps with inline error message, no clamping.
- **New `src/components/BucketMaintenanceInput.tsx`** — bucket dropdown (B1–B14) + 3 stacked ParameterRow-style inputs (diesel/BET/FCET) bound to the selected bucket.
- **New `src/components/FundingInput.tsx`** — rate% + tenure pair, used twice (ZET / non-ZET).
- **`src/components/InputPanel.tsx`** — rebuild to the structure above. Primary card always visible; Advanced accordion with two items (Maintenance, Constants). Keep existing `useScenario` + debounced recompute wiring intact. Add a "Reset to defaults" button that calls a new `resetToDefaults()` on the context (uses the refreshed defaults from `extracted.ts`).
- **`src/contexts/ScenarioContext.tsx`** — add `resetToDefaults()`; extend `updateParameter` signature to accept the new 6 delta keys; add `updateBucketMaintenance(metric, bucket, field, value)` and `updateFunding(kind, field, value)` helpers.
- **`src/components/FixedParamGroup.tsx`, `PolicyLevers.tsx`, `SegmentBasePricesTable.tsx`** — keep files but remove their mounting from `InputPanel` (they fall outside the 13-param spec). Note: scenario presets in DB still carry the old 4-delta shape; a tiny adapter in `ScenarioContext` will map legacy `d2630/d3140/d4150/d5155` → the new 6 ranges (duplicate 2630→2530+3135 split, 4150→4145+4650 split) so presets keep loading without engine changes. This adapter is the only legacy-compat code added.

## Out of scope (explicit)

- No changes to `tco.ts`, `choiceModel.ts`, `pttm.ts`, `stockEmissions.ts`.
- No chart, KPI, or scenario-preset DB changes.
- No new bucket-maintenance consumption inside the sim engine yet (the values flow into state; engine wiring can come in a follow-up round).

## Acceptance

- Primary card shows fuel prices (3 fuels, independent CAGRs), energy, green H₂, H₂ dispense, battery, fuel cell — each with base + 6 CAGR inputs.
- Advanced accordion → Maintenance (bucket dropdown) + Constants (4 simple inputs incl. two funding rate/tenure pairs).
- Caps enforced with inline errors (₹500 for fuel rows, ±10% for every CAGR, digit-count for life fields); no silent clamping.
- Reset restores all 13 to workbook defaults.
- Edits trigger the existing 300 ms debounced recompute; charts continue updating.
- Build passes; existing presets still load via the legacy-shape adapter.
