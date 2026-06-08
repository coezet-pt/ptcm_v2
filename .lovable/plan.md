# Two focused turns: (1) Preliminary label, (2) Full extracted.ts regeneration

## Turn 1 — Tag placeholder tabs (tiny)

Add a `preliminary` flag to the 4 derived tabs so users don't mistake them for validated workbook output.

**Edit** `src/components/ChartTabs.tsx`:

- Add `preliminary?: true` to the TABS entries for `seg-sales`, `seg-stock`, `app-sales`, `app-stock`.
- In `TabsTrigger`, when `preliminary`, render the label with a small grey `(preliminary)` suffix in `text-[10px] text-muted-foreground ml-1`.
- Above each preliminary chart, render a single line: *"Preliminary grouping — uses vehicle size / use-case from BUCKETS. Will switch to the workbook's formal 7-segment / 10-application taxonomy after the v3 extraction."* (`text-xs text-muted-foreground mb-2`)

No simulation or aggregation changes.

---

## Turn 2 — Backend extraction (Thread A) + validation

Self-contained, no UI changes. Done as a separate turn after Turn 1 ships.

### Step 1. Write the extractor

`scripts/extract_constants.py` (Python, openpyxl, runs locally in `/tmp`, not shipped to the app). Reads `/mnt/user-uploads/CoEZET_PTCM_v3.xlsx` and emits a fully rewritten `src/lib/constants/extracted.ts`.

**Existing exports — rewritten with v3 numbers**


| Export                                                                            | Source                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POWERTRAINS`                                                                     | unchanged                                                                                                                                                                                                                                                                                                             |
| `VEHICLE_BASE_PRICES_2025`                                                        | `Changing with year` R25–R34 (engine+trans), R36–R45 (e-powertrain), R80–R89 (diesel total) — all 9 sizes                                                                                                                                                                                                             |
| `BUCKETS`                                                                         | `No change with year` R5–R18 — refresh annualKm/workingDays/kmPerDay/ulw/gvw, 6 efficiencies, BET/FCET battery & FC specs, h2 tank, tyre counts, maintenance per km, **plus** new fields: `payloadDiesel`, `payloadBET`, `payloadFCET`, `revisedGVW_BET`, `revisedGVW_FCET`, `engineRunHrs`, `avgSpeed`, `loadingPct` |
| `RESALE_VALUES`                                                                   | `No change with year` resale-value block (3-tier per PT, per bucket profile) — replaces hard-coded `general` / `high_duty` if profile data differs                                                                                                                                                                    |
| `TIV_PROJECTION`                                                                  | `Output Summary` rows 29–59 col "Total Trucks Sale" (2025–2055)                                                                                                                                                                                                                                                       |
| `HISTORICAL_SALES`, `DIESEL_STOCK_END_2024`                                       | `Output Summary` rows 3–28 (1999–2024)                                                                                                                                                                                                                                                                                |
| `EMISSION_FACTORS`                                                                | `Parameters Fixed` (verify against current values; flag any drift)                                                                                                                                                                                                                                                    |
| `START_OF_SUPPLY`, `PTTM_PILOT_SHARE`, `WEIBULL_SHAPE_ALPHA`, `WEIBULL_PEAK_YEAR` | `Segment Wise Split` cols Q–Y                                                                                                                                                                                                                                                                                         |


**New exports**


| Export                   | Source                                        | Shape                                                                                                 |
| ------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `SEGMENTS`               | `Segmentwise Sales` R2–R8                     | `['Rigid 12-19T','Rigid 19-28.5T','Rigid 28.5-40T','Rigid >40T','TT 31-40T','TT 40-46T','TT 46-55T']` |
| `BUCKET_SEGMENT_MAP`     | `Buckets` cross-ref + GVW thresholds          | `Record<BucketId, Segment>`                                                                           |
| `APPLICATIONS`           | `Applicationwise Sales` R2–R13                | 10 application labels                                                                                 |
| `BUCKET_APPLICATION_MAP` | `Buckets` sheet                               | `Record<BucketId, Application>`                                                                       |
| `MAINT_CURVES`           | `Changing with year` R152–R262                | `Record<BucketId, Record<PT, number[31]>>` — per-bucket × PT × year                                   |
| `TOLL_PER_KM`            | `Changing with year` R264–R284                | per-size × {ICE|ZET} × 31 yrs                                                                         |
| `MANPOWER_PER_KM`        | `Changing with year` R286–R306                | per-size × {ICE|ZET} × 31 yrs                                                                         |
| `H2_COST_CHAIN`          | `Changing with year` R7–R14                   | green/grey production cost, blend %, compression — per year                                           |
| `ELECTRICITY_CHAIN`      | `Changing with year` R15–R18                  | DISCOM, demand charges, CAAS, total — per year                                                        |
| `STEADY_STATE_SHARES`    | Estimation 2035 / 2040 / SS2045 / 2050 / 2055 | `Record<TargetYear, Record<BucketId, Record<PT, number>>>` (final adjusted PT share)                  |
| `STEADY_STATE_TIV`       | R2 of each Estimation sheet                   | `Record<TargetYear, number>`                                                                          |
| `S_CURVE_PARAMS`         | `Segment Wise Split` right-hand table         | logistic (BET, H2-ICE, H2-FCET) + bell-curve (CNG, LNG)                                               |


The current `Changing with year` per-year scalar trajectories (diesel price, CNG, LNG, electricity, battery cost, fuel cell, h2 tank, lng tank, adblue) keep their existing `ParameterConfig` shape — only numeric values change.

### Step 2. Swap segment/application taxonomy

After `extracted.ts` is rewritten:

- `src/lib/constants/segments.ts` switches from "vehicle size from BUCKETS" to importing `SEGMENTS`, `BUCKET_SEGMENT_MAP`, `APPLICATIONS`, `BUCKET_APPLICATION_MAP` from `extracted.ts`.
- Updates `SEGMENT_COLORS` keys to the 7 real segments and `APPLICATION_COLORS` keys to the 10 real applications.
- The 4 new chart components don't change — they iterate `SEGMENTS` / `APPLICATIONS` already.
- Remove the `(preliminary)` flag from those tabs.

### Step 3. Validation harness

`scripts/validate_against_xlsx.ts` (dev-only Node script, runnable via `bun scripts/validate_against_xlsx.ts`):

1. Load the BAU preset config (same as the app's default).
2. Run the full simulation pipeline (`buildTimeSeries` → `computeTCO` × 2 → `computeShares` × 2 → `computePTTM` → `computeStockEmissions`).
3. Read `Output Summary` rows 29–59 (2025–2055) from CoEZET v3.
4. Compare year by year, per-PT:
  - Annual sales (units) — Diesel, CNG, LNG, BET, H2-ICE, H2-FCET, Total
  - Cumulative stock (units) — same 6 PTs + Total
  - Total ZET sale + stock
5. Output a markdown comparison table to stdout: `Year | PT | Model | Workbook | Δ% | Pass(≤2 %)?`.
6. Highlight rows with |Δ| > 2 % in red.

**Deliverable to the user before any further work**: paste the validation report. No follow-on changes until it's reviewed.

### Step 4. Multi-target ZET scenario — NOT done in this turn

Plumbing `targetYear` through `ScenarioConfig` and `pttm.ts` happens in a later turn, once validation passes. Reason: changes the simulator output, easier to verify it works against the 2045 baseline first.

### Files

**New (dev-only, gitignored)**

- `scripts/extract_constants.py`
- `scripts/validate_against_xlsx.ts`

**Rewritten**

- `src/lib/constants/extracted.ts`
- `src/lib/constants/segments.ts` (re-export real taxonomy from extracted.ts)

**Edited**

- `src/lib/types.ts` — `Segment` / `Application` types become string-literal unions of the real labels
- `src/lib/constants/colors.ts` — SEGMENT_COLORS / APPLICATION_COLORS keyed by real labels
- `src/components/ChartTabs.tsx` — drop `preliminary` tag

**Not touched**

- `tco.ts`, `choiceModel.ts`, `pttm.ts`, `stockEmissions.ts` (simulation logic stays, only the constants under it change)
- `scenarios.ts` preset configs, Supabase schema
- Any UI component

### Risks & checkpoints

1. **Simulation output will shift** when extracted.ts changes. Expected. The validation report against `Output Summary` is exactly how we confirm the shift matches the workbook.
2. `**Segment Wise Split`  has `#NUM!` cells.** Extractor recomputes S-curve params from the logistic/bell parameter table (cols Q–Y) instead of reading the broken output cells.
3. **Estimation sheets vary in column layout.** Extractor handles each sheet name explicitly, asserts expected column headers, fails loudly on mismatch.
4. **Bucket-to-segment mapping isn't a column in `Buckets**` (sub-agent noted). Extractor will derive it from GVW thresholds (Rigid: 12–19 / 19–28.5 / 28.5–40 / >40 T; TT: 31–40 / 40–46 / 46–55 T) and print the resulting map for you to spot-check before commit.
5. **No backend migration.** All changes are in-app TypeScript constants; Supabase schema is untouched.

&nbsp;

&nbsp;

Approved — ship Turn 1 now, then Turn 2 as its own turn. Three hard gates on Turn 2 before you commit extracted.ts:

**Gate 1:** After deriving BUCKET_SEGMENT_MAP from GVW thresholds, print the full 14-bucket → segment map and STOP. I need to eyeball it before you proceed — some buckets (48T, 55T Tractor) sit on Rigid/TT boundaries and a wrong classification corrupts every segment chart. Don't commit until I confirm.

**Gate 2:** For STEADY_STATE_SHARES, after extracting all 5 Estimation sheets, assert each bucket's 6 powertrain shares sum to 1.0 ±0.5% in every target year (2035/2040/2045/2050/2055). The 2055 sheet has a different layout (A1:T162 vs A1:Z175 for the others) — confirm you're reading the right columns by checking the sums, not just the headers. Print any bucket/year that fails the sum check.

**Gate 3:** The validation harness must compare against the FINAL Output Summary values (post supply-readiness adjustment), matching what PTTM actually outputs. Confirm Output Summary rows 29–59 are the adjusted final sales/stock, not an intermediate calc.

Run the extraction, hit all 3 gates, paste me: (a) the bucket→segment map, (b) any sum-check failures, (c) the BAU validation report. No commit, no taxonomy swap, no removing the preliminary flag until I review all three.