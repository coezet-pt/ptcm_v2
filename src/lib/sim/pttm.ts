/**
 * PTTM — Powertrain Transition Trajectory Model
 * Mirrors the Excel 'PTTM' sheet piecewise curves exactly:
 *  - BET / H2-ICE / H2-FCET (Gompertz family):
 *      year < pilot                     → 0
 *      pilot ≤ year ≤ inflection        → a·e^(−b·e^(−c·(year−pilot)))
 *      inflection < year ≤ 2045         → cosine ramp 0.05 → Z2045
 *      2045 < year ≤ 2050               → linear Z2045 → Z2050
 *      2050 < year ≤ 2055               → linear Z2050 → Z2055
 *    with b = ln(a/W), c calibrated to hit 3% at the inflection year, and
 *    (BET only) a iteratively normalized so the Gompertz passes Z2055 at 2055.
 *  - CNG / LNG (Weibull family):
 *      year < pilot                     → 0
 *      pilot ≤ year ≤ 2045              → share2026 + (Z2045−share2026)·wbl(year)/wbl(2045)
 *      2045 < year ≤ 2050               → linear Z2045 → Z2050
 *      2050 < year ≤ 2055               → cosine decay Z2050 → 0
 *
 * Curves run per-bucket; since every post-inflection branch is linear in the
 * bucket anchors, the TIV-weighted aggregate equals Excel's global curve.
 */
import type { Powertrain, Bucket } from '@/lib/constants/extracted';
import {
  POWERTRAINS,
  BUCKETS,
  TIV_PROJECTION,
  GOMPERTZ_PARAMS_BY_PT,
  WEIBULL_SHAPE_ALPHA,
  WEIBULL_PEAK_YEAR,
  CNG_UNITS_2026,
  LNG_UNITS_2026,
} from '@/lib/constants/extracted';
import type { PolicyConfig } from '@/lib/types';
import type { BucketShares } from './choiceModel';
import { START_YEAR, YEAR_COUNT } from './timeSeries';

export interface AnnualPTSales {
  share: Record<Powertrain, number>;
  sales: Record<Powertrain, number>;
  // Per-bucket share (used downstream for segment / application breakdowns)
  sharesByBucket: Record<string, Record<Powertrain, number>>;
}

/**
 * Derive Gompertz a/b/c the way the Excel PTTM sheet does (cols T/W/X):
 *   b = LN(MAX(a, W·1.01) / W)
 *   c = −(1/(infl−pilot)) · LN( LN(MAX(a, 0.0501)/0.03) / b )
 * For BET, a is additionally normalized (Excel col Z, circular reference
 * resolved iteratively) so the raw Gompertz passes through z2055 at 2055.
 * For H2-ICE / H2-FCET the Excel uses a = z2055 directly.
 */
function deriveGompertzParams(
  z2055: number,
  W: number,
  pilotYear: number,
  inflectionYear: number,
  normalizeTo2055: boolean,
): { a: number; b: number; c: number } {
  const inflDelta = Math.max(inflectionYear - pilotYear, 1);
  let a = z2055;
  let b = 0;
  let c = 0;
  for (let iter = 0; iter < 50; iter++) {
    b = Math.log(Math.max(a, W * 1.01) / W);
    c = -(1 / inflDelta) * Math.log(Math.log(Math.max(a, 0.0501) / 0.03) / b);
    if (!normalizeTo2055) break;
    const next = z2055 / Math.exp(-b * Math.exp(-c * (2055 - pilotYear)));
    if (Math.abs(next - a) < 1e-12) break;
    a = next;
  }
  return { a, b, c };
}

/** Piecewise Gompertz/cosine/linear share — Excel PTTM cols C/E/G. */
function gompertzShare(args: {
  year: number;
  pilotYear: number;
  inflectionYear: number;
  a: number;
  b: number;
  c: number;
  z2045: number;
  z2050: number;
  z2055: number;
}): number {
  const { year, pilotYear, inflectionYear, a, b, c, z2045, z2050, z2055 } = args;
  if (year < pilotYear) return 0;
  if (year <= inflectionYear) {
    if (a <= 0) return 0;
    return a * Math.exp(-b * Math.exp(-c * (year - pilotYear)));
  }
  if (year <= 2045) {
    const denom = Math.max(2045 - inflectionYear, 1);
    return 0.05 + (z2045 - 0.05) * (1 - Math.cos(Math.PI * (year - inflectionYear) / denom)) / 2;
  }
  if (year <= 2050) return z2045 + (z2050 - z2045) * (year - 2045) / 5;
  if (year <= 2055) return z2050 + (z2055 - z2050) * (year - 2050) / 5;
  return z2055;
}

/** Piecewise Weibull/linear/cosine-decay share — Excel PTTM cols J/L. */
function weibullShare(args: {
  year: number;
  pilotYear: number;
  peakYear: number;
  alpha: number;
  share2026: number;
  z2045: number;
  z2050: number;
}): number {
  const { year, pilotYear, peakYear, alpha, share2026, z2045, z2050 } = args;
  if (year < pilotYear) return 0;
  if (year <= 2045) {
    const peakDelta = Math.max(peakYear - pilotYear, 1);
    const wbl = (y: number) => {
      const t = (y - pilotYear) / peakDelta;
      if (t <= 0) return 0;
      return Math.pow(t, alpha - 1) * Math.exp(((alpha - 1) / alpha) * (1 - Math.pow(t, alpha)));
    };
    const w45 = wbl(2045);
    return share2026 + (z2045 - share2026) * (w45 > 0 ? wbl(year) / w45 : 0);
  }
  if (year <= 2050) return z2045 + (z2050 - z2045) * (year - 2045) / 5;
  return Math.max(0, z2050 * (1 + Math.cos(Math.PI * (year - 2050) / 5)) / 2);
}

const GOMPERTZ_PTS: ('BET' | 'H2-ICE' | 'H2-FCET')[] = ['BET', 'H2-ICE', 'H2-FCET'];
const WEIBULL_PTS: ('CNG' | 'LNG')[] = ['CNG', 'LNG'];

export function computePTTM(
  shares2045: BucketShares,
  shares2050: BucketShares,
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

  // Aggregate (TIV-weighted) anchors — the Excel PTTM sheet operates globally.
  const aggregate = (m: BucketShares): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const b of buckets) {
      for (const pt of POWERTRAINS) {
        out[pt] = (out[pt] ?? 0) + (m[b.id]?.[pt] ?? 0) * b.tivShare2045;
      }
    }
    return out;
  };
  const z2055Agg = aggregate(shares2055);

  // Global Gompertz parameters per powertrain, derived as in Excel.
  const gompertzParams: Record<string, { a: number; b: number; c: number }> = {};
  for (const pt of GOMPERTZ_PTS) {
    const meta = GOMPERTZ_PARAMS_BY_PT[pt];
    gompertzParams[pt] = deriveGompertzParams(
      z2055Agg[pt] ?? 0,
      meta.W,
      meta.startYear,
      inflectionYears[pt] ?? 2038,
      pt === 'BET',
    );
  }

  const tiv2026 = TIV_PROJECTION[2026] ?? 301120;
  const share2026Map: Record<string, number> = {
    'CNG': CNG_UNITS_2026 / tiv2026,
    'LNG': LNG_UNITS_2026 / tiv2026,
  };

  // Run per bucket, accumulate weighted shares
  for (const bucket of buckets) {
    const weight = bucket.tivShare2045;

    for (const pt of GOMPERTZ_PTS) {
      const meta = GOMPERTZ_PARAMS_BY_PT[pt];
      const params = gompertzParams[pt];
      const inflYear = inflectionYears[pt] ?? 2038;
      const z2045 = shares2045[bucket.id]?.[pt] ?? 0;
      const z2050 = shares2050[bucket.id]?.[pt] ?? 0;
      const z2055 = shares2055[bucket.id]?.[pt] ?? 0;

      for (let i = 0; i < YEAR_COUNT; i++) {
        const year = START_YEAR + i;
        const val = gompertzShare({
          year,
          pilotYear: meta.startYear,
          inflectionYear: inflYear,
          a: params.a,
          b: params.b,
          c: params.c,
          z2045,
          z2050,
          z2055,
        });
        annual[i].share[pt] += val * weight;
        annual[i].sharesByBucket[bucket.id][pt] = val;
      }
    }

    for (const pt of WEIBULL_PTS) {
      const z2045 = shares2045[bucket.id]?.[pt] ?? 0;
      const z2050 = shares2050[bucket.id]?.[pt] ?? 0;

      for (let i = 0; i < YEAR_COUNT; i++) {
        const year = START_YEAR + i;
        const val = weibullShare({
          year,
          pilotYear: 2026, // CNG/LNG are mature; pilot is the projection base year (2026)
          peakYear: WEIBULL_PEAK_YEAR,
          alpha: WEIBULL_SHAPE_ALPHA,
          share2026: share2026Map[pt] ?? 0,
          z2045,
          z2050,
        });
        annual[i].share[pt] += val * weight;
        annual[i].sharesByBucket[bucket.id][pt] = val;
      }
    }

    // Per-bucket residual diesel (so per-bucket sales sum cleanly)
    for (let i = 0; i < YEAR_COUNT; i++) {
      const sb = annual[i].sharesByBucket[bucket.id];
      const nonD = sb.CNG + sb.LNG + sb.BET + sb['H2-ICE'] + sb['H2-FCET'];
      if (nonD > 1) {
        const scl = 1 / nonD;
        sb.CNG *= scl; sb.LNG *= scl; sb.BET *= scl;
        sb['H2-ICE'] *= scl; sb['H2-FCET'] *= scl;
      }
      sb.Diesel = Math.max(0, 1 - (sb.CNG + sb.LNG + sb.BET + sb['H2-ICE'] + sb['H2-FCET']));
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

    for (const pt of POWERTRAINS) {
      annual[i].sales[pt] = s[pt] * tiv;
    }

  }

  return annual;
}
