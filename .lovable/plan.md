## Fix Diesel Premature Zeroing (2048 → should be 2055)

### Root cause

In `src/lib/sim/pttm.ts`, `gompertzShare()` double-normalizes:

```ts
const normDenom = Math.exp(-b * Math.exp(-c * endDelta));
const a = share2055 / normDenom;
const gompertzMain = (a * Math.exp(-b * Math.exp(-c * (year - startYear)))) / normDenom;
```

At `year = 2055` this evaluates to `share2055 / normDenom` (BET: normDenom ≈ 0.787 ⇒ ~1.27× target), not `share2055`. The curve overshoots, BET + H2-ICE + H2-FCET exceeds 1.0 by 2048, and the residual diesel clamp (`Math.max(0, 1 − sum)`) zeroes diesel six years too early.

`GOMPERTZ_PARAMS_BY_PT` in `extracted.ts` already stores the correct Excel PTTM literal `a` per powertrain, but only `literalB` and `literalC` are threaded into `gompertzShare()` — `a` is re-derived from `share2055` instead.

### Changes

**File 1 — `src/lib/sim/pttm.ts`**

1a. Add `literalA?: number` to the `gompertzShare` args type.

1b. Replace the `a` derivation:
```ts
const a = args.literalA !== undefined ? args.literalA : share2055 / normDenom;
```

1c. In `computePTTM`, pass `literalA: lit?.a` alongside the existing `literalB` / `literalC`.

**File 2 — `src/lib/constants/extracted.ts`**

2a. Update BET Gompertz params to v4 values:
```ts
BET: { a: 1.0382, b: 7.5299, c: 0.12560, W: 0.0005572, startYear: 2025 },
```
(H2-ICE, H2-FCET already match v4.)

2b. Update 2025 anchors:
```ts
export const CNG_UNITS_2025 = 11875;  // was 14892
export const LNG_UNITS_2025 = 368;    // was 607
```

### Expected outcome (BAU)

- 2045: BET ≈ 76%, Diesel ≈ 15%, CNG ≈ 4.9%
- 2047: Diesel ≈ 10–12%
- 2048: Diesel ≈ 8–10% (was 0%)
- 2054: Diesel > 0
- 2055: Diesel = 0
- 2025: CNG ≈ 11,875 units, LNG ≈ 368 units

### Verification

1. Open dashboard → BAU → Annual Sales chart. Diesel line should taper smoothly to 0 only at 2055.
2. Market Share tab CSV export: spot-check 2045 / 2047 / 2048 / 2054 / 2055 against the Excel `PTTM` sheet.
3. Console Layer 4 dump: 2045 BET ≈ 0.76, Diesel ≈ 0.15; 2055 ZET sum ≈ 1.0.
