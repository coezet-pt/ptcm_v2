/**
 * TCO module — vehicle prices and 7-year total cost of ownership
 * per bucket × powertrain × target year.
 */
import type { ParameterKey, PolicyConfig, FixedParameters, SegmentBasePrices } from '@/lib/types';
import type { Powertrain, Bucket } from '@/lib/constants/extracted';
import {
  VEHICLE_BASE_PRICES_2026,
  BS_VII_PRICE_BUMP_2030,
  BET_OEM_MARGIN_BY_YEAR,
  FCET_OEM_MARGIN_BY_YEAR,
  RESALE_VALUES,
  BUCKET_RESALE_PROFILE,
  BUCKET_OPEX_CALIBRATION,
  FINANCE,
  POWERTRAINS,
  DEFAULT_BATTERY_LIFE_CYCLES,
  DEFAULT_FUEL_CELL_LIFE_HOURS,
  BATT_REPL_COST_PER_KWH,
  FC_REPL_COST_PER_KW,
  FC_LIFE_MAX_YEARS,
  BUCKET_ENGINE_HRS_PER_DAY,
} from '@/lib/constants/extracted';
import { buildSeriesFromConfig, getValueAtYear } from './timeSeries';
import { defaultMaintConfig, type MaintMetric } from './maintenance';

// ── Types ──
export interface TCOResult {
  tcoPerKm: number;
  vehiclePrice: number;
  totalCost: number;
  capexPerKm: number;
  opexPerKm: number;
  fuelCostPerKm: number;
  maintPerKm: number;
  manpowerPerKm: number;
  tollPerKm: number;
  resalePct: number;
}

export type BucketTCOMap = Record<string, Record<Powertrain, TCOResult>>;

// ── CNG tank cost — per-vehicle at 2026; folded into the base price which
// grows with the diesel growth rate (Excel 'Changing with year' rows 92-100:
// CNG price − diesel price = 154,500 for the 15T small tank, 257,500 otherwise) ──
const CNG_TANK_BASE_SMALL = 154500;
const CNG_TANK_BASE_LARGE = 257500;

// ZETs bear only half the BS-VII bump: Excel subtracts (400k−200k)·(1+3%)
// from BET/FCET prices from 2030 onward ('Changing with year' rows 130/143).
const ZET_BSVII_RELIEF_2030 = 200000;
const ZET_BSVII_RELIEF_2031_PLUS = 206000; // 200000 × 1.03

// CNG/LNG/H2-ICE maintenance grows at a uniform 4%/yr (Excel bucket sheets).
// Diesel/BET/FCET maintenance is config-driven (see getMaintenancePerKm);
// toll and manpower use per-bucket [2026, 2045] pairs from BUCKET_OPEX_CALIBRATION.
const MAINT_OTHER_ICE_CAGR  = 0.04;

/** Interpolate/extrapolate a [2026, 2045] pair with its implied CAGR. */
function growFromPair(pair: [number, number], year: number): number {
  const [v26, v45] = pair;
  if (v26 <= 0) return v26;
  return v26 * Math.pow(v45 / v26, (year - 2026) / 19);
}

// CNG tank: 150k applies to 15T only ('Changing with year' rows 92-100:
// 15T base +150k, all other sizes +250k).
function hasSmallCngTank(size: string): boolean {
  return size.includes('15T');
}

// LNG tank: 347 kg system only for tractors (rows 112-113); 158 kg otherwise.
function hasLargeLngTank(size: string): boolean {
  return size.includes('Tractor');
}

function resaleTier(year: number): 0 | 1 | 2 {
  if (year <= 2035) return 0;
  if (year <= 2045) return 1;
  return 2;
}

const clampFrac = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/** Grey-hydrogen blend fraction (0–1) for a given year, from the blend policy
 *  setting. Either a single uniform % ('uniform' mode) or a per-5-year-band value
 *  ('bands' mode). Grey hydrogen is discontinued from 2046 onward, so the blend
 *  applies to 2026–2045 only; later years are green-only. */
function greyBlendForYear(policy: PolicyConfig, year: number): number {
  if (year > 2045) return 0;
  if ((policy.grey_h2_blend_mode ?? 'uniform') === 'uniform') {
    return clampFrac(policy.grey_h2_blend_uniform);
  }
  const bands = policy.grey_h2_blend_bands ?? {};
  const key =
    year <= 2030 ? 'd2530' :
    year <= 2035 ? 'd3135' :
    year <= 2040 ? 'd3640' : 'd4145';
  return clampFrac(bands[key]);
}

/**
 * Effective grey-hydrogen fraction (0–1) actually used in supply for a given
 * year — the single source of truth shared by H2 cost (getH2PricePerKg) and
 * H2 emissions (stockEmissions). green_only → 0; blend → per-band fraction
 * (0 after 2045); cheapest → 1 when grey is cheaper than green, else 0.
 */
export function greyH2FractionForYear(
  ts: Record<ParameterKey, number[]>,
  policy: PolicyConfig,
  year: number,
): number {
  switch (policy.h2_source_mix) {
    case 'blend_2046_green':
      return greyBlendForYear(policy, year);
    case 'cheapest': {
      const green = getValueAtYear(ts.green_h2_production_per_kg, year);
      const grey = getValueAtYear(ts.grey_h2_production_per_kg, year);
      return grey < green ? 1 : 0;
    }
    default:
      return 0; // green_only
  }
}

function getH2PricePerKg(
  ts: Record<ParameterKey, number[]>,
  policy: PolicyConfig,
  year: number,
): number {
  const green = getValueAtYear(ts.green_h2_production_per_kg, year);
  const grey = getValueAtYear(ts.grey_h2_production_per_kg, year);
  const compression = getValueAtYear(ts.h2_compression_storage_per_kg, year);
  const gf = greyH2FractionForYear(ts, policy, year);
  const productionCost = (1 - gf) * green + gf * grey;
  return productionCost + compression;
}

/**
 * Diesel-family price trajectory — Excel 'Changing with year' rows 81-100:
 * base grows with ts.diesel_vehicle_growth (cumulative multiplier, 3%/yr BAU);
 * the BS-VII bump lands in 2030 and compounds with the same rate thereafter.
 */
function dieselFamilyPrice(
  base2026: number,
  year: number,
  ts: Record<ParameterKey, number[]>,
): number {
  const g = getValueAtYear(ts.diesel_vehicle_growth, year);
  const g2030 = getValueAtYear(ts.diesel_vehicle_growth, 2030);
  const bump = year >= 2030 && g2030 > 0 ? BS_VII_PRICE_BUMP_2030 * (g / g2030) : 0;
  return base2026 * g + bump;
}

/** BET/FCET BS-VII relief — Excel subtracts (400k−200k)·(1+3%) from 2030 on. */
function zetBsviiRelief(year: number): number {
  if (year < 2030) return 0;
  return year === 2030 ? ZET_BSVII_RELIEF_2030 : ZET_BSVII_RELIEF_2031_PLUS;
}

function computeVehiclePrice(
  pt: Powertrain,
  bucket: Bucket,
  year: number,
  ts: Record<ParameterKey, number[]>,
  policy: PolicyConfig,
  segmentBasePrices: SegmentBasePrices,
): number {
  const base = segmentBasePrices[bucket.size] ?? VEHICLE_BASE_PRICES_2026[bucket.size];

  switch (pt) {
    case 'Diesel':
      return dieselFamilyPrice(base.diesel_total, year, ts);
    case 'CNG': {
      // CNG = diesel 2026 base + tank, all growing with the diesel rate
      const tankBase = hasSmallCngTank(bucket.size) ? CNG_TANK_BASE_SMALL : CNG_TANK_BASE_LARGE;
      return dieselFamilyPrice(base.diesel_total + tankBase, year, ts);
    }
    case 'LNG': {
      const dieselPrice = dieselFamilyPrice(base.diesel_total, year, ts);
      const lngTankCostPerKg = getValueAtYear(ts.lng_tank_cost_per_kg, year);
      const lngCapacityKg = hasLargeLngTank(bucket.size) ? 990 * 0.35 : 450 * 0.35;
      const valves = getValueAtYear(ts.lng_valves_piping_per_vehicle, year);
      return dieselPrice + lngCapacityKg * lngTankCostPerKg + valves;
    }
    case 'BET': {
      // Excel row 130: diesel − engine/trans + ePT + battery
      //                + margin·(ePT + battery) − ZET BS-VII relief − incentive
      const dieselBase = dieselFamilyPrice(base.diesel_total, year, ts);
      const dieselPowertrain = base.engine_trans * getValueAtYear(ts.engine_trans_growth, year);
      const ePowertrain = base.e_powertrain * getValueAtYear(ts.e_powertrain_growth, year);
      const batteryCost = bucket.betBatteryKWh * getValueAtYear(ts.battery_cost_per_kwh, year);
      const oem = BET_OEM_MARGIN_BY_YEAR[Math.min(year, 2055)] ?? 0.25;
      const price = dieselBase - dieselPowertrain + ePowertrain + batteryCost
        + oem * (ePowertrain + batteryCost)
        - zetBsviiRelief(year);
      const betIncentivePerKwh = year <= policy.bet_incentive_phase1_end_year
        ? policy.bet_demand_incentive_per_kwh
        : year <= policy.bet_incentive_phase2_end_year
          ? policy.bet_demand_incentive_phase2_per_kwh
          : 0;
      const incentive = betIncentivePerKwh * bucket.betBatteryKWh;
      return Math.max(0, price - incentive);
    }
    case 'H2-ICE': {
      const dieselPrice = dieselFamilyPrice(base.diesel_total, year, ts);
      const h2TankCost = bucket.h2TankKg * getValueAtYear(ts.h2_tank_cost_per_kg, year);
      return dieselPrice + h2TankCost;
    }
    case 'H2-FCET': {
      // Excel row 143: diesel − engine/trans + ePT + FCET battery + fuel cell + H2 tank
      //                + margin·(ePT + FCET battery + fuel cell) − ZET BS-VII relief − incentive
      const dieselBase = dieselFamilyPrice(base.diesel_total, year, ts);
      const dieselPowertrain = base.engine_trans * getValueAtYear(ts.engine_trans_growth, year);
      const ePowertrain = base.e_powertrain * getValueAtYear(ts.e_powertrain_growth, year);
      const fcCost = bucket.fcetFuelCellKW * getValueAtYear(ts.fuel_cell_cost_per_kw, year);
      const batteryCost = bucket.fcetBatteryKWh * getValueAtYear(ts.battery_cost_per_kwh, year);
      const h2TankCost = bucket.h2TankKg * getValueAtYear(ts.h2_tank_cost_per_kg, year);
      const oem = FCET_OEM_MARGIN_BY_YEAR[Math.min(year, 2055)] ?? 0.35;
      const price = dieselBase - dieselPowertrain + ePowertrain + fcCost + batteryCost + h2TankCost
        + oem * (ePowertrain + batteryCost + fcCost)
        - zetBsviiRelief(year);
      const fcetIncentivePerKwh = year <= policy.fcet_incentive_phase1_end_year
        ? policy.fcet_demand_incentive_per_kwh
        : year <= policy.fcet_incentive_phase2_end_year
          ? policy.fcet_demand_incentive_phase2_per_kwh
          : 0;
      const incentive = fcetIncentivePerKwh * bucket.fcetBatteryKWh;
      return Math.max(0, price - incentive);
    }
    default:
      return 0;
  }
}

function computeFuelCostPerKm(
  pt: Powertrain,
  bucket: Bucket,
  year: number,
  ts: Record<ParameterKey, number[]>,
  policy: PolicyConfig,
  fixed: FixedParameters,
): number {
  switch (pt) {
    case 'Diesel': {
      const dieselPrice = getValueAtYear(ts.diesel_price_per_l, year);
      const adbluePrice = getValueAtYear(ts.adblue_per_l, year);
      return dieselPrice / bucket.dieselKMPL
        + adbluePrice * fixed.adblue_consumption_l_per_l_diesel / bucket.dieselKMPL;
    }
    case 'CNG':
      return getValueAtYear(ts.cng_price_per_kg, year) / bucket.cngKmPerKg;
    case 'LNG':
      return getValueAtYear(ts.lng_price_per_kg, year) / bucket.lngKmPerKg;
    case 'BET': {
      const subsidy = year <= policy.electricity_subsidy_end_year ? policy.electricity_subsidy_per_kwh : 0;
      // Use Electricity incl CAAS as the BET energy price (v9 spec).
      const elecPrice = getValueAtYear(ts.electricity_incl_caas_per_kwh, year) - subsidy;
      return Math.max(0, elecPrice) * bucket.betKwhPerKm;
    }
    case 'H2-ICE':
      return getH2PricePerKg(ts, policy, year) / bucket.h2iceKmPerKg;
    case 'H2-FCET':
      return getH2PricePerKg(ts, policy, year) / bucket.fcetKmPerKg;
    default:
      return 0;
  }
}

// Diesel/BET/FCET maintenance is user-editable per bucket; when an edited
// config exists it drives the engine, else the baseline (== Excel) is used.
const MAINT_METRIC_BY_PT: Partial<Record<Powertrain, MaintMetric>> = {
  Diesel: 'diesel',
  BET: 'bet',
  'H2-FCET': 'fcet',
};

// ── Key Aggregate Life → maintenance link (Excel 'No change with year') ──
// Battery replacement ₹/km at 2026 for a given battery life (cols BP–BV):
//   cycles-in-7yr (BT) = annualKm·7·kWh/km / batteryKWh
//   replacements (BU)  = MIN(BT / life, 1)
//   ₹/km (BV)          = batteryKWh·BATT_REPL_COST_PER_KWH · BU / (annualKm·7)
function batteryReplPerKm2026(bucket: Bucket, lifeCycles: number): number {
  const km7 = bucket.annualKm * 7;
  if (km7 <= 0 || lifeCycles <= 0) return 0;
  const cycles7 = (km7 * bucket.betKwhPerKm) / bucket.betBatteryKWh;
  const replacements = Math.min(cycles7 / lifeCycles, 1);
  return (bucket.betBatteryKWh * BATT_REPL_COST_PER_KWH * replacements) / km7;
}

// Fuel-cell replacement ₹/km at 2026 for a given FC life (cols CC–CG):
//   fcLifeYears (CF) = MIN(fc_life_hrs / (workingDays·engineHrs/day), 10)
//   ₹/km (CG)        = ROUND(kW·FC_REPL_COST_PER_KW / (annualKm·fcLifeYears), 1)
function fcReplPerKm2026(bucket: Bucket, lifeHours: number): number {
  const hrsPerDay = BUCKET_ENGINE_HRS_PER_DAY[bucket.id] ?? 9;
  const denom = bucket.workingDays * hrsPerDay;
  if (denom <= 0 || lifeHours <= 0 || bucket.annualKm <= 0) return 0;
  const fcLifeYears = Math.min(lifeHours / denom, FC_LIFE_MAX_YEARS);
  const fcCost = bucket.fcetFuelCellKW * FC_REPL_COST_PER_KW;
  return Math.round((fcCost / (bucket.annualKm * fcLifeYears)) * 10) / 10;
}

function getMaintenancePerKm(
  pt: Powertrain,
  bucket: Bucket,
  year: number,
  fixed?: FixedParameters,
): number {
  const metric = MAINT_METRIC_BY_PT[pt];
  if (metric) {
    const cfg = fixed?.bucket_maintenance?.[metric]?.[bucket.id]
      ?? defaultMaintConfig(metric, bucket);
    const series = buildSeriesFromConfig(cfg);
    const base = getValueAtYear(series, year);

    // Key Aggregate Life delta — only BET/FCET maintenance carries battery /
    // fuel-cell replacement. The delta is the change vs the calibration's
    // default-life replacement cost (so it is exactly 0 at default life), grown
    // proportionally with the maintenance line it lives in.
    const battLife = fixed?.battery_life_cycles ?? DEFAULT_BATTERY_LIFE_CYCLES;
    const fcLife = fixed?.fuel_cell_life_hours ?? DEFAULT_FUEL_CELL_LIFE_HOURS;
    let delta2026 = 0;
    if (metric === 'bet' && battLife !== DEFAULT_BATTERY_LIFE_CYCLES) {
      delta2026 = batteryReplPerKm2026(bucket, battLife)
        - batteryReplPerKm2026(bucket, DEFAULT_BATTERY_LIFE_CYCLES);
    } else if (metric === 'fcet') {
      // FCET carries a (battery-life-scaled) battery share + the FC share.
      const battDelta = battLife !== DEFAULT_BATTERY_LIFE_CYCLES
        ? (batteryReplPerKm2026(bucket, battLife)
            - batteryReplPerKm2026(bucket, DEFAULT_BATTERY_LIFE_CYCLES))
          * (bucket.fcetBatteryKWh / bucket.betBatteryKWh)
        : 0;
      const fcDelta = fcLife !== DEFAULT_FUEL_CELL_LIFE_HOURS
        ? fcReplPerKm2026(bucket, fcLife)
          - fcReplPerKm2026(bucket, DEFAULT_FUEL_CELL_LIFE_HOURS)
        : 0;
      delta2026 = battDelta + fcDelta;
    }
    if (delta2026 !== 0) {
      const base2026 = series[0];
      const growth = base2026 > 0 ? base / base2026 : 1;
      return base + delta2026 * growth;
    }
    return base;
  }
  // CNG/LNG/H2-ICE: uniform 4%/yr, not user-editable. Base is the 2026 value.
  const dy = year - 2026;
  return bucket.maintCngLngH2icePerKm * Math.pow(1 + MAINT_OTHER_ICE_CAGR, dy);
}

function isZET(pt: Powertrain): boolean {
  return pt === 'BET' || pt === 'H2-FCET';
}

export function computeTCO(
  ts: Record<ParameterKey, number[]>,
  policy: PolicyConfig,
  buckets: Bucket[],
  targetYear: number,
  fixed?: FixedParameters,
  segmentBasePrices?: SegmentBasePrices,
): BucketTCOMap {
  // Fallback defaults so module is usable in tests/scripts without full config
  const fp: FixedParameters = fixed ?? {
    interest_rate_ice: FINANCE.diesel_cng_lng_h2ice_interest_pa_default,
    insurance_rate_per_year: FINANCE.insurance_rate_per_year,
    adblue_consumption_l_per_l_diesel: 0.05,
    battery_energy_density_kg_per_kwh: 8,
    fuel_cell_power_density_kg_per_kw: 4,
    battery_life_cycles: DEFAULT_BATTERY_LIFE_CYCLES,
    fuel_cell_life_hours: DEFAULT_FUEL_CELL_LIFE_HOURS,
    tat_gradeability: { Diesel: 1, CNG: 0.95, LNG: 0.95, BET: 1.15, 'H2-ICE': 0.95, 'H2-FCET': 1.15 },
    range_filling_time: { Diesel: 1, CNG: 1.05, LNG: 1.10, BET: 1.20, 'H2-ICE': 1, 'H2-FCET': 1 },
  };
  const sbp: SegmentBasePrices = segmentBasePrices ?? (VEHICLE_BASE_PRICES_2026 as SegmentBasePrices);

  const result: BucketTCOMap = {};

  for (const bucket of buckets) {
    const ptResults = {} as Record<Powertrain, TCOResult>;
    const cal = BUCKET_OPEX_CALIBRATION[bucket.id];
    const tollPerYear = growFromPair(cal.tollPerYear, targetYear);
    const tollPerKm = tollPerYear / bucket.annualKm;

    for (const pt of POWERTRAINS) {
      const price = computeVehiclePrice(pt, bucket, targetYear, ts, policy, sbp);

      const profile = BUCKET_RESALE_PROFILE[bucket.id] ?? 'general';
      const tier = resaleTier(targetYear);
      let resalePct = RESALE_VALUES[profile][pt][tier];
      if (pt === 'BET' && targetYear >= 2046 && policy.bet_resale_2046_plus > 0) {
        resalePct = policy.bet_resale_2046_plus;
      }
      const resale = price * resalePct;

      const rate = isZET(pt) ? policy.interest_rate_zet : fp.interest_rate_ice;
      const tenure = isZET(pt)
        ? policy.loan_tenure_years
        : (fp.loan_tenure_years_nonzet ?? policy.loan_tenure_years);
      // Excel CAPEX/annum is a full-price annuity: price·r/(1−(1+r)^−n)
      const financedTotal = rate > 0
        ? price * rate * tenure / (1 - Math.pow(1 + rate, -tenure))
        : price;
      const insurance = price * fp.insurance_rate_per_year * FINANCE.useful_life_years;

      const capex = financedTotal - resale + insurance;

      const fuelPerKm = computeFuelCostPerKm(pt, bucket, targetYear, ts, policy, fp);
      const maintPerKm = getMaintenancePerKm(pt, bucket, targetYear, fp);

      let effectiveToll = tollPerKm;
      if (isZET(pt)) {
        const life = FINANCE.useful_life_years;
        const p1 = Math.min(policy.toll_waiver_first_period_years, life);
        const p2 = Math.min(policy.toll_waiver_second_period_years, life - p1);
        const p3 = Math.max(0, life - p1 - p2);
        const waiverAvg = (p1 * policy.toll_waiver_pct_first_5y
          + p2 * policy.toll_waiver_pct_next_5y
          + p3 * 0) / life;
        effectiveToll = tollPerKm * (1 - waiverAvg);
      }

      const manpowerPair = (pt === 'BET' || pt === 'H2-FCET') ? cal.manpowerZet
        : (pt === 'CNG' && cal.manpowerCng) ? cal.manpowerCng
        : cal.manpowerIce;
      const manpowerPerYear = growFromPair(manpowerPair, targetYear);
      const manpowerPerKm = manpowerPerYear / bucket.annualKm;

      const opexPerKm = fuelPerKm + maintPerKm + effectiveToll + manpowerPerKm;
      const totalOpex = opexPerKm * bucket.annualKm * FINANCE.useful_life_years;
      const totalCost = capex + totalOpex;
      const tcoPerKm = totalCost / (bucket.annualKm * FINANCE.useful_life_years);
      const capexPerKm = capex / (bucket.annualKm * FINANCE.useful_life_years);

      ptResults[pt] = {
        tcoPerKm, vehiclePrice: price, totalCost,
        capexPerKm, opexPerKm, fuelCostPerKm: fuelPerKm,
        maintPerKm, manpowerPerKm, tollPerKm: effectiveToll, resalePct,
      };
    }
    result[bucket.id] = ptResults;
  }

  return result;
}
