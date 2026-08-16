# 3. Model Reference

This is the document to read before changing anything in `src/lib/sim/` or
`src/lib/constants/`.

## Source of truth

`CoEZET PTCM v2.xlsx` sits at the repo root and is **deliberately committed** (`.gitignore`
ignores `*.xlsx` but explicitly un-ignores this one). It has ~50 sheets. The dashboard is a
re-implementation of it, not an independent model.

Sheets that matter, and where they land in code:

| Excel sheet | Consumed by |
|---|---|
| `Parameters Fixed` / `No change with year` | `BAU_FIXED`, `FINANCE`, `TECH_SPECS`, battery/FC life constants |
| `Parameters Varying` / `Changing with year` | `BAU_PARAMETERS` base values + CAGRs, vehicle price build-up, toll rows |
| `Input Sheet` | choice-model elasticity ratings (`BUCKET_CHOICE_ELASTICITIES`) |
| `B1`–`B14 - TCO ML` | per-bucket TCO build-up; `BUCKET_OPEX_CALIBRATION`, maintenance defaults |
| `Estimation SS-2045` / `Estimation SS-2050` | `CHOICE_SHARE_ADJUSTMENT[2045]`, `[2050]` |
| `Estimation 100% ZET 2055` | the `zetOnly` branch of `computeShares` |
| `PTTM` | Gompertz/Weibull curve shapes, `GOMPERTZ_PARAMS_BY_PT`, pilot shares |
| `Emissions` | `EMISSION_FACTORS`, `betGridFactor` |
| `Segmentwise Sales/Stock`, `Applicationwise Sales/Stock` | `segmentAppShares.ts` |
| `Output Summary` | validation targets for `scripts/validate_against_xlsx.ts` |
| `Energy Requirementsfinal` | the diesel-displaced KPI and energy charts |

**Convention:** when you add or change a constant, put the sheet name and cell reference in
a comment next to it. Nearly every existing constant has one. This is what makes the model
auditable a year from now.

## The 14 buckets

A "bucket" is a use-case × vehicle-size combination. All model maths runs per bucket, then
aggregates with `tivShare2045` weights.

| ID | Use case | Size | TIV share 2045 |
|---|---|---|---|
| B1 | Market Load | 19T Rigid | 6.57% |
| B2 | Market Load | 28T Rigid | 6.21% |
| B3 | Market Load | 48T Rigid | 5.33% |
| B4 | Parcel Load and FMCG | 19T Rigid | 5.04% |
| B5 | Parcel Load and FMCG | 28T Rigid | 11.49% |
| B6 | Perishables | 15T Rigid | 6.99% |
| B7 | Construction & Mining | 28T Tipper | 12.13% |
| B8 | Construction & Mining | 35T Tipper | 17.58% |
| B9 | Cement (Bulkers & Bagged) | 48T Rigid | 6.27% |
| B10 | Cement (Bulkers & Bagged) | 55T Tractor | 4.70% |
| B11 | Steel & metal products | 55T Tractor | 9.71% |
| B12 | Tankers - POL & CNG cascades | 28T Rigid | 3.04% |
| B13 | Tankers - Non POL | 28T Rigid | 3.64% |
| B14 | LPG bullet tankers | 40T Tractor | 1.29% |

Shares sum to **~91%**. The residual ~9% (`OTHER_DIESEL_TIV_SHARE`) is modelled as
diesel-only "Other" and never transitions. Each bucket carries its annual km, working days,
ULW/GVW, per-powertrain efficiency, battery/fuel-cell/tank sizing, tyre counts and
maintenance baselines — all in the `BUCKETS` array in `extracted.ts`.

## Stage 1 — `timeSeries.ts`

Turns each `ParameterConfig` into a 30-element array for 2026…2055.

```
arr[0]  = baseValue                       // 2026
arr[i]  = arr[i-1] × (1 + CAGR_for_year)  // compounding
arr[i]  = overrides[year]                 // if a per-year pin exists
```

The CAGR band is picked by year: `≤2030 → d2530`, `≤2035 → d3135`, `≤2040 → d3640`,
`≤2045 → d4145`, `≤2050 → d4650`, else `d5155`.

Three keys (`diesel_vehicle_growth`, `engine_trans_growth`, `e_powertrain_growth`) are
**growth-rate** series: they start at `1.0` and hold a cumulative multiplier rather than an
absolute value. Pins are ignored for these.

One policy override lives here: `diesel_price_5pct_yoy_after_2045` forces
`diesel_price_per_l`'s `d4650` and `d5155` to 0.05.

## Stage 2 — `tco.ts`

### Vehicle price (per bucket × powertrain × year)

All prices build off a per-size diesel base (`VEHICLE_BASE_PRICES_2026`, overridable through
`segmentBasePrices`), grown by the cumulative `diesel_vehicle_growth` multiplier. The BS-VII
emission-norm bump of **₹400,000** lands in 2030 and compounds thereafter.

```
Diesel   = base.diesel_total × g(y)  + BSVII(y)
CNG      = (base.diesel_total + tank) × g(y) + BSVII(y)
             tank = ₹154,500 (15T) or ₹257,500 (all other sizes)
LNG      = Diesel(y) + lngCapacityKg × lngTankCost(y) + valves(y)
             lngCapacityKg = 990×0.35 (tractors) or 450×0.35
H2-ICE   = Diesel(y) + h2TankKg × h2TankCost(y)
BET      = Diesel(y) − engineTrans(y) + ePowertrain(y) + battery(y)
           + OEM_margin(y) × (ePowertrain + battery)
           − ZET_BSVII_relief(y) − incentive
FCET     = Diesel(y) − engineTrans(y) + ePowertrain(y) + fuelCell(y)
           + battery(y) + h2Tank(y)
           + OEM_margin(y) × (ePowertrain + battery + fuelCell)
           − ZET_BSVII_relief(y) − incentive
```

- **ZET BS-VII relief** — BET/FCET bear only half the bump: ₹200,000 in 2030, ₹206,000
  (= 200,000 × 1.03) from 2031 on.
- **OEM margins** decline over time; see `BET_OEM_MARGIN_BY_YEAR` / `FCET_OEM_MARGIN_BY_YEAR`.
- **Demand incentives** are two-phase: full rate through
  `*_incentive_phase1_end_year`, a reduced phase-2 rate through
  `*_incentive_phase2_end_year`, then zero. Incentive is per kWh × battery size (BET uses
  `betBatteryKWh`, FCET uses `fcetBatteryKWh`).

### TCO per km (7-year ownership)

```
resale     = price × resalePct(profile, powertrain, tier)
              tier: ≤2035 | 2036–2045 | 2046+
              profile: general | high_duty | tipper
              BET after 2046 can be overridden by policy.bet_resale_2046_plus

financed   = price × r × n / (1 − (1+r)^−n)          // full-price annuity
insurance  = price × insurance_rate × 7
capex      = financed − resale + insurance

opex/km    = fuel/km + maintenance/km + toll/km + manpower/km
TCO/km     = (capex + opex/km × annualKm × 7) / (annualKm × 7)
```

- **Interest rate and tenure** split on `isZET(pt)`, which in code is
  **`BET || H2-FCET` only** — H2-ICE is financed as an ICE. Same split governs the toll
  waiver. See [07](07-gotchas-and-backlog.md) for why that is worth double-checking against
  the workbook.
- **Fuel/km** — diesel adds AdBlue; BET uses `electricity_incl_caas_per_kwh` minus the
  electricity subsidy (until `electricity_subsidy_end_year`); H2 uses the blended
  green/grey production cost plus compression/storage.
- **Maintenance/km** — Diesel/BET/FCET are user-editable per bucket via
  `fixed.bucket_maintenance` (defaults from `maintenance.ts` reproduce the Excel baseline);
  CNG/LNG/H2-ICE grow at a flat 4 %/yr. BET/FCET additionally carry a **Key Aggregate Life
  delta**: changing battery cycles or fuel-cell hours away from the defaults (3,000 cycles /
  25,000 hrs) shifts maintenance by the change in replacement cost per km. The delta is
  exactly zero at default life, so it cannot silently perturb the baseline.
- **Toll and manpower** interpolate a per-bucket `[2026, 2045]` pair with the implied CAGR
  (`BUCKET_OPEX_CALIBRATION`).

### Hydrogen source mix

`greyH2FractionForYear()` is the single source of truth, shared by cost *and* emissions:

| `policy.h2_source_mix` | Grey fraction |
|---|---|
| `green_only` (default) | 0 |
| `blend_2046_green` | uniform % or per-band %, **0 from 2046 on** |
| `cheapest` | 1 when grey production cost < green, else 0 |

> The Excel workbook uses **0 % grey in every year**. Grey appears there only as a cost
> input. The blend and "cheapest" options are dashboard-only what-if levers beyond the
> workbook, and the grey emission factor (10 kgCO₂e/kg, SMR) comes from literature, not
> from the workbook.

## Stage 3 — `choiceModel.ts`

Five factors, each compared against diesel, exponentiated and summed:

```
arg[f]     = elasticity[f] × (ratio[f] − 1)
factor[f]  = exp(clamp(arg[f], −50, +50))
score[pt]  = Σ factor[f]  over  TCO, price, payload, TAT, range
share[pt]  = score[pt] / Σ score[all pt]
```

| Factor | Ratio | Direction |
|---|---|---|
| TCO | `dieselTCO / ptTCO` | lower TCO is better |
| Vehicle price | `dieselPrice / ptPrice` | lower price is better |
| Rated payload | `ptPayload / dieselPayload` | higher payload is better |
| TAT / gradeability | `ptRating / dieselRating` | higher rating is better |
| Range / filling time | `dieselRating / ptRating` | lower penalty is better |

Elasticities are per bucket (`BUCKET_CHOICE_ELASTICITIES`, averaged from `Input Sheet`
rows 8–12) and already include the ×1.5 lambda from the workbook.

**Payload** is derived live in `computeBucketPayload`:

```
diesel = GVW − ULW
BET    = round((diesel − battDensity × betKWh) / 100) × 100 + extraGVW
FCET   = round((diesel − battDensity × fcetKWh − fcDensity × fcKW) / 100) × 100 + extraGVW
extraGVW = policy.gvw_payload_compensation_t × 1000
         + policy.zet_additional_gvw_kg[sizeClass]
```

Diesel, CNG, LNG and H2-ICE all use the diesel payload — only BET and FCET carry a penalty.

**Supply timing** — a powertrain scores 0 for a bucket before its
`START_OF_SUPPLY[size][pt]` year.

**Estimation-sheet adjustments** — after normalising, shares are multiplied by
`CHOICE_SHARE_ADJUSTMENT[targetYear][bucketId][pt]` (supply-delay / maturity / potential-TIV
factors from the Excel Estimation sheets), then renormalised.

**2055 is ZET-only.** `computeShares(..., zetOnly = true)` zeroes Diesel/CNG/LNG and
renormalises among BET / H2-ICE / H2-FCET, reproducing the `Estimation 100% ZET 2055` sheet.
This is why the 2055 ZET share is 100 % by construction, not by convergence.

### Deliberately reproduced Excel bugs

These are labelled `Excel quirk:` in the source. **Do not remove them without checking with
CoEZET** — they change published numbers.

1. **B9 / B11 2055 diesel baseline.** The workbook's "2055 Diesel VE" cells for these two
   buckets point at the LNG TCO row (`AG167`) instead of the diesel row (`AG165`). The code
   replicates this: in the `zetOnly` pass, B9 and B11 score against LNG.
2. **B12 BET ↔ H2-ICE cross-wiring.** In the 2045 and 2050 Estimation sheets, B12's BET and
   H2-ICE TCO factor cells are swapped. The code swaps them back the same way.

## Stage 4 — `pttm.ts`

Takes the 2045 / 2050 / 2055 anchors from the choice model and draws a year-by-year
trajectory. Curves run **per bucket**; because every post-inflection branch is linear in the
bucket anchors, the TIV-weighted aggregate equals the workbook's global curve.

### Gompertz family (BET, H2-ICE, H2-FCET)

```
year < pilotYear                → 0
pilotYear ≤ y ≤ inflection      → a · exp(−b · exp(−c · (y − pilotYear)))
inflection < y ≤ 2045           → cosine ramp   0.05 → Z2045
2045 < y ≤ 2050                 → linear        Z2045 → Z2050
2050 < y ≤ 2055                 → linear        Z2050 → Z2055
```

with parameters derived the way the workbook does (`PTTM` cols T/W/X):

```
b = ln( max(a, W × 1.01) / W )
c = −(1 / (inflection − pilot)) × ln( ln( max(a, 0.0501) / 0.03 ) / b )
```

`W` is the pilot share and `a` starts at the aggregate 2055 anchor. **For BET only**, `a` is
additionally normalised so the raw Gompertz passes through Z2055 at 2055 — the workbook does
this with a circular reference (col Z), and the code resolves it by fixed-point iteration
(50 iterations, 1e-12 tolerance).

Pilot years come from `GOMPERTZ_PARAMS_BY_PT`; inflection years are **policy levers**
(`bet_inflection_year`, `h2ice_inflection_year`, `fcet_inflection_year`).

### Weibull family (CNG, LNG)

```
year < 2026        → 0
2026 ≤ y ≤ 2045    → share2026 + (Z2045 − share2026) × wbl(y)/wbl(2045)
2045 < y ≤ 2050    → linear  Z2045 → Z2050
2050 < y ≤ 2055    → cosine decay  Z2050 → 0

wbl(y) = t^(α−1) · exp( ((α−1)/α) · (1 − t^α) ),   t = (y − 2026)/(2045 − 2026)
α = WEIBULL_SHAPE_ALPHA = 5
share2026 = CNG_UNITS_2026 / TIV_2026   (13,374 / 301,120), LNG likewise (414)
```

CNG and LNG are forced to zero by 2055 by the cosine decay term.

### Diesel is the residual

At both the per-bucket and aggregate level: if the non-diesel shares sum above 1.0 they are
scaled down proportionally, then `Diesel = max(0, 1 − Σ others)`. Sales are
`share × TIV_PROJECTION[year]`.

## Stage 5 — `stockEmissions.ts`

- **Stock roll-forward.** Starts from `DIESEL_STOCK_END_2025 = 5,315,061`, adds each year's
  sales, retires vehicles after `SCRAPPAGE_AGE_YEARS = 20`, and additionally scraps
  `PRE_2001_DIESEL_SCRAPPAGE_PER_YEAR = 125,000` pre-2001 diesels per year until
  `PRE_2001_SCRAPPAGE_END_YEAR = 2040`. Pre-2026 sales come from `HISTORICAL_SALES` and are
  all diesel.
- **Emissions** use bucket-weighted per-vehicle rates. Combustion factors are **well-to-wheel**
  (diesel 3.13, CNG 2.66, LNG 2.88 kgCO₂e per unit). BET uses a year-varying grid factor
  `betGridFactor(y) = 0.7455 × 0.97^(y − 2025)` from `Emissions` R49 — not a constant.
  H2 blends a green baseline with grey production intensity according to the grey fraction.
- **Counterfactual** — `dieselCounterfactualEmissions = totalStock × dieselWeightedRate`,
  i.e. the same fleet if every vehicle had stayed diesel.
  `cumulativeCO2Avoided = Σ (counterfactual − actual)`.
- **ZET definition** — `zetShare` and `totalZetSales` are **BET + H2-ICE + H2-FCET**
  (Excel `PTTM` cols C+E+G). H2-ICE counts as a ZET here even though `isZET()` in `tco.ts`
  excludes it for financing purposes. Two different meanings of "ZET", both intentional.
- **Segment / application splits** do **not** derive from bucket GVW. They use the workbook's
  own year-varying share tables, extracted verbatim into `segmentAppShares.ts`: per-powertrain
  yearly totals × share table. Diesel/BET/H2 use the general 7-segment shares; CNG uses
  normalised shares (only Rigid 12–19T and 19–28.5T); LNG normalised (only the 3 tractor
  bands); applications use one table for all powertrains. `SEGMENT_OF_BUCKET` and
  `APPLICATION_OF_BUCKET` in `segments.ts` are legacy and currently unused.
  The per-bucket roll-forward remains, but only for energy accounting.

## Sanity checks (`sanityCheck.ts`)

Twelve checks against `BAU_BASELINE_CHECKS`, surfaced in the header badge and asserted in
`src/test/rebase_check.test.ts`:

| Check | Target |
|---|---|
| `total_sales_2026 / 2045 / 2055` | 301,120 / 707,250 / 1,029,830 (±2 %) |
| `zet_share_2045` | 70 %–90 % |
| `zet_share_2055` | 95 %–100 % |
| `diesel_2026_units` | 270,000–300,000 |
| `cng_share_2030 / 2045 / 2055` | 1–15 % / ≥2 % / ≤0.5 % |
| `lng_share_2030 / 2045 / 2055` | 0.05–0.5 % / 0.1–1.5 % / ≤0.5 % |

Current BAU output: ZET 2045 = 79.6 %, diesel 2026 = 286,925 units (Excel 286,923).

## Base year

The model was rebased from 2025 to **2026** in commit `c406730`. `START_YEAR = 2026`,
`END_YEAR = 2055`, `YEAR_COUNT = 30`. Any document or comment still saying "2025 base" is
stale.
