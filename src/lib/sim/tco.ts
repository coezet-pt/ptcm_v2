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
  BUCKET_OPEX_CALIBRATION,
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

// ── CNG tank cost — per-vehicle at 2025; folded into the base price which
// grows with the diesel growth rate (Excel 'Changing with year' rows 92-100) ──
const CNG_TANK_BASE_SMALL = 150000;
const CNG_TANK_BASE_LARGE = 250000;

// ZETs bear only half the BS-VII bump: Excel subtracts (400k−200k)·(1+3%)
// from BET/FCET prices from 2030 onward ('Changing with year' rows 130/143).
const ZET_BSVII_RELIEF_2030 = 200000;
const ZET_BSVII_RELIEF_2031_PLUS = 206000; // 200000 × 1.03

// Diesel & CNG/LNG/H2-ICE maintenance growth (uniform 4%/yr across all
// bucket sheets); BET/FCET maintenance, toll, and manpower use per-bucket
// [2025, 2045] pairs from BUCKET_OPEX_CALIBRATION.
const MAINT_DIESEL_CAGR     = 0.04;
const MAINT_OTHER_ICE_CAGR  = 0.04;

/** Interpolate/extrapolate a [2025, 2045] pair with its implied CAGR. */
function growFromPair(pair: [number, number], year: number): number {
  const [v25, v45] = pair;
  if (v25 <= 0) return v25;
  return v25 * Math.pow(v45 / v25, (year - 2025) / 20);
}

/** Piecewise-CAGR interpolation across [2025, 2045, 2050, 2055] knots. */
function growFromKnots(knots: [number, number, number, number], year: number): number {
  const [v25, v45, v50, v55] = knots;
  if (year <= 2045) return growFromPair([v25, v45], year);
  if (year <= 2050) return v45 * Math.pow(v50 / v45, (year - 2045) / 5);
  return v50 * Math.pow(v55 / v50, (year - 2050) / 5);
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

/**
 * Diesel-family price trajectory — Excel 'Changing with year' rows 81-100:
 * base grows with ts.diesel_vehicle_growth (cumulative multiplier, 3%/yr BAU);
 * the BS-VII bump lands in 2030 and compounds with the same rate thereafter.
 */
function dieselFamilyPrice(
  base2025: number,
  year: number,
  ts: Record<ParameterKey, number[]>,
): number {
  const g = getValueAtYear(ts.diesel_vehicle_growth, year);
  const g2030 = getValueAtYear(ts.diesel_vehicle_growth, 2030);
  const bump = year >= 2030 && g2030 > 0 ? BS_VII_PRICE_BUMP_2030 * (g / g2030) : 0;
  return base2025 * g + bump;
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
  const base = segmentBasePrices[bucket.size] ?? VEHICLE_BASE_PRICES_2025[bucket.size];

  switch (pt) {
    case 'Diesel':
      return dieselFamilyPrice(base.diesel_total, year, ts);
    case 'CNG': {
      // CNG = diesel 2025 base + tank, all growing with the diesel rate
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

function getMaintenancePerKm(pt: Powertrain, bucket: Bucket, year: number): number {
  const dy = year - 2025;
  const cal = BUCKET_OPEX_CALIBRATION[bucket.id];
  if (pt === 'Diesel') return bucket.maintDieselPerKm * Math.pow(1 + MAINT_DIESEL_CAGR, dy);
  if (pt === 'BET')    return growFromKnots(cal.maintBET, year);
  if (pt === 'H2-FCET') return growFromKnots(cal.maintFCET, year);
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
      const tenure = policy.loan_tenure_years;
      // Excel CAPEX/annum is a full-price annuity: price·r/(1−(1+r)^−n)
      const financedTotal = rate > 0
        ? price * rate * tenure / (1 - Math.pow(1 + rate, -tenure))
        : price;
      const insurance = price * fp.insurance_rate_per_year * FINANCE.useful_life_years;

      const capex = financedTotal - resale + insurance;

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
