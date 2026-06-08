# Turn 6 — Refresh Gompertz/Weibull parameter constants from v3 PTTM

One change, parameter constants only. No edits to `tco.ts`, `choiceModel.ts`, or the Gompertz/Weibull math in `pttm.ts`. Banners stay on.

## Source (v3 PTTM cols S–AB, rows 2–4)


| Param                  | BET       | H2-ICE | H2-FCET |
| ---------------------- | --------- | ------ | ------- |
| Pilot year (col S)     | 2025      | 2028   | 2030    |
| Saturation a (col T)   | 1.109     | 0.0659 | 0.0616  |
| Pilot share W (col V)  | 0.0009052 | 0.0001 | 0.0001  |
| Displacement b (col W) | 7.111     | 6.491  | 6.423   |
| Growth rate c (col X)  | 0.1130    | 0.0917 | 0.1043  |
| Inflection (col U)     | 2031      | 2051   | 2051    |


Weibull (CNG/LNG, cols S6–AB8): alpha=5, peak=2045, phase-out linear to 0 by 2055.

## Fix A — Inflection years (the big one)

`src/lib/constants/extracted.ts`:

- `SCENARIO_INFLECTION_YEARS.BAU`: BET `2038→2031`, H2-ICE `2050→2051`, H2-FCET `2050→2051`.
- `BAU_POLICY` (lines 380–382): same three values.
- Leave BWS-1/BWS-2/BEST overrides as-is (they're policy-driven shifts, not v3 BAU calibration). BEST already at 2032 for BET.

## Fix B — Pilot start year for Gompertz path

Currently `startYear = START_OF_SUPPLY[size][pt]` (varies 2027–2028 for BET, 2036 for H2-ICE, 2040 for H2-FCET). v3 uses fixed pilot years 2025 / 2028 / 2030. The mismatch on H2-ICE (2036 vs 2028) and H2-FCET (2040 vs 2030) is significant.

Add to `extracted.ts`:

```ts
export const PTTM_PILOT_START_YEAR = {
  BET: 2025, 'H2-ICE': 2028, 'H2-FCET': 2030,
} as const;
```

In `src/lib/sim/pttm.ts` Gompertz loop only, replace
`const startYear = START_OF_SUPPLY[size]?.[pt] ?? 2025;`
with
`const startYear = PTTM_PILOT_START_YEAR[pt as keyof typeof PTTM_PILOT_START_YEAR];`

`START_OF_SUPPLY` stays unchanged and is still used by the Weibull path and elsewhere. This is a constants/wiring change, not a formula change.

## Fix C — Confirm Weibull + pilot share

Already match v3, no edits:

- `WEIBULL_SHAPE_ALPHA = 5` ✓
- `WEIBULL_PEAK_YEAR = 2045` ✓
- Phase-out to 0 by 2055 — `phaseOut = (2055 - year) / 10` in `weibullShare` ✓
- `PTTM_PILOT_SHARE` = {0.0009052, 0.0001, 0.0001} ✓

## Open item flagged, not fixed this turn

v3 hard-codes saturation a, displacement b, and growth rate c. The current `gompertzShare` derives all three from `share2045`, `share2055`, `pilotShare`, `startYear`, `inflectionYear`. Per your instruction "don't touch the Gompertz formula," I'm leaving derivation in place — the inflection-year shift drives most of the residual. Will compare sim-derived a/b/c against v3's literals in the harness output so we can decide next turn whether to switch to literal params.

## Validation

Re-run `bun run scripts/validate_against_xlsx.ts`. Paste:

1. Full BAU sales diff table (2025–2055, all 6 PTs).
2. Sim-derived vs v3-literal a/b/c for BET/H2-ICE/H2-FCET (new debug print in harness, ~10 lines).
3. BET 2045 share (target ~76%).

No further code changes regardless of residual. Decide Turn 7 from evidence.

## Files touched

- `src/lib/constants/extracted.ts` — inflection-year values + new `PTTM_PILOT_START_YEAR` export.
- `src/lib/sim/pttm.ts` — single line in Gompertz loop swapping `START_OF_SUPPLY` for `PTTM_PILOT_START_YEAR`.
- `scripts/validate_against_xlsx.ts` — add a/b/c derived-vs-v3 print block.

Not touched: `tco.ts`, `choiceModel.ts`, Gompertz/Weibull math, scenario presets BWS-1/BWS-2/BEST, START_OF_SUPPLY.  
  
Approved. One addition to the validation output: also print (a) which sanity checks pass/fail with the count, and (b) the total number of diff cells exceeding 2%. I want the numeric verdict, not an assessment.  
