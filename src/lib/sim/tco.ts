/**
 * TCO module — vehicle prices and 7-year total cost of ownership
 * per bucket × powertrain × target year.
 */
import type { ParameterKey, PolicyConfig, FixedParameters, SegmentBasePrices } from '@/lib/types';
import type { Powertrain, Bucket } from '@/lib/constants/extracted';
import {
  VEHICLE_BASE_PRICES_2025,
  BS_VII_PRICE_BUMP_2030,
  BET_OEM_MARGIN_BY_YEAR,
  FCET_OEM_MARGIN_BY_YEAR,
  RESALE_VALUES,
  BUCKET_RESALE_PROFILE,
  FINANCE,
  POWERTRAINS,
} from '@/lib/constants/extracted';
import { getValueAtYear } from './timeSeries';

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

// ── CNG tank cost — per-vehicle, NOT per-kg [fix #4] ──
const CNG_TANK_BASE_SMALL = 150000;
const CNG_TANK_BASE_LARGE = 250000;
const CNG_TANK_GROWTH = 0.01;

// Diesel vehicle price growth (v3 row 63: 2.75M → 5.59M over 20y = 3.61% CAGR).
// Drives Diesel/CNG/LNG/H2-ICE vehicle prices and the diesel-base portion of BET/FCET.
const DIESEL_PRICE_CAGR_MULT = 1 + 0.0361;

// Manpower (driver + crew) constants — back-solved from Excel B1
const MANPOWER_BASE_2025_DIESEL = 400000;
const MANPOWER_BASE_2025_BET    = 460000;
const MANPOWER_GROWTH = 0.04534;

// Toll — stored as ₹/year per vehicle (v3 rows 59-60: 572,400 → 698,437 over 20y, ~1% CAGR).
// Same for all powertrains. Per-km is derived by dividing by each bucket's annualKm.
const TOLL_BASE_PER_YEAR_2025 = 572_400;
const TOLL_CAGR = 0.01;

// Maintenance per km — escalates with year (v3 B1 rows 55-58, calibrated for Rigid 12-19T).
// Per-bucket values may differ; revisit once other-bucket TCO sheets are parsed.
const MAINT_DIESEL_CAGR     = 0.04;   // r55: 2.80 → 6.14
const MAINT_OTHER_ICE_CAGR  = 0.04;   // r56: 3.30 → 7.23 (CNG/LNG/H2-ICE)
const MAINT_BET_BASE_2025   = 5.12;   // r57 — incl. battery replacement
const MAINT_BET_CAGR        = 0.0131; // 5.12 → 6.64
const MAINT_FCET_BASE_2025  = 5.76;   // r58
const MAINT_FCET_CAGR       = 0.0103; // 5.76 → 7.08

function isSmallSize(size: string): boolean {
  return size.includes('15T') || size.includes('19T');
}

function resaleTier(year: number): 0 | 1 | 2 {
  if (year <= 2035) return 0;
  if (year <= 2045) return 1;
  return 2;
}

function getH2PricePerKg(
  ts: Record<ParameterKey, number[]>,
  policy: PolicyConfig,
  year: number,
): number {
  const green = getValueAtYear(ts.green_h2_production_per_kg, year);
  const grey = getValueAtYear(ts.grey_h2_production_per_kg, year);
  const compression = getValueAtYear(ts.h2_compression_storage_per_kg, year);
  const blend = Math.max(0, Math.min(1, getValueAtYear(ts.grey_h2_blend_fraction, year) ?? 0));

  let productionCost: number;
  if (blend > 0) {
    // Explicit blend override
    productionCost = (1 - blend) * green + blend * grey;
  } else {
    switch (policy.h2_source_mix) {
      case 'green_only':
        productionCost = green;
        break;
      case 'blend_2046_green':
        productionCost = year < 2046 ? (green + grey) / 2 : green;
        break;
      case 'cheapest':
        productionCost = Math.min(green, grey);
        break;
      default:
        productionCost = green;
    }
  }
  return productionCost + compression;
}

function computeVehiclePrice(
  pt: Powertrain,
  bucket: Bucket,
  year: number,
  ts: Record<ParameterKey, number[]>,
  policy: PolicyConfig,
  segmentBasePrices: SegmentBasePrices,
): number {
  const base = segmentBasePrices[bucket.size] ?? VEHICLE_BASE_PRICES_2025[bucket.size];
  const dy = year - 2025;

  switch (pt) {
    case 'Diesel': {
      const price = base.diesel_total * Math.pow(DIESEL_PRICE_CAGR_MULT, dy);
      return price + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
    }
    case 'CNG': {
      const dieselPrice = base.diesel_total * Math.pow(DIESEL_PRICE_CAGR_MULT, dy) + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
      const tankBase = isSmallSize(bucket.size) ? CNG_TANK_BASE_SMALL : CNG_TANK_BASE_LARGE;
      const tankCost = tankBase * Math.pow(1 + CNG_TANK_GROWTH, dy);
      return dieselPrice + tankCost;
    }
    case 'LNG': {
      const dieselPrice = base.diesel_total * Math.pow(DIESEL_PRICE_CAGR_MULT, dy) + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
      const lngTankCostPerKg = getValueAtYear(ts.lng_tank_cost_per_kg, year);
      const lngCapacityKg = isSmallSize(bucket.size) ? 450 * 0.35 : 990 * 0.35;
      const valves = getValueAtYear(ts.lng_valves_piping_per_vehicle, year);
      return dieselPrice + lngCapacityKg * lngTankCostPerKg + valves;
    }
    case 'BET': {
      const dieselBase = base.diesel_total * Math.pow(DIESEL_PRICE_CAGR_MULT, dy)
        + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
      const dieselPowertrain = base.engine_trans * getValueAtYear(ts.engine_trans_growth, year);
      const ePowertrain = base.e_powertrain * getValueAtYear(ts.e_powertrain_growth, year);
      const batteryCost = bucket.betBatteryKWh * getValueAtYear(ts.battery_cost_per_kwh, year);
      const oem = BET_OEM_MARGIN_BY_YEAR[Math.min(year, 2055)] ?? 0.25;
      const raw = dieselBase - dieselPowertrain + ePowertrain + batteryCost;
      const withMargin = raw * (1 + oem);
      const betIncentivePerKwh = year <= policy.bet_incentive_phase1_end_year
        ? policy.bet_demand_incentive_per_kwh
        : year <= policy.bet_incentive_phase2_end_year
          ? policy.bet_demand_incentive_phase2_per_kwh
          : 0;
      const incentive = betIncentivePerKwh * bucket.betBatteryKWh;
      return Math.max(0, withMargin - incentive);
    }
    case 'H2-ICE': {
      const dieselPrice = base.diesel_total * Math.pow(DIESEL_PRICE_CAGR_MULT, dy) + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
      const h2TankCost = bucket.h2TankKg * getValueAtYear(ts.h2_tank_cost_per_kg, year);
      return dieselPrice + h2TankCost;
    }
    case 'H2-FCET': {
      const dieselBase = base.diesel_total * Math.pow(DIESEL_PRICE_CAGR_MULT, dy)
        + (year >= 2030 ? BS_VII_PRICE_BUMP_2030 : 0);
      const dieselPowertrain = base.engine_trans * getValueAtYear(ts.engine_trans_growth, year);
      const ePowertrain = base.e_powertrain * getValueAtYear(ts.e_powertrain_growth, year);
      const fcCost = bucket.fcetFuelCellKW * getValueAtYear(ts.fuel_cell_cost_per_kw, year);
      const batteryCost = bucket.fcetBatteryKWh * getValueAtYear(ts.battery_cost_per_kwh, year);
      const h2TankCost = bucket.h2TankKg * getValueAtYear(ts.h2_tank_cost_per_kg, year);
      const oem = FCET_OEM_MARGIN_BY_YEAR[Math.min(year, 2055)] ?? 0.35;
      const raw = dieselBase - dieselPowertrain + ePowertrain + fcCost + batteryCost + h2TankCost;
      const withMargin = raw * (1 + oem);
      const fcetIncentivePerKwh = year <= policy.fcet_incentive_phase1_end_year
        ? policy.fcet_demand_incentive_per_kwh
        : year <= policy.fcet_incentive_phase2_end_year
          ? policy.fcet_demand_incentive_phase2_per_kwh
          : 0;
      const incentive = fcetIncentivePerKwh * bucket.fcetBatteryKWh;
      return Math.max(0, withMargin - incentive);
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

function getMaintenancePerKm(pt: Powertrain, bucket: Bucket, year: number): number {
  const dy = year - 2025;
  if (pt === 'Diesel') return bucket.maintDieselPerKm * Math.pow(1 + MAINT_DIESEL_CAGR, dy);
  if (pt === 'BET')    return MAINT_BET_BASE_2025  * Math.pow(1 + MAINT_BET_CAGR,  dy);
  if (pt === 'H2-FCET') return MAINT_FCET_BASE_2025 * Math.pow(1 + MAINT_FCET_CAGR, dy);
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
    battery_life_cycles: 3000,
    fuel_cell_life_hours: 25000,
    battery_energy_density_kg_per_kwh: 8,
    fuel_cell_power_density_kg_per_kw: 4,
    tat_gradeability: { Diesel: 1, CNG: 0.95, LNG: 0.95, BET: 1.15, 'H2-ICE': 0.95, 'H2-FCET': 1.15 },
    range_filling_time: { Diesel: 1, CNG: 1.05, LNG: 1.10, BET: 1.20, 'H2-ICE': 1, 'H2-FCET': 1 },
  };
  const sbp: SegmentBasePrices = segmentBasePrices ?? (VEHICLE_BASE_PRICES_2025 as SegmentBasePrices);

  const result: BucketTCOMap = {};

  for (const bucket of buckets) {
    const ptResults = {} as Record<Powertrain, TCOResult>;
    const dy = targetYear - 2025;
    const tollPerYear = TOLL_BASE_PER_YEAR_2025 * Math.pow(1 + TOLL_CAGR, dy);
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
      const tenure = policy.loan_tenure_years;
      const interest = price * rate * tenure / 2;
      const insurance = price * fp.insurance_rate_per_year * FINANCE.useful_life_years;

      const capex = price - resale + interest + insurance;

      const fuelPerKm = computeFuelCostPerKm(pt, bucket, targetYear, ts, policy, fp);
      const maintPerKm = getMaintenancePerKm(pt, bucket, targetYear);

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

      const baseManpower = (pt === 'BET' || pt === 'H2-FCET')
        ? MANPOWER_BASE_2025_BET
        : MANPOWER_BASE_2025_DIESEL;
      const manpowerPerYear = baseManpower * Math.pow(1 + MANPOWER_GROWTH, dy);
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
