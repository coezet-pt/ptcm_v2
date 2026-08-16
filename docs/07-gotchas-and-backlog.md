# 7. Gotchas, Known Issues and Backlog

Read the first two sections before you trust a number or debug a "bug".

## Traps that will cost you an afternoon

### 1. Nothing recomputes until "Apply Changes"

All sidebar edits, and all parameter-file imports, write to `draftConfig`. The charts read
`config`. If a change "does nothing", check whether Apply Changes was clicked. This is
deliberate — see [02](02-architecture.md).

### 2. Total sales are a fixed projection

`TIV_PROJECTION` is a hard-coded table. **No lever changes total industry volume.** Policy
and cost levers redistribute share between powertrains; they never grow or shrink the market.
Users will ask why an aggressive incentive does not increase total sales. That is the answer.

### 3. 2055 is 100 % ZET by construction

`computeShares(..., zetOnly = true)` for 2055 excludes Diesel/CNG/LNG from the choice set and
renormalises among the three ZETs, reproducing the workbook's `Estimation 100% ZET 2055`
sheet. The model does not *converge* to 100 % ZET — it is *told* to. Anyone reading the
2055 endpoint as a result rather than an assumption is misreading the model.

### 4. Two different meanings of "ZET"

- `stockEmissions.ts`: ZET = **BET + H2-ICE + H2-FCET** (Excel `PTTM` cols C+E+G). This
  drives `zetShare`, `totalZetSales`, the 50 %-ZET KPI and the ZET penetration chart.
- `tco.ts` `isZET()`: **BET + H2-FCET only**. This drives the ZET interest rate, the ZET loan
  tenure and the toll waiver — H2-ICE is financed and tolled as an ICE.

Both are intentional as written, but the second one deserves a check against the workbook:
the `Changing with year` ZET toll rows (275–284) appear to cover H2-ICE as well. If it turns
out H2-ICE should get the waiver, that is a one-line change with real effects on the H2-ICE
share. **Verify with CoEZET before changing it.**

### 5. Deliberately reproduced Excel bugs

Two cell-reference errors in the workbook are replicated on purpose, labelled `Excel quirk:`
in `choiceModel.ts`: the B9/B11 LNG-vs-diesel 2055 baseline, and the B12 BET↔H2-ICE TCO
factor cross-wiring. They look like bugs in code review. They are not. Details in
[03](03-model-reference.md).

### 6. Editing a CAGR silently clears per-year pins in that band

`clearOverridesInRangeIfCagr` in `ScenarioContext.tsx`. Correct behaviour, surprising the
first time you see it.

### 7. Only one chart tab is mounted at a time

Which is why the PDF report renders its own detached copy of everything
(`lib/report.tsx`). If you add a chart and it does not appear in the PDF, you forgot
`ReportDocument.tsx`.

### 8. `src/components/ui/` is generated

shadcn/ui output. Do not hand-edit — wrap or regenerate.

## Known model discrepancies vs the workbook

| Area | Status |
|---|---|
| TCO engine | **Verified.** B1 2045 matches the Excel B-sheet for all six powertrains (Diesel 59.24, CNG 62.58, LNG 61.75, H2-ICE 59.39, BET 45.44, FCET 61.71 ₹/km). Note the B-sheet block order is Diesel, CNG, LNG, **H2-ICE, BET**, H2-FCET — the BET block is the one with the electricity OPEX row. Earlier notes claiming a "BET TCO ~43 vs 49.68" gap were a block-mislabelling, not a defect. |
| Choice model | Verified — SUM aggregation, ×1.5 lambda, per-factor ratio directions all checked. |
| PTTM curves | Verified against the `PTTM` sheet piecewise structure. |
| Emissions | ~**1.3 % gap** remains vs Excel. Cause is known: the code weights bucket emission rates by `tivShare2045`, while Excel uses application-wise stock × application km/kmpl. Not yet addressed. |
| 2025/2026 stock seed | `DIESEL_STOCK_END_2025 = 5,315,061` is seeded **all diesel**, but that figure includes Excel's 11,875 CNG, 368 LNG and 149 BET. Early-year CNG/LNG/BET *stock* therefore runs low by exactly that seed. It washes out by ~2045. Sales are unaffected. |
| Sanity suite | 12/12 passing for BAU as of the last run. |

## Stale artefacts in the repo

| File | Problem |
|---|---|
| `.lovable/plan.md` | Describes a `gompertzShare` implementation with `literalA/literalB/literalC` and a quadratic correction term. **That code no longer exists** — `pttm.ts` was rewritten to the piecewise Gompertz/cosine/linear form with iterative `a` normalisation. The file is a historical record of a fix, not a description of current behaviour. Safe to delete. |
| `verify_pttm.mjs` (was at repo root) | A standalone script replicating the same obsolete `pttm.ts`. Moved to `dump/verify_pttm.mjs.obsolete` (gitignored) during this handover rather than committed, because committing it would document a version of the model that is two rewrites out of date. |
| `scripts/validate_against_xlsx.ts` | References `CoEZET_PTCM_v3.xlsx`; the repo now ships `CoEZET PTCM v2.xlsx`. Also uses `import.meta.dir`, which is Bun-only — it will not run under plain Node. |
| `scripts/*.py` | One-off extraction scripts. Not part of any pipeline. |
| `BUCKET_PAYLOADS` in `extracted.ts` | Superseded by live derivation in `choiceModel.computeBucketPayload`. Kept as a reference constant only. |
| `SEGMENT_OF_BUCKET` / `APPLICATION_OF_BUCKET` in `segments.ts` | Unused since segment/application splits moved to the Excel share tables in `segmentAppShares.ts`. |
| `grey_h2_blend_fraction` (`ParameterKey`) | Dead. The blend is driven by `policy.grey_h2_blend_mode` / `_uniform` / `_bands`. |
| Orphaned components | `PolicyLevers.tsx`, `RatingMatrix.tsx`, `SegmentBasePricesTable.tsx`, `BucketMaintenanceInput.tsx` are not mounted anywhere. Useful as starting points if a lever needs to come back — verify they still typecheck against the current `PolicyConfig` first. |

## Backlog / cleanup, roughly in priority order

**Before an institutional launch**

1. Gate the production console output. `useSimulation.ts` prints a four-layer diagnostic
   dump on every recompute and `Index.tsx` logs the full `SimulationResult` — both run
   unconditionally in the browser. Wrap in `if (import.meta.env.DEV)`.
2. Fix `index.html`: real title, remove scaffold TODOs, add favicon and `og:image`.
3. Settle the licence question. `README.md` says MIT; the model and workbook are CoEZET's.
4. Add an "About / assumptions / version" surface so users know what they are looking at.
5. Consolidate to one lockfile and pin the Node version ([05](05-deployment.md)).

**Model correctness**

6. Resolve the H2-ICE toll-waiver / ZET-financing question (trap #4 above) with CoEZET.
7. Close the ~1.3 % emissions gap by switching to application-wise stock × km/kmpl.
8. Split the 2026 stock seed so CNG/LNG/BET early-year stock is right.
9. Extend `sanityCheck.ts` to cover emissions and energy, not just shares and sales — those
   are currently the least-guarded outputs.

**Developer experience**

10. Add tests for `tco.ts` and `choiceModel.ts` against known B-sheet values. Currently the
    only model test is the end-to-end sanity suite, which catches "the answer moved" but not
    "which stage moved it".
11. Repair or delete `scripts/validate_against_xlsx.ts` (Bun-only, wrong workbook name).
12. Delete `.lovable/`, `lovable-tagger`, and the orphaned components.
13. Code-split the 1.37 MB main chunk. SheetJS (`xlsx`) and Recharts are the big items;
    `xlsx` is only needed on export and could be dynamically imported the way `jspdf`
    already is.

**Product**

14. Decide whether BWS-1 / BWS-2 / BEST go back into the scenario picker.
15. Decide whether the policy levers with no UI ([04](04-parameters-and-ui.md)) should be
    exposed, given they are already reachable through the parameter file.
16. Mobile layout: it stacks, but the dashboard is desktop-first by design.

## How to make a model change safely

1. Find the constant or formula in the workbook first. Note the sheet and cell.
2. Change the code, and put the sheet/cell reference in a comment.
3. `npm test` — all 17 tests, including the 12 sanity checks, must still pass. If a check
   moves, understand exactly why before accepting it.
4. `npm run dev`, open the console, check the Layer 1–4 diagnostic dump for the stage you
   touched.
5. Compare a CSV export of the affected chart against the corresponding workbook sheet.
6. If the change affects the parameter file, extend `src/test/paramFile.test.ts`.
7. Update [03-model-reference.md](03-model-reference.md) if you changed a formula, and the
   discrepancy table above if you changed a known gap.
