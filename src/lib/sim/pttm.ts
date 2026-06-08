/**
 * PTTM — Powertrain Transition Trajectory Model
 * Gompertz (with quadratic correction) for BET/H2-ICE/H2-FCET,
 * Weibull (with 2025 anchor injection) for CNG/LNG.
 * Runs per-bucket, aggregates final sales.
 */
import type { Powertrain, Bucket, VehicleSize } from '@/lib/constants/extracted';
import {
  POWERTRAINS,
  BUCKETS,
  TIV_PROJECTION,
  START_OF_SUPPLY,
  PTTM_PILOT_SHARE,
  WEIBULL_SHAPE_ALPHA,
  WEIBULL_PEAK_YEAR,
  CNG_UNITS_2025,
  LNG_UNITS_2025,
  OTHER_DIESEL_TIV_SHARE,
} from '@/lib/constants/extracted';
import type { PolicyConfig } from '@/lib/types';
import type { BucketShares } from './choiceModel';
import { START_YEAR, END_YEAR, YEAR_COUNT } from './timeSeries';

export interface AnnualPTSales {
  share: Record<Powertrain, number>;
  sales: Record<Powertrain, number>;
  // Per-bucket share (used downstream for segment / application breakdowns)
  sharesByBucket: Record<string, Record<Powertrain, number>>;
}

/**
 * Gompertz with quadratic correction — hits both Z (2045) and AB (2055) exactly.
 * Used for BET, H2-ICE, H2-FCET.
 */
function gompertzShare(args: {
  year: number;
  startYear: number;
  inflectionYear: number;
  pilotShare: number;
  share2045: number;
  share2055: number;
}): number {
  const { year, startYear, inflectionYear, pilotShare, share2045, share2055 } = args;

  if (year < startYear) return 0;
  if (share2055 <= 0) return 0;

  const aInitial = share2055;
  const W = pilotShare;
  const b = Math.log(Math.max(aInitial, W * 1.01) / W);
  const inflDelta = Math.max(inflectionYear - startYear, 1);
  const c = -(1 / inflDelta) *
            Math.log(Math.log(Math.max(aInitial, 0.1001) / 0.1) / b);
  const endDelta = 2055 - startYear;
  const a = share2055 / Math.exp(-b * Math.exp(-c * endDelta));

  const normDenom = Math.exp(-b * Math.exp(-c * endDelta));

  // Main Gompertz term (passes through AB at 2055)
  const gompertzMain = (a * Math.exp(-b * Math.exp(-c * (year - startYear)))) / normDenom;

  // Quadratic correction to force curve through Z at 2045
  let correction = 0;
  if (year > inflectionYear && year < 2055) {
    const gompertzAt2045 = (a * Math.exp(-b * Math.exp(-c * (2045 - startYear)))) / normDenom;
    const correctionCoef = (share2045 - gompertzAt2045) /
                           ((2045 - inflectionYear) * (2055 - 2045));
    correction = correctionCoef * (year - inflectionYear) * (2055 - year);
  }

  return gompertzMain + correction;
}

/**
 * Weibull with 2025 anchor injection and phase-out.
 * Used for CNG, LNG.
 */
function weibullShare(args: {
  year: number;
  startYear: number;
  peakYear: number;
  alpha: number;
  peakShare2045: number;
  units2025: number;
  tiv2025: number;
}): number {
  const { year, startYear, peakYear, alpha, peakShare2045, units2025, tiv2025 } = args;

  if (year < startYear) return 0;
  if (peakShare2045 <= 0) return 0;

  const peakDelta = peakYear - startYear;
  if (peakDelta <= 0) return 0;

  // Weibull kernel at any year
  const wbl = (y: number) => {
    const t = (y - startYear) / peakDelta;
    if (t <= 0) return 0;
    return Math.pow(t, alpha - 1) * Math.exp(((alpha - 1) / alpha) * (1 - Math.pow(t, alpha)));
  };

  // Normalization: peak at 2045 = peakShare2045
  const wbl2045 = wbl(2045);
  const norm = wbl2045 > 0 ? peakShare2045 / wbl2045 : peakShare2045;

  // Quadratic decay for 2025 anchor injection
  const decay = Math.max(0, 1 - Math.pow((year - 2025) / 20, 2));

  // Phase-out: linear decline from 2045 to 2055
  const phaseOut = Math.max(0, Math.min(1, (2055 - year) / 10));

  // Anchor share from real 2025 units
  const anchorShare2025 = units2025 / tiv2025;

  // Main curve - subtract 2025 position + add real anchor (decaying)
  const main = norm * (wbl(year) - wbl(2025) * decay);
  const anchorTerm = anchorShare2025 * decay;

  return Math.max(0, (main + anchorTerm) * phaseOut);
}

const GOMPERTZ_PTS: Powertrain[] = ['BET', 'H2-ICE', 'H2-FCET'];
const WEIBULL_PTS: ('CNG' | 'LNG')[] = ['CNG', 'LNG'];

export function computePTTM(
  shares2045: BucketShares,
  shares2055: BucketShares,
  policy: PolicyConfig,
  buckets: Bucket[] = BUCKETS,
): AnnualPTSales[] {
  const annual: AnnualPTSales[] = [];
  for (let i = 0; i < YEAR_COUNT; i++) {
    const sharesByBucket: Record<string, Record<Powertrain, number>> = {};
    for (const b of buckets) {
      sharesByBucket[b.id] = { Diesel: 0, CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0 };
    }
    annual.push({
      share: { Diesel: 0, CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0 },
      sales: { Diesel: 0, CNG: 0, LNG: 0, BET: 0, 'H2-ICE': 0, 'H2-FCET': 0 },
      sharesByBucket,
    });
  }

  const inflectionYears: Record<string, number> = {
    'BET': policy.bet_inflection_year,
    'H2-ICE': policy.h2ice_inflection_year,
    'H2-FCET': policy.fcet_inflection_year,
  };

  const tiv2025 = TIV_PROJECTION[2025] ?? 267370;
  const units2025Map: Record<string, number> = {
    'CNG': CNG_UNITS_2025,
    'LNG': LNG_UNITS_2025,
  };

  // Run per bucket, accumulate weighted shares
  for (const bucket of buckets) {
    const size = bucket.size as VehicleSize;
    const weight = bucket.tivShare2045;

    // Gompertz PTs
    for (const pt of GOMPERTZ_PTS) {
      const startYear = START_OF_SUPPLY[size]?.[pt] ?? 2025;
      const W = PTTM_PILOT_SHARE[pt as keyof typeof PTTM_PILOT_SHARE] ?? 0.0001;
      const AB = shares2055[bucket.id]?.[pt] ?? 0;
      const Z = shares2045[bucket.id]?.[pt] ?? 0;
      const inflYear = inflectionYears[pt] ?? 2038;

      for (let i = 0; i < YEAR_COUNT; i++) {
        const year = START_YEAR + i;
        const val = gompertzShare({
          year,
          startYear,
          inflectionYear: inflYear,
          pilotShare: W,
          share2045: Z,
          share2055: AB,
        });
        annual[i].share[pt] += val * weight;
      }
    }

    // Weibull PTs
    for (const pt of WEIBULL_PTS) {
      const startYear = START_OF_SUPPLY[size]?.[pt] ?? 2025;
      const peakShare = shares2045[bucket.id]?.[pt] ?? 0;

      for (let i = 0; i < YEAR_COUNT; i++) {
        const year = START_YEAR + i;
        const val = weibullShare({
          year,
          startYear,
          peakYear: WEIBULL_PEAK_YEAR,
          alpha: WEIBULL_SHAPE_ALPHA,
          peakShare2045: peakShare,
          units2025: units2025Map[pt] ?? 0,
          tiv2025,
        });
        annual[i].share[pt] += val * weight;
      }
    }
  }

  // Post-processing: cap non-diesel, compute diesel as residual
  for (let i = 0; i < YEAR_COUNT; i++) {
    const year = START_YEAR + i;
    const tiv = TIV_PROJECTION[year] ?? 0;
    const s = annual[i].share;

    const nonDieselSum = s.CNG + s.LNG + s.BET + s['H2-ICE'] + s['H2-FCET'];
    if (nonDieselSum > 1.0) {
      const scale = 1.0 / nonDieselSum;
      for (const pt of [...GOMPERTZ_PTS, ...WEIBULL_PTS] as Powertrain[]) {
        s[pt] *= scale;
      }
    }
    s.Diesel = Math.max(0, 1 - (s.CNG + s.LNG + s.BET + s['H2-ICE'] + s['H2-FCET']));

    // Sales = share × TIV; diesel also gets OTHER_DIESEL_TIV_SHARE
    for (const pt of POWERTRAINS) {
      annual[i].sales[pt] = s[pt] * tiv;
    }
    // Removed: was double-counting diesel (residual share already includes all diesel)
  }

  return annual;
}
