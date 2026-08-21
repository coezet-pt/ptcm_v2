# 4. Inputs, Charts and Exports

A map from "what the user clicks" to "what the code does". Use this when someone wants a new
input, or asks why changing something does not move a chart.

## The sidebar (`components/InputPanel.tsx`)

```
┌ [Download ▾] [Upload]                      ParameterFileIO.tsx
│  help text about the file format
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

### Cost inputs (`ParameterRow`)

Each row edits one cost: a 2026 value plus six growth rates, with the option to pin
individual years. Which inputs appear and in which group is set in
`lib/constants/configurableParams.ts`. Labels, units, tooltips and caps come from
`lib/constants/parameterMeta.ts`.

| Group | Input | Key | Unit |
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

`ParameterKey` in `types.ts` has **16** entries. The five not in the sidebar
(`adblue_per_l`, `diesel_vehicle_growth`, `engine_trans_growth`, `e_powertrain_growth`,
`lng_valves_piping_per_vehicle`) still drive the model from their BAU defaults — they were
taken out of the UI, not out of the model.

**Growth rate cap:** `ParameterEditor.tsx` sets `DEFAULT_CAGR_MAX = 0.20`. Going above it
shows a red "max ±20% allowed" note, but the value is still accepted. It is a warning, not a
limit.

### Other sidebar inputs

| Widget | Writes to | Reaches the model through |
|---|---|---|
| `KeyAggregateLifeInput` | `fixed.battery_life_cycles` (3000), `fixed.fuel_cell_life_hours` (25000) | `tco.ts getMaintenancePerKm` — a difference from the default replacement cost, exactly 0 at defaults |
| `HydrogenSourceMix` | `policy.h2_source_mix`, `grey_h2_blend_mode`, `grey_h2_blend_uniform`, `grey_h2_blend_bands` | `tco.ts greyH2FractionForYear` → hydrogen price **and** hydrogen emissions |
| `FundingInput` (non-ZET) | `fixed.interest_rate_ice`, `fixed.loan_tenure_years_nonzet` | `tco.ts` loan calculation for Diesel/CNG/LNG/H2-ICE |
| `FundingInput` (ZET) | `policy.interest_rate_zet`, `policy.loan_tenure_years` | `tco.ts` loan calculation for BET/FCET |
| `GvwForZet` | `policy.zet_additional_gvw_kg` (7 size classes, default 0) | `choiceModel.ts computeBucketPayload` → payload factor |
| `TollWaiver` | `policy.toll_waiver_bands` (3 bands, 0–1 — `TOLL_WAIVER_KEYS`) | `tco.ts tollWaiverForYear` → `toll × (1 − band)` for BET/H2-ICE/FCET |

### Settings with no on-screen control

`PolicyConfig` holds more than the sidebar shows. These have no widget:

- **Editable through the parameter file** (Download → edit → Upload), so they are still
  reachable: `bet_maturity_year` / `h2ice_maturity_year` / `fcet_maturity_year`,
  `electricity_subsidy_per_kwh` + `electricity_subsidy_end_year`.
- **Scenario presets only**: `bet_demand_incentive_per_kwh`, `fcet_demand_incentive_per_kwh`
  and their phase-2 and end-year fields, `bet_inflection_year` / `h2ice_inflection_year` /
  `fcet_inflection_year`, `bet_resale_2046_plus`, `diesel_price_5pct_yoy_after_2045`,
  `range_filling_concern_after_2035`, `gvw_payload_compensation_t`.

Half-built components for some of these used to sit in `src/components/` unused. They were
deleted in the cleanup — see [07](07-known-issues.md). If you need one of these settings
back, `git log` has them, but writing a fresh widget against the current `PolicyConfig` is
probably faster than reviving one.

> **Before adding a control, check the setting actually does something.** Costs are only
> calculated at 2045, 2050 and 2055, so anything that stops before 2045 can never change a
> result. The only settings still in that position are `bet_demand_incentive_per_kwh` and
> `fcet_demand_incentive_per_kwh` (plus phase 2; end years 2030/2035) — and that matches
> Excel, so do not "fix" it by extending the end years. See [03](03-model-reference.md) and
> `src/test/demandIncentive.test.ts`.
>
> `src/test/tollWaiver.test.ts` and `src/test/choiceAdjustment.test.ts` show how to prove a
> control is live. Copy that pattern whenever you add one.

### What each setting moves

Some settings only change the mix. Total sales come from `TIV_PROJECTION` and never depend on
policy.

| Setting | What it changes |
|---|---|
| GVW for ZET | Powertrain mix (BET vs FCET). Small, because ZET is already ~85% by 2045. |
| H₂ source mix | Powertrain mix (H2-ICE/FCET via cost), TCO parity, and emissions. |
| Toll waiver | ZET cost → powertrain mix. Strong: a full waiver lifts 2045 BET share from ~76% to ~93%. |
| Powertrain maturity year | Share adjustments at 2050 and 2055 → powertrain mix. Parameter file only. |
| Electricity subsidy | BET fuel cost → powertrain mix. Parameter file only; applies until `electricity_subsidy_end_year` (default 2055). |
| Battery / fuel-cell cost | ZET cost → mix, and TCO parity year. |
| Diesel price | Everything downstream of cost. |
| Total sales / TIV | **Nothing changes it.** It is a fixed projection. |

Charts read the **applied** settings, so nothing changes until Apply Changes is clicked.

## Charts (`components/ChartSections.tsx`, `components/charts/`)

Thirteen charts across three tabs. Each sits inside `ChartCard`, which adds the title, an
expandable data table, and export buttons (View table / CSV / Excel / PNG).

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

`TCOParityChart.tsx` also exists and works, but is not added to any tab. See
[07](07-known-issues.md).

Segment and application rows include a `Total` column in the table, CSV, Excel and report —
it is not drawn as an area on the chart.

**To add a chart:** create the component in `charts/`, wrap the body in `ChartCard`, register
it in the right branch of `ChartSections.tsx`, and add it to `ReportDocument.tsx` if it
should appear in the PDF. The report builds its own copy of every chart because only one tab
is rendered at a time.

## KPI cards (`KpiRail` / `KpiCard`, in `pages/Index.tsx`)

Five numbers: Market Size 2055, year 50% ZET is reached, year diesel sales peak, CO₂
reduction 2026–55 (MMT, total vs an all-diesel fleet), and diesel saved 2026–55 (billion
litres). Collapsed by default on large screens; a 2- or 3-column grid on smaller ones.

## Model health badge (`ModelHealthBadge.tsx`)

Runs `runSanityChecks(simResult)` and shows how many passed. Click it to see which of the 12
failed. The check list is in [03](03-model-reference.md).

## Exports

| Output | Code | Notes |
|---|---|---|
| Chart PNG | `exporters.ts exportPNG` | `html-to-image`, 2× resolution |
| Chart CSV | `exporters.ts exportCSV` | `papaparse`; adds a UTF-8 BOM so Excel opens it right |
| Chart XLSX | `exporters.ts exportXLSX` | `xlsx` (SheetJS), auto-sized columns |
| Parameter file CSV / XLSX | `lib/paramFile.ts` | Downloads and uploads the whole settings set |
| PDF report | `lib/report.tsx` + `ReportDocument.tsx` | jsPDF, A4 portrait, 2 charts per page |

### The parameter file

One definition (`paramFile.ts`) drives both download and upload, so the file layout and the
dashboard cannot drift apart. Columns:

```
Parameter | Unit | 2026 | CAGR 2026-30 … CAGR 2051-55 | 2055 (projected) | Section | Key
```

- The **`Key` column decides what a row means** on upload, so rows can be reordered.
- Blank cells keep the current value.
- `2055 (projected)` is for information only and is ignored on upload.
- Single values and toggles (battery life, funding rates, hydrogen mix, GVW, toll bands) use
  only the `2026` column; their growth cells stay blank.
- Pinned years are deliberately not in the file and survive an upload.
- Files downloaded before the layout change (with a `Value (2026)` header) still upload fine.
- Upload writes to the **draft**, so the user must click Apply Changes.

`src/test/paramFile.test.ts` covers download-then-upload. Extend it whenever you add a field.

### The PDF report

`downloadReport()` builds a hidden copy of the page off-screen, renders `ReportDocument`
(settings tables plus every chart from every tab), waits about 1.9 seconds for the chart
animations to finish, then turns each `[data-report-block]` into a JPEG and lays them out on
A4 pages. Section headings always start a new page, and charts are capped at 2 per page. It
takes 1–2 minutes. There is no unit test — see `.claude/skills/verify/SKILL.md` for how to
run it headlessly.
