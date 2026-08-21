# 3. Model Reference

Read this before changing anything in `src/lib/sim/` or `src/lib/constants/`.

## Where the numbers come from

`CoEZET PTCM v2.xlsx` sits at the repo root and is **committed on purpose** (`.gitignore`
skips `*.xlsx` but makes an exception for this one). It has about 50 sheets. This app is a
re-implementation of that workbook, not a model of its own.

| Excel sheet | Used by |
|---|---|
| `Parameters Fixed` / `No change with year` | `BAU_FIXED`, `FINANCE`, `TECH_SPECS`, battery and fuel-cell life |
| `Parameters Varying` / `Changing with year` | `BAU_PARAMETERS` base values and growth rates, vehicle price build-up, toll rows |
| `Input Sheet` | choice-model ratings (`BUCKET_CHOICE_ELASTICITIES`) |
| `B1`–`B14 - TCO ML` | per-bucket cost build-up; `BUCKET_OPEX_CALIBRATION`, maintenance defaults |
| `Estimation SS-2045` / `Estimation SS-2050` | share adjustments, rebuilt in `sim/adjustments.ts` (snapshot: `CHOICE_SHARE_ADJUSTMENT_BASELINE`) |
| `Estimation 100% ZET 2055` | the `zetOnly` branch of `computeShares` |
| `PTTM` | curve shapes, `GOMPERTZ_PARAMS_BY_PT`, pilot shares |
| `Emissions` | `EMISSION_FACTORS`, `betGridFactor` |
| `Segmentwise Sales/Stock`, `Applicationwise Sales/Stock` | `segmentAppShares.ts` |
| `Output Summary` | targets for `scripts/validate_against_xlsx.ts` |
| `Energy Requirementsfinal` | the diesel-saved KPI and the energy charts |

**Rule:** when you add or change a constant, write the sheet name and cell in a comment next
to it. Almost every existing constant has one. This is what lets someone check the model a
year from now.

## The 14 buckets

A bucket is one use case combined with one truck size. All maths runs per bucket, then gets
combined using the 2045 share weights below.

| ID | Use case | Size | Share of 2045 sales |
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

These add up to about **91%**. The other 9% (`OTHER_DIESEL_TIV_SHARE`) is treated as
diesel-only "Other" that never switches. Each bucket also carries its annual km, working
days, weights, fuel efficiency per powertrain, battery/fuel-cell/tank sizes, tyre counts and
maintenance baselines — all in the `BUCKETS` array in `extracted.ts`.

## Stage 1 — `timeSeries.ts`

Turns each input into a 30-value array covering 2026 to 2055.

```
arr[0]  = baseValue                       // 2026
arr[i]  = arr[i-1] × (1 + growth rate)    // compounds year on year
arr[i]  = overrides[year]                 // unless that year is pinned
```

The growth band is chosen by year: `≤2030 → d2530`, `≤2035 → d3135`, `≤2040 → d3640`,
`≤2045 → d4145`, `≤2050 → d4650`, else `d5155`.

Three inputs (`diesel_vehicle_growth`, `engine_trans_growth`, `e_powertrain_growth`) are
multipliers rather than prices: they start at `1.0` and build up. Pins are ignored for these.

One policy setting acts here: `diesel_price_5pct_yoy_after_2045` forces diesel's `d4650` and
`d5155` to 0.05.

## Stage 2 — `tco.ts`

### Vehicle price (per bucket × powertrain × year)

Every price starts from a diesel price for that truck size
(`VEHICLE_BASE_PRICES_2026`, editable via `segmentBasePrices`), grown by the
`diesel_vehicle_growth` multiplier. The BS-VII emission-norm cost of **₹400,000** is added in
2030 and grows after that.

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

- **ZET BS-VII relief** — BET and FCET only pay half the norm cost: ₹200,000 in 2030,
  ₹206,000 (= 200,000 × 1.03) from 2031 on.
- **OEM margins** fall over time; see `BET_OEM_MARGIN_BY_YEAR` / `FCET_OEM_MARGIN_BY_YEAR`.
- **Demand incentives** have two phases: the full rate until
  `*_incentive_phase1_end_year`, a lower rate until `*_incentive_phase2_end_year`, then zero.
  The incentive is per kWh × battery size. These are the workbook's `$AH$128` (2026-30) and
  `$AI$128` (2031-35) cells; rows 129-137 and 142-149 subtract nothing from 2036 on.
  **Because the model only prices 2045, 2050 and 2055, this setting has no effect** — that
  matches the workbook, it is not a bug. Do not "fix" it by pushing the end years past 2045;
  `src/test/demandIncentive.test.ts` will fail.

### Cost per km (7 years of ownership)

```
resale     = price × resalePct(profile, powertrain, tier)
              tier: ≤2035 | 2036–2045 | 2046+
              profile: general | high_duty | tipper
              BET after 2046 can be overridden by policy.bet_resale_2046_plus

financed   = price × r × n / (1 − (1+r)^−n)          // loan on the full price
insurance  = price × insurance_rate × 7
capex      = financed − resale + insurance

running/km = fuel/km + maintenance/km + toll/km + manpower/km
TCO/km     = (capex + running/km × annualKm × 7) / (annualKm × 7)
```

- **Interest rate and loan length** depend on `isZET(pt)`, which in the code means
  **`BET` or `H2-FCET` only** — H2-ICE is financed like a diesel truck. The workbook itself
  disagrees with itself here (8 of the 14 bucket sheets use the ICE rate `C26`/`C25` for
  H2-ICE, 6 use the ZET rate `C28`/`C27`). Both rates are 12% over 7 years at BAU, so it
  makes no difference until someone changes the Funding inputs. See [07](07-known-issues.md).
- **Toll** uses a different rule, `usesZetToll(pt)` = **BET + H2-ICE + H2-FCET**. All 14
  bucket sheets agree on this one: the row is called `Toll Charges (H2 ICE, BET & FCET)` and
  the H2-ICE block points at it (B1 row 122 → row 60 → `Changing with year` row 277, the ZET
  toll table at rows 276–284).
- **Fuel per km** — diesel adds AdBlue; BET uses the electricity price minus any subsidy
  (until `electricity_subsidy_end_year`, default 2055); hydrogen uses the blended green/grey
  production cost plus compression and storage. The electricity subsidy is a
  **dashboard-only** setting — the workbook has no subsidy at all — so unlike the demand
  incentives, its end year is not tied to Excel.
- **Maintenance per km** — Diesel, BET and FCET can be edited per bucket via
  `fixed.bucket_maintenance` (defaults in `maintenance.ts` match Excel); CNG, LNG and H2-ICE
  grow at a flat 4% a year. BET and FCET also carry a **battery/fuel-cell life adjustment**:
  changing battery cycles or fuel-cell hours away from the defaults (3,000 cycles /
  25,000 hours) shifts maintenance by the change in replacement cost per km. At the default
  life this adjustment is exactly zero, so it cannot quietly move the baseline.
- **Toll and manpower** are interpolated between a 2026 and a 2045 value per bucket
  (`BUCKET_OPEX_CALIBRATION`).

### Hydrogen source mix

`greyH2FractionForYear()` is the one place this is decided, and it feeds both cost and
emissions:

| `policy.h2_source_mix` | Grey fraction |
|---|---|
| `green_only` (default) | 0 |
| `blend_2046_green` | a flat % or a per-band %, **0 from 2046 on** |
| `cheapest` | 1 when grey is cheaper than green, else 0 |

> The Excel workbook uses **0% grey in every year**. Grey only appears there as a cost input.
> The blend and "cheapest" options are extra what-if settings this dashboard adds, and the
> grey emission factor (10 kgCO₂e/kg, SMR) comes from published literature, not the workbook.

## Stage 3 — `choiceModel.ts`

Five factors, each compared against diesel, then combined:

```
arg[f]     = rating[f] × (ratio[f] − 1)
factor[f]  = exp(clamp(arg[f], −50, +50))
score[pt]  = sum of factor[f] over TCO, price, payload, TAT, range
share[pt]  = score[pt] / sum of all scores
```

| Factor | Ratio | Which way is better |
|---|---|---|
| TCO | `dieselTCO / ptTCO` | lower cost |
| Vehicle price | `dieselPrice / ptPrice` | lower price |
| Rated payload | `ptPayload / dieselPayload` | higher payload |
| TAT / gradeability | `ptRating / dieselRating` | higher rating |
| Range / filling time | `dieselRating / ptRating` | lower penalty |

Ratings are per bucket (`BUCKET_CHOICE_ELASTICITIES`, averaged from `Input Sheet` rows 8–12)
and already include the ×1.5 factor from the workbook.

**Payload** is worked out live in `computeBucketPayload`:

```
diesel = GVW − ULW
BET    = round((diesel − battDensity × betKWh) / 100) × 100 + extraGVW
FCET   = round((diesel − battDensity × fcetKWh − fcDensity × fcKW) / 100) × 100 + extraGVW
extraGVW = policy.gvw_payload_compensation_t × 1000
         + policy.zet_additional_gvw_kg[sizeClass]
```

Diesel, CNG, LNG and H2-ICE all use the diesel payload. Only BET and FCET lose payload to
their battery and fuel cell.

**Availability** — a powertrain scores 0 in a bucket before its `START_OF_SUPPLY[size][pt]`
year.

**Share adjustments** — after the shares are normalised, each is multiplied by a per-bucket
factor and normalised again. The workbook does not store these as fixed numbers; it works
them out from year inputs, and so does `src/lib/sim/adjustments.ts`. Every layer has the
same form:

```
delay(pt) = 1 − (year[pt] − year[baseline]) / (steadyState − year[baseline])
```

| Anchor | Layers | Baseline | Steady state |
|---|---|---|---|
| 2045 | supply × potentialTIV | Diesel | 2045 |
| 2050 | supply × maturity × potentialTIV | Diesel | 2050 |
| 2055 | maturity only | **BET** | 2055 |

Year inputs: `START_OF_SUPPLY` (`No change with year` J63:O79, per size class) and
`PT_MATURITY_YEARS` (P65:U65 — the workbook only fills the 15T row and applies it to every
bucket, which is why the matching policy settings are single values). Steady-state years are
`Input Sheet` BO1/CB1/CK1.

Worked example, B1 at 2050: CNG = supply `1−(2027−2025)/25` × maturity `1−(2030−2025)/25`
= 0.92 × 0.80 = **0.736**; BET 0.92 × 0.60 = **0.552**; H2-ICE 0.64 × 0.32 = **0.2048**.

`policy.bet_maturity_year` / `h2ice_maturity_year` / `fcet_maturity_year` feed the maturity
layer, so they move the 2050 and 2055 anchors. The **"Potential TIV"** layer (which zeroes
CNG or LNG in buckets where they are not sold) is derived when the module loads, by dividing
the extracted `CHOICE_SHARE_ADJUSTMENT_BASELINE` snapshot by the default delay factors. That
guarantees the calculated path matches the workbook exactly at defaults, which
`src/test/choiceAdjustment.test.ts` checks to nine decimal places.

**TCO parity** — `sim/parity.ts` walks 2026 to 2055 and reports the first year each ZET's
cost per km reaches diesel, per bucket, matching the `Buckets` AE3:AG16 / AH3:AJ16 array
formula. It runs on every simulation and appears as `SimulationResult.parityYears`. At BAU it
matches the workbook for 36 of 42 cells (all hydrogen ones). The six BET cells that differ are
each exactly one year late, because the model starts at 2026 and the workbook starts at 2025.

**2055 is ZET-only.** `computeShares(..., zetOnly = true)` sets Diesel, CNG and LNG to zero
and renormalises across BET, H2-ICE and H2-FCET, matching the `Estimation 100% ZET 2055`
sheet. The 2055 ZET share is 100% because the model is told to make it so, not because it
works out that way.

### Excel mistakes copied on purpose

These are marked `Excel quirk:` in the source. **Do not remove them without checking with
CoEZET** — they change published numbers.

1. **B9 / B11 2055 diesel baseline.** The workbook's "2055 Diesel VE" cells for these two
   buckets point at the LNG row (`AG167`) instead of the diesel row (`AG165`). The code does
   the same: in the ZET-only pass, B9 and B11 are scored against LNG.
2. **B12 BET and H2-ICE swapped.** In the 2045 and 2050 Estimation sheets, B12's BET and
   H2-ICE cost cells are the wrong way round. The code swaps them the same way.

## Stage 4 — `pttm.ts`

Takes the 2045, 2050 and 2055 anchors and fills in every year between. Curves run **per
bucket**. Because every branch after the inflection point is linear in the bucket anchors,
the weighted total matches the workbook's single global curve.

### Gompertz curves (BET, H2-ICE, H2-FCET)

```
year < pilotYear                → 0
pilotYear ≤ y ≤ inflection      → a · exp(−b · exp(−c · (y − pilotYear)))
inflection < y ≤ 2045           → cosine ramp   0.05 → Z2045
2045 < y ≤ 2050                 → straight line Z2045 → Z2050
2050 < y ≤ 2055                 → straight line Z2050 → Z2055
```

Parameters are worked out the way the workbook does (`PTTM` columns T/W/X):

```
b = ln( max(a, W × 1.01) / W )
c = −(1 / (inflection − pilot)) × ln( ln( max(a, 0.0501) / 0.03 ) / b )
```

`W` is the pilot share and `a` starts at the 2055 anchor. **For BET only**, `a` is adjusted
so the raw curve passes exactly through the 2055 anchor. The workbook does this with a
circular reference (column Z); the code solves it by repeating the calculation (up to 50
times, stopping at 1e-12).

Pilot years come from `GOMPERTZ_PARAMS_BY_PT`. Inflection years are policy settings
(`bet_inflection_year`, `h2ice_inflection_year`, `fcet_inflection_year`).

### Weibull curves (CNG, LNG)

```
year < 2026        → 0
2026 ≤ y ≤ 2045    → share2026 + (Z2045 − share2026) × wbl(y)/wbl(2045)
2045 < y ≤ 2050    → straight line Z2045 → Z2050
2050 < y ≤ 2055    → cosine decay Z2050 → 0

wbl(y) = t^(α−1) · exp( ((α−1)/α) · (1 − t^α) ),   t = (y − 2026)/(2045 − 2026)
α = WEIBULL_SHAPE_ALPHA = 5
share2026 = CNG_UNITS_2026 / TIV_2026   (13,374 / 301,120), LNG the same way (414)
```

The cosine decay forces CNG and LNG to zero by 2055.

### Diesel is the remainder

Per bucket and in total: if the non-diesel shares add up to more than 1.0 they are scaled
down proportionally, then `Diesel = max(0, 1 − everything else)`. Sales are
`share × TIV_PROJECTION[year]`.

## Stage 5 — `stockEmissions.ts`

- **Fleet stock.** Starts from `DIESEL_STOCK_END_2025 = 5,315,061`, adds each year's sales,
  retires trucks after `SCRAPPAGE_AGE_YEARS = 20`, and scraps an extra
  `PRE_2001_DIESEL_SCRAPPAGE_PER_YEAR = 125,000` old diesels a year until
  `PRE_2001_SCRAPPAGE_END_YEAR = 2040`. Pre-2026 sales come from `HISTORICAL_SALES` and are
  all diesel.
- **Emissions** use bucket-weighted rates per vehicle. Combustion factors are well-to-wheel
  (diesel 3.13, CNG 2.66, LNG 2.88 kgCO₂e per unit). BET uses a grid factor that improves
  each year, `betGridFactor(y) = 0.7455 × 0.97^(y − 2025)` from `Emissions` R49 — not a fixed
  number. Hydrogen blends a green baseline with grey intensity using the grey fraction.
- **Comparison case** — `dieselCounterfactualEmissions = totalStock × dieselWeightedRate`,
  i.e. the same fleet if every truck had stayed diesel.
  `cumulativeCO2Avoided` is the running total of the difference.
- **Two meanings of ZET** — `zetShare` and `totalZetSales` are **BET + H2-ICE + H2-FCET**
  (Excel `PTTM` columns C+E+G). H2-ICE counts as a ZET here even though `isZET()` in `tco.ts`
  leaves it out for financing. Both are intentional. See [07](07-known-issues.md).
- **Segment and application splits** do **not** come from bucket weights. They use the
  workbook's own share tables by year, copied into `segmentAppShares.ts`: yearly total per
  powertrain × share table. Diesel, BET and hydrogen use the general 7-band shares; CNG uses
  normalised shares (only Rigid 12–19T and 19–28.5T); LNG normalised (only the 3 tractor
  bands); applications use one table for all powertrains. `SEGMENT_OF_BUCKET` and
  `APPLICATION_OF_BUCKET` in `segments.ts` are leftovers and unused. The per-bucket
  roll-forward still exists, but only for energy figures.

## Health checks (`sanityCheck.ts`)

Twelve checks against `BAU_BASELINE_CHECKS`, shown in the header badge and asserted in
`src/test/rebase_check.test.ts`:

| Check | Target |
|---|---|
| `total_sales_2026 / 2045 / 2055` | 301,120 / 707,250 / 1,029,830 (±2%) |
| `zet_share_2045` | 70%–90% |
| `zet_share_2055` | 95%–100% |
| `diesel_2026_units` | 270,000–300,000 |
| `cng_share_2030 / 2045 / 2055` | 1–15% / ≥2% / ≤0.5% |
| `lng_share_2030 / 2045 / 2055` | 0.05–0.5% / 0.1–1.5% / ≤0.5% |

Current BAU output: ZET 2045 = 79.6%, diesel 2026 = 286,925 units (Excel 286,923).

## Base year

The model was moved from a 2025 start to a **2026** start in commit `c406730`.
`START_YEAR = 2026`, `END_YEAR = 2055`, `YEAR_COUNT = 30`. Any comment or document still
saying "2025 base" is out of date.
