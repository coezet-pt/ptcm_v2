
# Turn 7 — Switch Gompertz to v3 literal a/b/c + dump stale sanity thresholds

Two scoped changes; one validation run. Banners stay on.

## Confirmed: v3 Gompertz params are GLOBAL, not per-bucket

PTTM sheet has exactly 3 parameter rows (rows 2–4 of cols S–AB) for BET, H2-ICE, H2-FCET. No per-bucket variant. Per-bucket `PTTM 2045 SS (2)` is downstream targets, not parameters. So one literal set per powertrain is correct.

## Part 1 — Use literal a/b/c in `gompertzShare`

### New constant in `src/lib/constants/extracted.ts`

```ts
// v3 PTTM rows 2-4, cols T (a), V (W), W (b), X (c). Global, not per-bucket.
export const GOMPERTZ_PARAMS_BY_PT = {
  BET:       { a: 1.1089, b: 7.1107, c: 0.11299, W: 0.0009052, startYear: 2025 },
  'H2-ICE':  { a: 0.0659, b: 6.4914, c: 0.09171, W: 0.0001,    startYear: 2028 },
  'H2-FCET': { a: 0.0616, b: 6.4228, c: 0.10427, W: 0.0001,    startYear: 2030 },
} as const;
```

This supersedes the separate `PTTM_PILOT_SHARE` and `PTTM_PILOT_START_YEAR` consumers in `pttm.ts` (those exports stay for backwards-reference but the Gompertz loop reads from `GOMPERTZ_PARAMS_BY_PT`).

### `src/lib/sim/gompertzShare` change

Currently `gompertzShare` derives `a`, `b`, `c` from `share2055`, `share2045`, `pilotShare`, `startYear`, `inflectionYear`, then applies a quadratic correction to force the curve through `share2045`.

New behavior:

1. If literal params exist for the powertrain, use **literal `b` and `c` directly** for the curve shape. Then recompute `a` as the per-bucket normalization so the un-corrected curve hits `share2055` at 2055:

    ```
    normDenom = exp(-b * exp(-c * (2055 - startYear)))
    a = share2055 / normDenom
    gompertzMain(y) = a * exp(-b * exp(-c * (y - startYear)))
    ```

    This preserves v3's shape (which is what was wrong — derived `c` was 4× too steep for H2-ICE/H2-FCET) while still landing on the bucket-specific 2055 target.

2. Keep the existing quadratic correction term so the final curve passes exactly through `share2045` at 2045 (unchanged math, but now applied on top of the literal-shaped main curve).

3. Fallback path: if a powertrain has no entry in `GOMPERTZ_PARAMS_BY_PT`, derive as today.

### `computePTTM` call site

Change is local to the Gompertz loop in `src/lib/sim/pttm.ts`:

- Resolve `{startYear, W}` from `GOMPERTZ_PARAMS_BY_PT[pt]` instead of `PTTM_PILOT_START_YEAR` + `PTTM_PILOT_SHARE`. `inflectionYear` still comes from policy (used only by the quadratic-correction branch; literal params don't need it for the main curve, but the correction term keeps using it as the pivot point — keep as-is).
- Pass the literal `{a, b, c}` into `gompertzShare`.

No edits to `tco.ts`, `choiceModel.ts`, `stockEmissions.ts`, scenarios, or UI.

## Part 2 — Sanity-threshold-vs-v3 dump in harness (READ-ONLY)

Do NOT change any threshold in `src/lib/sim/sanityCheck.ts` or `BAU_BASELINE_CHECKS` in `extracted.ts`.

Add a new block at the end of `scripts/validate_against_xlsx.ts` that emits a static table:

```
=== (9) SANITY THRESHOLDS vs v3 ACTUALS (no changes made) ===
check                  threshold              v3 actual          stale?
total_sales_2025       262,023–272,717        267,370            OK
total_sales_2045       693,105–721,395        707,250            OK
total_sales_2055       1,009,233–1,050,427    1,029,830          OK
zet_share_2045         10%–45%                ~84.0% (BET+H2 of total) STALE
zet_share_2055         30%–70%                ~100% (diesel→0)         STALE
diesel_2025_units      240,000–270,000        251,629            OK
cng_share_2030         1%–15%                 6.03% (19,471/322,721)   OK
cng_share_2045         ≥2%                    4.91%                    OK
cng_share_2055         ≤0.5%                  0% (full phase-out)      OK
lng_share_2030         ≥0.5%                  0.25% (802/322,721)      STALE
lng_share_2045         ≥1.5%                  0.48%                    STALE
lng_share_2055         ≤0.5%                  0%                       OK
```

v3 actuals are computed from `audit.bau_reference` rows for 2025/2030/2045/2055 (totals = sum of Diesel+CNG+LNG+BET+H2-ICE+H2-FCET; ZET = (BET+H2-ICE+H2-FCET)/total). Compute these in the harness, do not hardcode.

`stale?` flag: print `STALE` when v3 actual falls outside the current threshold band; `OK` otherwise. Pure observational output.

## Files touched

- `src/lib/constants/extracted.ts` — add `GOMPERTZ_PARAMS_BY_PT`.
- `src/lib/sim/pttm.ts` — `gompertzShare` body + Gompertz loop in `computePTTM`.
- `scripts/validate_against_xlsx.ts` — append section (9).

Not touched: `sanityCheck.ts`, `BAU_BASELINE_CHECKS`, `tco.ts`, `choiceModel.ts`, scenarios, UI.

## Validation

Single run of `bun run scripts/validate_against_xlsx.ts`. Paste back:

1. Full BAU sales diff (years 2025–2055, all 6 PTs) — section (3).
2. BET / H2-ICE / H2-FCET 2045 shares (targets: BET ~76%, H2-ICE ~1.7%, H2-FCET ~1.6% per v3 row 23/AB).
3. The (9) threshold-vs-v3 table.
4. Numeric verdict line: `Sanity X/12 passed. Diff cells over 2%: N/372.`

No further code changes regardless of residual.
