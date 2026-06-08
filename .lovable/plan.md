# PTCM v3 — Backend Re-Extraction + Tabbed Chart Selector

Two threads: **(A)** rewrite the data layer from the new workbook, **(B)** swap the 5-chart grid for a tab-bar selector showing one chart at a time. UI polish stays for later.

---

## A. Backend / Data Layer

### A1. Re-extract `src/lib/constants/extracted.ts` from CoEZET_PTCM_v3.xlsx

Run a one-shot Python extractor (`scripts/extract_constants.py`, not shipped) that reads the workbook and rewrites `extracted.ts` end-to-end. The current file's shape (POWERTRAINS, VEHICLE_BASE_PRICES_2025, BUCKETS) stays — but values and several new tables are added.

**Rewritten existing exports**

- `POWERTRAINS` — unchanged (6).
- `VEHICLE_BASE_PRICES_2025` — re-read from `Changing with year` R80–R89 (Diesel) plus R36–R45 (E-Powertrain) and R25–R34 (Engine & Transmission). Refresh all 9 vehicle sizes.
- `BUCKETS` — re-read from `No change with year` (R5–R18). Pull annualKm, workingDays, kmPerDay, ulw, gvw, the 6 efficiencies, battery/tank/FC specs, tyre counts, maintenance per km. Also add the new fields below.

**New exports**

| Name | Source sheet | Shape |
|---|---|---|
| `SEGMENTS` | `Segmentwise Sales ` R2–R8 | 7 segment labels (Rigid 12-19T … TT 46-55T) |
| `BUCKET_SEGMENT_MAP` | `No change with year` cross-ref | `Record<BucketId, Segment>` |
| `BUCKET_APPLICATION_MAP` | `Buckets` / `Applicationwise Sales` | `Record<BucketId, Application>` (10 application groups) |
| `APPLICATIONS` | `Applicationwise Sales` R2–R13 | 10 labels |
| `RESALE_VALUES` | `No change with year` resale block | `Record<PT, { till2035; y2036_45; after2045 }>` |
| `MAINT_CURVES` | `Changing with year` R152–R262 | per-bucket × PT maintenance ₹/km, 2025–2055 |
| `TOLL_PER_KM` / `MANPOWER_PER_KM` | `Changing with year` R264–R306 | per-size × {ICE, ZET}, 2025–2055 |
| `H2_COST_CHAIN` | `Changing with year` R7–R14 | green/grey production, blend %, compression |
| `ELECTRICITY_CHAIN` | `Changing with year` R15–R18 | DISCOM, demand charges, CAAS, total |
| `STEADY_STATE_SHARES` | Estimation 2035 / 2040 / SS2045 / 2050 / 2055 | `Record<TargetYear, Record<BucketId, Record<PT, number>>>` (final PT share after supply-readiness adjustment) |
| `STEADY_STATE_TIV` | R2 of each Estimation sheet | `Record<TargetYear, number>` |
| `S_CURVE_PARAMS` | `Segment Wise Split ` cols Q–Y | logistic params for BET/H2-ICE/H2-FCET, bell-curve for CNG/LNG |

The current `Changing with year` per-year trajectories (diesel price, CNG, LNG, electricity, battery cost, etc.) keep the existing `ParameterConfig` shape — only the numeric values change.

### A2. Multiple ZET-target scenarios

Currently a single steady-state assumption is hard-coded inside `pttm.ts`. New `targetYear` field on `ScenarioConfig`:

```ts
targetYear: 2035 | 2040 | 2045 | 2050 | 2055   // default 2045
```

`pttm.ts` picks the matching `STEADY_STATE_SHARES[targetYear]` block and the matching supply-readiness multipliers. Add a small Target-Year dropdown inside Advanced Settings → Policy Levers (so it's discoverable but not noisy).

The 4 preset scenarios (BAU / BWS-1 / BWS-2 / BEST) stay mapped to 2045 by default; user can override.

### A3. Segment & Application breakdowns in simulation output

Extend `AnnualResult` in `src/lib/types.ts`:

```ts
salesBySegment:        Record<Segment, number>
salesByApplication:    Record<Application, number>
stockBySegment:        Record<Segment, number>
stockByApplication:    Record<Application, number>
salesBySegmentByPT:    Record<Segment, Record<PT, number>>
stockBySegmentByPT:    Record<Segment, Record<PT, number>>
```

Computed inside `stockEmissions.ts` (already iterates buckets) by grouping bucket-level results via `BUCKET_SEGMENT_MAP` / `BUCKET_APPLICATION_MAP`. No new simulation logic — pure aggregation.

### A4. Diesel-only counterfactual emissions

Already partially present (`dieselCounterfactualEmissions`). Verify it matches the `Diesel Only Emissions` sheet (total stock × diesel emissions factor). If not, fix the aggregation only — formula stays.

### A5. Validation

Add a `scripts/validate_against_xlsx.ts` smoke check (dev-only, run manually) that compares simulator output for the BAU preset to `Output Summary` rows 29–59 (2025–2055). Log mismatches > 2 %. Not wired into the UI.

---

## B. Frontend — Tabbed Chart Selector

### B1. New `<ChartTabs />` component

Replaces the 5-chart grid in `src/pages/Index.tsx`. Uses shadcn `Tabs` (horizontal scroll on mobile). Tabs:

1. **Annual Sales by Powertrain** *(default)*
2. **Market Share**
3. **Fleet Stock**
4. **Emissions** *(includes diesel counterfactual line)*
5. **ZET Penetration**
6. **Sales by Segment** *(new — stacked area, 7 segments)*
7. **Stock by Segment** *(new)*
8. **Sales by Application** *(new — stacked area, 10 applications)*
9. **Stock by Application** *(new)*

Only the active tab renders; the chart fills the available width (taller, single-column).

### B2. New chart components

- `src/components/charts/SegmentSalesChart.tsx`
- `src/components/charts/SegmentStockChart.tsx`
- `src/components/charts/ApplicationSalesChart.tsx`
- `src/components/charts/ApplicationStockChart.tsx`

Reuse the existing `ChartCard` shell; CSV/PNG export already works. New `SEGMENT_COLORS` / `APPLICATION_COLORS` palettes added to `src/lib/constants/colors.ts`.

### B3. URL/state persistence

Active tab stored in `useState` (no router change). The 5 KPI cards above stay as-is.

### B4. Untouched

- KPI row, ScenarioPicker, InputPanel, ModelHealthBadge
- Existing chart files keep their props (just imported by ChartTabs)
- No restyle / visual redesign in this pass

---

## File Touch List

**New**
- `src/components/ChartTabs.tsx`
- `src/components/charts/SegmentSalesChart.tsx`
- `src/components/charts/SegmentStockChart.tsx`
- `src/components/charts/ApplicationSalesChart.tsx`
- `src/components/charts/ApplicationStockChart.tsx`
- `scripts/extract_constants.py` *(dev tool)*
- `scripts/validate_against_xlsx.ts` *(dev tool)*

**Rewritten**
- `src/lib/constants/extracted.ts` *(full regeneration from v3)*

**Edited**
- `src/lib/types.ts` — extend `AnnualResult`, add `targetYear` on `ScenarioConfig`, `Segment` / `Application` types
- `src/lib/sim/stockEmissions.ts` — segment/application aggregation
- `src/lib/sim/pttm.ts` — read `STEADY_STATE_SHARES[targetYear]`
- `src/lib/constants/colors.ts` — segment & application palettes
- `src/components/PolicyLevers.tsx` — target-year dropdown
- `src/pages/Index.tsx` — replace chart grid with `<ChartTabs />`

**Not touched**
- `tco.ts`, `choiceModel.ts`, `sanityCheck.ts`, `scenarios.ts` (preset configs), Supabase schema, KPI row, ScenarioPicker, ModelHealthBadge.

---

## Open Items Worth Flagging

1. The new `extracted.ts` will change simulation outputs vs. the current preview — KPI numbers and chart shapes will shift. Expected, but please review the BAU result before approving the BWS-1/BWS-2/BEST SQL inserts later.
2. `Segment Wise Split ` has `#NUM!` errors in the source sheet. Extractor will fall back to recomputing from S-curve params rather than reading the broken cells.
3. UI visual redesign (your "Claude-designed UI") deferred to a follow-up plan as you requested.
