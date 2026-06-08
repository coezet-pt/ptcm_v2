# Turn 5 — Three TCO stale-constant fixes + revalidate

Independent, additive, low-risk. One validation at the end. Banners stay on. `choiceModel.ts` untouched.

## Fix 1 — Maintenance escalation (`src/lib/sim/tco.ts`)

`getMaintenancePerKm(pt, bucket)` currently returns flat per-km values from `bucket.maintDieselPerKm` (Diesel), `bucket.maintCngLngH2icePerKm` (CNG/LNG/H2-ICE), and `bucket.maintDieselPerKm * 0.6` (BET and FCET — the BET=1.68 vs v3=6.64 bug).

Change to year-escalating, with **dedicated** BET and FCET tracks:


| Powertrain         | Base 2025 (₹/km)                         | CAGR  |
| ------------------ | ---------------------------------------- | ----- |
| Diesel             | `bucket.maintDieselPerKm` (B1=2.80)      | 4.00% |
| CNG / LNG / H2-ICE | `bucket.maintCngLngH2icePerKm` (B1=3.30) | 4.00% |
| BET                | 5.12 (incl. battery replacement)         | 1.31% |
| H2-FCET            | 5.76                                     | 1.03% |


Constants `MAINT_BET_BASE_2025 = 5.12`, `MAINT_BET_CAGR = 0.0131`, `MAINT_FCET_BASE_2025 = 5.76`, `MAINT_FCET_CAGR = 0.0103`, `MAINT_DIESEL_CAGR = 0.04`, `MAINT_OTHER_ICE_CAGR = 0.04` at the top of `tco.ts` next to the existing manpower/toll constants. Signature becomes `getMaintenancePerKm(pt, bucket, year)`, returning `base * (1 + cagr)^(year-2025)`.

Note in a code comment that these are calibrated from B1 (Rigid 12-19T) and per-bucket values may differ; revisit once we have other-bucket TCO sheets parsed.

## Fix 2 — Toll as ₹/year per bucket (`src/lib/sim/tco.ts`)

Replace `TOLL_BASE_PER_KM = 2.5`, `TOLL_GROWTH = 0.025` with `TOLL_BASE_PER_YEAR_2025 = 572_400` and `TOLL_CAGR = 0.01`.

In `computeTCO` per-bucket loop:

```ts
const tollPerYear = TOLL_BASE_PER_YEAR_2025 * Math.pow(1 + TOLL_CAGR, dy);
const tollPerKm = tollPerYear / bucket.annualKm; // per-bucket, not 108k
```

`effectiveToll` ZET-waiver math stays as-is (multiplies the per-km figure). All powertrains use the same per-year base (v3 rows 59 & 60 are identical).

## Fix 3 — Diesel vehicle price CAGR 3.0 → 3.61% (`src/lib/sim/tco.ts`)

`computeVehiclePrice` uses `Math.pow(1.03, dy)` in five places (Diesel, CNG, LNG, BET diesel-base portion, H2-ICE, H2-FCET diesel-base portion). Replace the literal `1.03` with `DIESEL_PRICE_CAGR_MULT = 1 + 0.0361` (single constant at the top). Verify: 2,750,000 × 1.0361^20 ≈ 5,590,300 ✓.

`BS_VII_PRICE_BUMP_2030` add-on stays unchanged. The constant fix flows automatically into BET/FCET because they reuse `dieselBase`.

## Files touched

- `src/lib/sim/tco.ts` — only. Constants block + `getMaintenancePerKm` signature + `computeVehiclePrice` literal swap + `computeTCO` toll lines.

Not touched: `extracted.ts`, `choiceModel.ts`, `pttm.ts`, `useSimulation.ts`, `segments.ts`, UI, scripts (harness already prints what we need).

## Validation

Single run of `bun run scripts/validate_against_xlsx.ts`. Paste back:

1. B1 2045 TCO trace — both component tables (Diesel target ≈59.24, BET target ≈45.44, ratio target ≈1.30).
2. Full BAU sales diff table (years 2025-2055, all 6 PTs).
3. Resulting BET TCO factor reported in the runtime check (expected to drop from 107 toward ~7).

No further code changes this turn regardless of residual diff — collect evidence, then decide Turn 6.

&nbsp;

Approved — ship the three fixes. But update the expected target: the 7.186 BET factor was from v4. In v3, BET 2045 TCO is 45.44 (ratio 1.30), so the correct BET TCO factor is ~58-60, not 7. Do NOT treat a post-fix factor of ~58 as a bug — it matches the v3 ratio.

The real question for the diff: after this fix, does BAU BET 2045 share land near the v3 Output Summary value of ~57% (537,962 / 707,250)? If BET still overshoots toward 80-100%, the problem is NOT TCO — it's that the other 4 choice factors (price/payload/TAT/range) aren't pulling BET down enough in v3, OR the normalization needs the supply-readiness cap. Flag that in the diff but don't fix it this turn.

So paste: B1 2045 TCO trace (targets Diesel 59.2 / BET 45.4), the BET *share* at 2045 (target ~57%), and the full sales diff. The TCO factor number itself is now just informational — the share is what matters.