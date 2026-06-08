## Turn 2 — Re-extract `extracted.ts` from CoEZET_PTCM_v3.xlsx + validation

### Goal

Replace all global constants from the v3 workbook and prove the simulation matches `Output Summary` (BAU, rows 29–59, 2025–2055) before any further feature work.

### Workflow

1. **Extraction script** — `scripts/extract_constants.py`
  - Reads `CoEZET_PTCM_v3.xlsx` (already in repo / uploads).
  - Pulls every sheet needed for the constants below into typed Python dicts.
  - Writes a fresh `src/lib/constants/extracted.ts` with a header comment listing source sheet+cell ranges for every export.
  - Idempotent: re-running with the same workbook yields byte-identical output.
2. **Rewrite `src/lib/constants/extracted.ts**` — keep names stable so no downstream import breaks:
  - Unchanged signatures: `POWERTRAINS`, `VEHICLE_BASE_PRICES_2025`, `BUCKETS`, `RESALE_VALUES`, `TIV_PROJECTION`, `HISTORICAL_SALES`, `DIESEL_STOCK_END_2024`, `EMISSION_FACTORS`, `START_OF_SUPPLY`, `PTTM_PILOT_SHARE`, `WEIBULL_SHAPE_ALPHA`, `WEIBULL_PEAK_YEAR`.
  - **New exports**: `SEGMENTS` (7), `BUCKET_SEGMENT_MAP`, `APPLICATIONS` (10), `BUCKET_APPLICATION_MAP`, `MAINT_CURVES`, `TOLL_PER_KM`, `MANPOWER_PER_KM`, `H2_COST_CHAIN`, `ELECTRICITY_CHAIN`, `STEADY_STATE_SHARES` (2035/2040/2045/2050/2055), `STEADY_STATE_TIV`, `S_CURVE_PARAMS`.
3. **Wire formal taxonomy into segment/application charts**
  - `src/lib/constants/segments.ts` becomes a thin re-export of `SEGMENTS` / `APPLICATIONS` / maps from `extracted.ts`.
  - Remove the `(preliminary)` banners from the 4 derived tabs in `ChartTabs.tsx`.
4. **Validation harness** — `scripts/validate_against_xlsx.ts`
  - Runs the existing BAU scenario through `pttm.ts` → `stockEmissions.ts`.
  - Reads `Output Summary` rows 29–59 from the workbook (sales by PT per year, 2025–2055).
  - Prints a per-year, per-PT diff table with absolute and % error; flags any cell with |Δ%| > 1%.
  - Exit non-zero if any flag.
5. **Deliverable to user (this turn)**
  - The diff table pasted into chat.
  - No further features built until you approve the numbers.

### Not touched this turn

- `tco.ts`, `choiceModel.ts`, `pttm.ts`, `stockEmissions.ts`, `scenarios.ts`
- Supabase schema / scenarios table
- Multi-target ZET scenarios (2035/2040/2050/2055) — next turn after validation passes
- UI components other than removing the 4 preliminary banners

### Files

- **new**: `scripts/extract_constants.py`, `scripts/validate_against_xlsx.ts`
- **rewritten**: `src/lib/constants/extracted.ts`
- **edited**: `src/lib/constants/segments.ts`, `src/components/ChartTabs.tsx`

&nbsp;

Run the full extraction in one turn — no stop-and-wait gates. But the extraction must self-report these three things in its console output so I can validate after, not assume:

1. **Print the full 14-bucket → segment map** as a table in the output. Don't pause for approval — just write it to extracted.ts AND echo it to console so I can eyeball it after.
2. **Run the steady-state sum check inline** and print any bucket/year where the 6 PT shares don't sum to 1.0 ±0.5% (across all 5 Estimation sheets). If everything sums clean, print "✅ all steady-state shares sum to 1.0". Don't halt — just report.
3. **Run the validation harness** against Output Summary rows 29–59 (BAU) at the end and print the full per-year, per-PT diff table with %error. Flag |Δ|>2% but don't exit non-zero — just show me.

Then in one paste, give me: (a) the bucket→segment map, (b) the sum-check result, (c) the BAU diff table.

One safety rule that's NOT optional: keep the `(preliminary)` banners on the 4 segment/application tabs until I review the diff table. Removing them is the only thing that would mislead someone before validation — everything else is just internal data that nobody sees until I check it. So: do the full extraction, swap the taxonomy, but leave the banners on. I'll tell you to remove them once the numbers check out.