# 7. Known Issues and To-Do

Read the first two sections before you trust a number or start debugging.

## Design decisions that surprise people

Each of these looks like a bug and is not.

### 1. Nothing recalculates until "Apply Changes"

All sidebar edits and all parameter file uploads write to `draftConfig`. The charts read
`config`. If a change seems to do nothing, check whether Apply Changes was clicked. This is
deliberate — see [02](02-architecture.md).

### 2. Total sales are fixed

`TIV_PROJECTION` is a hard-coded table. **No setting changes total sales.** Policy and cost
settings move share between powertrains; they never grow or shrink the market. Users will ask
why a strong incentive does not increase total sales. That is the answer.

### 3. 2055 is 100% ZET because the model says so

`computeShares(..., zetOnly = true)` for 2055 removes Diesel, CNG and LNG from the options and
redistributes across the three ZETs, matching the workbook's `Estimation 100% ZET 2055` sheet.
The model does not *arrive* at 100% ZET — it is *told* to. Reading the 2055 endpoint as a
result rather than an assumption is a misreading.

### 4. "ZET" means two different things

- `stockEmissions.ts`: ZET = **BET + H2-ICE + H2-FCET** (Excel `PTTM` columns C+E+G). This
  drives `zetShare`, `totalZetSales`, the 50%-ZET KPI and the ZET penetration chart.
- `tco.ts` `usesZetToll()`: **BET + H2-ICE + H2-FCET** — who gets the toll waiver.
- `tco.ts` `isZET()`: **BET + H2-FCET only** — who gets the ZET interest rate and loan length.

The toll question is settled: all 14 bucket sheets label the row
`Toll Charges (H2 ICE, BET & FCET)` and point the H2-ICE block at it, so H2-ICE **does** get
the waiver. That is why toll uses its own rule rather than `isZET()`.

The **financing** split is still worth raising with CoEZET, because the workbook contradicts
itself: B1/B3/B4/B5/B13/B14 use the ZET rate for H2-ICE (`C28`/`C27`), while
B2/B6/B7/B8/B9/B10/B11/B12 use the ICE rate (`C26`/`C25`). The code follows the 8-sheet
majority. Both rates are 12% over 7 years at BAU, so this only matters once someone changes
the Funding inputs — at which point the dashboard and the workbook will disagree for H2-ICE.

### 5. Some Excel mistakes are copied on purpose

Two cell-reference errors in the workbook are reproduced deliberately, marked `Excel quirk:`
in `choiceModel.ts`: the B9/B11 LNG-instead-of-diesel 2055 baseline, and the B12 BET/H2-ICE
swap. They look like bugs in review. They are not. Details in [03](03-model-reference.md).

### 6. Editing a growth rate clears pinned years in that band

`clearOverridesInRangeIfCagr` in `ScenarioContext.tsx`. Correct behaviour, surprising the
first time.

### 7. Only one chart tab is rendered at a time

Which is why the PDF report builds its own separate copy of everything (`lib/report.tsx`). If
you add a chart and it does not show up in the PDF, you forgot `ReportDocument.tsx`.

### 8. `src/components/ui/` is generated

shadcn/ui output. Do not hand-edit — wrap it or regenerate it.

### 9. Costs are only calculated for 2045, 2050 and 2055

`runSimulation` calls `computeTCO` for exactly three years — the workbook's
`Estimation SS2045` / `Estimation2050` / `Estimation 100% ZET 2055` anchors, the only ones
`PTTM` reads. (`Estimation2035` and `Estimation2040` exist in the workbook but nothing uses
them.) Everything before 2045 is the curve fitted *backwards* from those anchors.

This causes the second most common "my change did nothing" report, after #1: **a setting that
only applies in earlier years cannot change any output.** It is not a wiring bug — the model
has no path for near-term policy other than `*_inflection_year`. This is why the toll waiver
is entered per decision point (`TOLL_WAIVER_KEYS` = `d4145`/`d4650`/`d5155`) rather than per
5-year block; the earlier bands did nothing and were removed.

The **demand incentives** are the one setting still inert at its defaults, and that matches
Excel — the workbook's own incentive cells stop at 2035 (see [03](03-model-reference.md)). Do
not "fix" it by extending the end years; `src/test/demandIncentive.test.ts` will fail.

`src/test/tollWaiver.test.ts` and `src/test/choiceAdjustment.test.ts` show how to check that a
control is live. Copy that pattern for any new one.

## Where the model differs from the workbook

| Area | Status |
|---|---|
| TCO calculation | **Matches.** B1 2045 agrees with the Excel B-sheet for all six powertrains (Diesel 59.24, CNG 62.58, LNG 61.75, H2-ICE 59.39, BET 45.44, FCET 61.71 ₹/km). Note the B-sheet block order is Diesel, CNG, LNG, **H2-ICE, BET**, H2-FCET — the BET block is the one with the electricity row. Older notes claiming a "BET TCO ~43 vs 49.68" gap were reading the wrong block. |
| Choice model | Matches — the sum, the ×1.5 factor and all five ratio directions were checked. |
| PTTM curves | Matches the `PTTM` sheet structure. |
| Emissions | **About 1.3% off.** The cause is known: the code weights bucket emission rates by 2045 sales share, while Excel uses stock per application × km and fuel economy per application. Not yet fixed. |
| 2026 stock start | `DIESEL_STOCK_END_2025 = 5,315,061` is loaded as **all diesel**, but that figure includes Excel's 11,875 CNG, 368 LNG and 149 BET. So early-year CNG/LNG/BET *stock* is low by exactly that amount. It washes out by about 2045. Sales are unaffected. |
| Share adjustments | **Matches.** Rebuilt from the year inputs (`sim/adjustments.ts`) rather than hardcoded; reproduces the workbook snapshot to nine decimal places across all 14 buckets × 3 anchors. |
| TCO parity years | **Close.** Calculated live (`sim/parity.ts`); 36 of 42 cells match `Buckets` AH3:AJ16 exactly, including all 28 hydrogen cells. The six BET cells that differ are each exactly one year late — a side effect of starting at 2026 instead of the workbook's 2025. |
| Health checks | 12 of 12 passing for BAU as of the last run. |

## Cleanup already done

These were removed on 2026-08-21 because nothing referenced them. Everything is still in
`git log` if it is ever needed again.

| Removed | Why |
|---|---|
| `.lovable/plan.md` | Described a `gompertzShare` version with `literalA/literalB/literalC` and a quadratic correction term. That code no longer existed — `pttm.ts` had been rewritten twice since. (The `lovable-tagger` dev plugin itself was left in place — see below.) |
| `public/placeholder.svg` | Scaffold image, referenced nowhere. |
| `scripts/validate_against_xlsx.ts` | Pointed at `CoEZET_PTCM_v3.xlsx`, which is not the workbook in this repo, and used `import.meta.dir`, which only exists in Bun. It had not run in a long time. |
| `PolicyLevers.tsx`, `RatingMatrix.tsx`, `SegmentBasePricesTable.tsx`, `BucketMaintenanceInput.tsx` | Half-built input widgets, not mounted anywhere and not kept up to date with `PolicyConfig`. |
| `BUCKET_PAYLOADS` (`extracted.ts`) | Replaced by live calculation in `choiceModel.computeBucketPayload`. |
| `SEGMENT_OF_BUCKET` / `APPLICATION_OF_BUCKET` (`segments.ts`) | Unused since the segment and application splits moved to the Excel share tables in `segmentAppShares.ts`. |
| `grey_h2_blend_fraction` (`ParameterKey` + its default and label) | Dead input. The blend comes from `policy.grey_h2_blend_mode` / `_uniform` / `_bands`. `ParameterKey` now has 16 entries, not 17. |

Tests (37), typecheck and build all still pass after these removals. None of them touch
`package.json`, the lockfiles or `vite.config.ts`, so the build and the deployment are
unchanged.

## Left alone on purpose

| Thing | Why |
|---|---|
| `bun.lock`, `bun.lockb` | Redundant next to `package-lock.json`, and they can make Vercel build with Bun instead of npm. Deliberately **not** removed: the deployment works today and switching package manager is not worth the risk. See [05](05-deployment.md). |
| `lovable-tagger` | A dev-only Vite plugin with no effect on the production bundle. Removing it means editing `package.json`, which desyncs the lockfiles — same reasoning as above. |
| `src/components/charts/TCOParityChart.tsx` | Not mounted, but current and correct — it takes `SimulationResult.parityYears`. It only needs adding to `ChartSections.tsx`, and to `ReportDocument.tsx` for the PDF. Worth doing rather than deleting. |
| `scripts/extract_constants.py` | The tool that pulls constants out of the workbook into `extracted.ts`. Needed if the workbook is ever updated. |
| `scripts/gen_2026_base.py` | Generated the 2026 base values. Historical, but it documents how the rebase was done. |
| `scripts/extracted_audit.json` | The structured dump `extract_constants.py` produces. Useful for tracing where a number came from. |
| `CoEZET PTCM v2.xlsx` | The source of truth. Committed deliberately. |


## To-do list, roughly in order

**Before a public launch**

1. Turn off the console output in production. `useSimulation.ts` prints a large diagnostic
   dump on every recalculation and `Index.tsx` logs the whole result — both run in the
   browser with no condition. Wrap them in `if (import.meta.env.DEV)`.
2. Fix `index.html`: real title, remove the TODOs, add a favicon and `og:image`.
3. Settle the licence. `README.md` says MIT; the model and workbook belong to CoEZET.
4. Add an "About / assumptions / version" panel so users know what they are looking at.
5. Pin the Node version ([05](05-deployment.md)).

**Model accuracy**

6. Settle the H2-ICE **financing** question (#4 above) with CoEZET — the workbook contradicts
   itself across bucket sheets. (The toll half is settled: H2-ICE gets the waiver.)
7. Close the ~1.3% emissions gap by switching to stock per application × km and fuel economy.
8. Chase the one-year BET parity offset (6 of 42 cells) — almost certainly the 2026 vs 2025
   start. Low stakes; all the hydrogen cells match.
9. Split the 2026 stock start so early CNG/LNG/BET stock is right.
10. Extend `sanityCheck.ts` to cover emissions and energy, not just shares and sales — those
    are the least protected outputs right now.

**Developer experience**

11. Add tests for `tco.ts` and `choiceModel.ts` against known B-sheet values. The only model
    test today is end-to-end, which catches "the answer moved" but not "which stage moved it".
12. Mount `TCOParityChart` — it works and is not shown anywhere.
13. Split up the 1.37 MB main bundle. SheetJS (`xlsx`) and Recharts are the big parts; `xlsx`
    is only needed for exports and could be imported on demand the way `jspdf` already is.

**Product**

14. Decide whether BWS-1 / BWS-2 / BEST go back into the scenario picker.
15. Decide whether the settings with no on-screen control ([04](04-parameters-and-ui.md))
    should get one, given they are already reachable through the parameter file.
16. Mobile layout: it stacks, but the dashboard is desktop-first by design.

## How to change the model safely

1. Find the constant or formula in the workbook first. Note the sheet and cell.
2. Change the code, and put the sheet and cell in a comment.
3. `npm test` — all 37 tests, including the 12 health checks, must still pass. If a check
   moves, understand exactly why before accepting it.
4. `npm run dev`, open the console, check the stage 1–4 dump for the part you touched.
5. Compare a CSV export of the affected chart against the matching workbook sheet.
6. If the change affects the parameter file, extend `src/test/paramFile.test.ts`.
7. Update [03-model-reference.md](03-model-reference.md) if you changed a formula, and the
   table above if you changed a known gap.
