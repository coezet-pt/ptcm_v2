# 4. Parameters, UI and Exports

A map from "what the user clicks" to "what the code does". Use this when someone asks for
a new input, or asks why a lever does not move a chart.

## The sidebar (`components/InputPanel.tsx`)

```
┌ [Download ▾] [Upload]                      ParameterFileIO.tsx
│  helper text about the file format
├───────────────────────────────────────────
│ Card 1 — always visible, sections collapsed
│   ▸ Fuel/Energy Cost          ParameterRow × 7   ← CONFIGURABLE_PARAM_GROUPS
│   ▸ Key Aggregate Cost        ParameterRow × 4   ← CONFIGURABLE_PARAM_GROUPS
│   ▸ Key Aggregate Life        KeyAggregateLifeInput.tsx
│   ▸ Hydrogen Source Mix       HydrogenSourceMix.tsx
├───────────────────────────────────────────
│ Card 2 — accordion, collapsed
│   ▸ Funding                   FundingInput.tsx × 2 (non-ZET, ZET)
│   ▸ Policy support            GvwForZet.tsx + TollWaiver.tsx
└───────────────────────────────────────────
  Action bar (sticky bottom)    InputPanel.tsx → InputActionBar
    [Unapplied changes] [Reset to defaults]
    [Discard] [Apply Changes]
```

### Trajectory parameters (`ParameterRow`)

Each row edits one `ParameterConfig`: a 2026 base value plus six CAGRs, with optional
per-year pins. Which parameters appear, and in which group, is defined in
`lib/constants/configurableParams.ts`; labels/units/tooltips/caps come from
`lib/constants/parameterMeta.ts`.

| Group | Parameter | Key | Unit |
|---|---|---|---|
| Fuel/Energy Cost | Diesel | `diesel_price_per_l` | ₹/L |
| | CNG | `cng_price_per_kg` | ₹/kg |
| | LNG | `lng_price_per_kg` | ₹/kg |
| | Electricity at Charging Point | `electricity_incl_caas_per_kwh` | ₹/kWh |
| | Green Hydrogen Production | `green_h2_production_per_kg` | ₹/kg |
| | Grey Hydrogen Production | `grey_h2_production_per_kg` | ₹/kg |
| | H₂ Compression, Transport & Dispensing | `h2_compression_storage_per_kg` | ₹/kg |
| Key Aggregate Cost | Battery | `battery_cost_per_kwh` | ₹/kWh |
| | Fuel Cell | `fuel_cell_cost_per_kw` | ₹/kW |
| | Hydrogen Tank | `h2_tank_cost_per_kg` | ₹/kg |
| | LNG Tank | `lng_tank_cost_per_kg` | ₹/kg |

The `ParameterKey` union in `types.ts` has **17** members. The six not in the sidebar
(`adblue_per_l`, `diesel_vehicle_growth`, `engine_trans_growth`, `e_powertrain_growth`,
`grey_h2_blend_fraction`, `lng_valves_piping_per_vehicle`) still drive the engine from their
BAU defaults — they were removed from the UI, not from the model. `grey_h2_blend_fraction`
is fully dead: the blend is driven by `policy.grey_h2_blend_*` instead.

**CAGR cap:** `ParameterEditor.tsx` sets `DEFAULT_CAGR_MAX = 0.20`. Exceeding it shows a red
"max ±20% allowed" note but the value is still accepted — it is a warning, not a block.

### Other sidebar inputs

| Widget | Writes to | Reaches the model via |
|---|---|---|
| `KeyAggregateLifeInput` | `fixed.battery_life_cycles` (3000), `fixed.fuel_cell_life_hours` (25000) | `tco.ts getMaintenancePerKm` — a delta vs the default-life replacement cost, exactly 0 at defaults |
| `HydrogenSourceMix` | `policy.h2_source_mix`, `grey_h2_blend_mode`, `grey_h2_blend_uniform`, `grey_h2_blend_bands` | `tco.ts greyH2FractionForYear` → H2 price **and** H2 emission factors |
| `FundingInput` (non-ZET) | `fixed.interest_rate_ice`, `fixed.loan_tenure_years_nonzet` | `tco.ts` annuity for Diesel/CNG/LNG/H2-ICE |
| `FundingInput` (ZET) | `policy.interest_rate_zet`, `policy.loan_tenure_years` | `tco.ts` annuity for BET/FCET |
| `GvwForZet` | `policy.zet_additional_gvw_kg` (7 size classes, default 0) | `choiceModel.ts computeBucketPayload` → payload factor |
| `TollWaiver` | `policy.toll_waiver_bands` (6 bands, 0–1) | `tco.ts tollWaiverForYear` → `toll × (1 − band)` for BET/FCET |

### Policy levers with no UI

`PolicyConfig` is much larger than the sidebar. These are set only by scenario presets and
by parameter-file import — there is no on-screen control for them:

`bet_demand_incentive_per_kwh`, `fcet_demand_incentive_per_kwh` and their phase-2/end-year
fields, `electricity_subsidy_per_kwh` + `electricity_subsidy_end_year`,
`bet_inflection_year` / `h2ice_inflection_year` / `fcet_inflection_year`,
`bet_maturity_year` / `h2ice_maturity_year` / `fcet_maturity_year`,
`bet_resale_2046_plus`, `diesel_price_5pct_yoy_after_2045`,
`range_filling_concern_after_2035`, `gvw_payload_compensation_t`.

Orphaned components exist for some of these and are **not mounted anywhere**:
`PolicyLevers.tsx`, `RatingMatrix.tsx`, `SegmentBasePricesTable.tsx`,
`BucketMaintenanceInput.tsx`. If you need a lever back, these are your starting point —
check whether they still compile against the current `PolicyConfig` first.

### Which levers move which charts

Some levers are **mix-only** — they redistribute share without changing total sales, because
TIV comes from `TIV_PROJECTION` and is never a function of policy.

| Lever | Visible effect |
|---|---|
| GVW for ZET | Powertrain mix (BET ↔ FCET). Small — ZET is ~85 % saturated by 2045. |
| H₂ source mix | Powertrain mix (H2-ICE/FCET via cost) + TCO parity + Emissions (via grey factor). |
| Toll waiver | ZET TCO → powertrain mix. |
| Battery / fuel-cell cost | ZET TCO → mix, and TCO parity year. |
| Diesel price | Everything downstream of TCO. |
| Total sales / TIV | **Nothing moves it.** It is a fixed projection. |

Charts read the **applied** config, so nothing changes until Apply Changes is clicked.

## Charts (`components/ChartSections.tsx`, `components/charts/`)

Thirteen charts across three tabs. Each is wrapped in `ChartCard`, which provides the title,
an expandable data table, and a footer row of export buttons (View table / CSV / Excel / PNG).

| Tab | Chart | File |
|---|---|---|
| projection - powertrain | Annual Sales Volumes (total TIV) | `TotalSalesChart.tsx` |
| | Annual sales by powertrain | `AnnualSalesChart.tsx` |
| | Market share | `ShareChart.tsx` |
| | Fleet stock | `StockChart.tsx` |
| | ZET penetration | `ZETPenetrationChart.tsx` |
| | ▸ Segment sales / stock, Application sales / stock (collapsed group, with an Overall + per-powertrain filter) | `Segment*.tsx`, `Application*.tsx` |
| impact - emission | Annual emissions by powertrain | `EmissionsChart.tsx` |
| | Cumulative CO₂ avoided | `CumulativeAvoidedChart.tsx` |
| impact - fuel/energy requirement | Diesel displaced | `DieselSavingsChart.tsx` |
| | Energy requirements by carrier | `EnergyRequirementsChart.tsx` |

Segment/application chart rows include a `Total` column in the table, CSV, Excel and report
outputs — it is not drawn as an area on the chart.

**Adding a chart:** create the component in `charts/`, wrap the body in `ChartCard`, register
it in the right branch of `ChartSections.tsx`, and add it to `ReportDocument.tsx` if it
should appear in the PDF (the report renders its own copy of every chart because only one
tab is mounted at a time).

## KPI rail (`KpiRail` / `KpiCard`, defined in `pages/Index.tsx`)

Five metrics: Market Size 2055, 50 % ZET Adoption year, Diesel Peak Sales year,
CO₂ Reduction 2026–55 (MMT, cumulative vs an all-diesel fleet), Diesel Saved 2026–55
(billion litres). Collapsed by default on large screens; a 2/3-column grid below `lg`.

## Model health badge (`ModelHealthBadge.tsx`)

Runs `runSanityChecks(simResult)` and shows pass/fail counts. Click to see which of the 12
checks failed. See [03](03-model-reference.md) for the check list.

## Exports

| Output | Code | Notes |
|---|---|---|
| Chart PNG | `exporters.ts exportPNG` | `html-to-image`, 2× pixel ratio |
| Chart CSV | `exporters.ts exportCSV` | `papaparse`; a UTF-8 BOM is added for Excel |
| Chart XLSX | `exporters.ts exportXLSX` | `xlsx` (SheetJS), auto-sized columns |
| Parameter file CSV / XLSX | `lib/paramFile.ts` | Round-trips the whole configurable set |
| PDF report | `lib/report.tsx` + `ReportDocument.tsx` | jsPDF, A4 portrait, 2 charts/page |

### The parameter file format

One spec (`paramFile.ts`) drives both export and import, so the file layout and the dashboard
cannot drift apart. Columns:

```
Parameter | Unit | 2026 | CAGR 2026-30 … CAGR 2051-55 | 2055 (projected) | Section | Key
```

- The **`Key` column is the source of truth** on import, so rows may be reordered.
- Blank cells keep the current value.
- `2055 (projected)` is informational on export and ignored on import.
- Scalars and toggles (battery life, funding rates, H₂ source mix, GVW, toll bands) use only
  the `2026` column; their CAGR cells stay blank.
- Per-year pins are intentionally **not** represented in the file and survive an import.
- Files downloaded before the layout change (with a `Value (2026)` header) still import.
- Import merges onto the **draft**, so the user must click Apply Changes.

Round-trip behaviour is covered by `src/test/paramFile.test.ts` — extend it whenever you add
a field to the spec.

### The PDF report

`downloadReport()` mounts a detached `.report-capture` host off-screen, renders
`ReportDocument` (parameter tables + every chart from every tab), waits ~1.9 s for Recharts'
entry animation, then rasterises each `[data-report-block]` to JPEG and paginates onto A4.
Section banners always start a fresh page; charts cap at 2 per page. It takes 1–2 minutes.
There is no unit test for it — see `.claude/skills/verify/SKILL.md` for how to drive it
headlessly.
