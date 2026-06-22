// v3 - multiplier fix verified - 2026-04-15
/**
 * Choice model — multinomial logit for powertrain share targets
 * at 2045 and 2055. Returns PER-BUCKET shares.
 *
 * Formula per factor: EXP( elasticity_avg × 1.5 × (ratio - 1) )
 * Ratio direction varies by factor (see below).
 */
import type { Powertrain, Bucket, VehicleSize } from '@/lib/constants/extracted';
import type { FixedParameters, PolicyConfig } from '@/lib/types';
import {
  POWERTRAINS,
  POWERTRAIN_RATINGS,
  START_OF_SUPPLY,
  CHOICE_SHARE_ADJUSTMENT,
  BUCKET_CHOICE_ELASTICITIES,
} from '@/lib/constants/extracted';
import type { BucketTCOMap } from './tco';

// Excel 'No change with year' payload model (cols AX/AY/AZ): diesel payload is
// GVW − ULW; BET/FCET subtract battery (density × kWh) and fuel-cell
// (power-density × kW) weight, round to the nearest 100 kg, then add the
// regulator's GVW increase for ZETs (policy.gvw_payload_compensation_t).
// Map a bucket's size to a "GVW for ZET" policy-support class label. The user's
// 7-class table uses '35T Rigid' for the 35T tipper bucket; the 28T tipper has
// no class and therefore no additional GVW.
function zetGvwClassForBucket(bucket: Bucket): string | null {
  if (bucket.size === '35T Tipper') return '35T Rigid';
  if (bucket.size === '28T Tipper') return null;
  return bucket.size;
}

function computeBucketPayload(bucket: Bucket, fixed?: FixedParameters, policy?: PolicyConfig) {
  const density = fixed?.battery_energy_density_kg_per_kwh ?? 8;
  const fcPowerDensity = fixed?.fuel_cell_power_density_kg_per_kw ?? 4;
  // Additional GVW granted to ZETs: scalar tonnes compensation (legacy) plus
  // the per-class kg from the policy-support "GVW for ZET" table.
  const cls = zetGvwClassForBucket(bucket);
  const perClassKg = (cls && policy?.zet_additional_gvw_kg?.[cls]) || 0;
  const gvwCompKg = (policy?.gvw_payload_compensation_t ?? 0) * 1000 + perClassKg;
  const diesel = bucket.gvw - bucket.ulw;
  const bet = Math.round((diesel - density * bucket.betBatteryKWh) / 100) * 100 + gvwCompKg;
  const fcet = Math.round(
    (diesel - density * bucket.fcetBatteryKWh - fcPowerDensity * bucket.fcetFuelCellKW) / 100,
  ) * 100 + gvwCompKg;
  return { diesel, bet, fcet };
}

// Per-bucket, per-powertrain share
export type BucketShares = Record<string, Record<Powertrain, number>>;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Excel B-sheets: Diesel/CNG/LNG/H2-ICE share the diesel payload; only BET
// and FCET carry a payload penalty (rows 17-19 per sheet).
function payloadRatio(bucket: Bucket, pt: Powertrain, fixed?: FixedParameters, policy?: PolicyConfig): number {
  const pl = computeBucketPayload(bucket, fixed, policy);
  if (pl.diesel <= 0) return 1;
  if (pt === 'BET') return pl.bet / pl.diesel;
  if (pt === 'H2-FCET') return pl.fcet / pl.diesel;
  return 1;
}

export function computeShares(
  tcoResults: BucketTCOMap,
  buckets: Bucket[],
  targetYear: number,
  policy?: PolicyConfig,
  // Excel 'Estimation 100% ZET 2055': diesel/CNG/LNG are excluded from the
  // 2055 choice set, shares renormalize among BET / H2-ICE / H2-FCET only.
  zetOnly = false,
  fixed?: FixedParameters,
): BucketShares {
  const result: BucketShares = {};

  // Editable powertrain ratings; default to the Excel constants when unset.
  const tatRatings = fixed?.tat_gradeability ?? POWERTRAIN_RATINGS.tatGradeability;
  const rangeRatings = fixed?.range_filling_time ?? POWERTRAIN_RATINGS.rangeFillingTime;

  for (const bucket of buckets) {
    const tco = tcoResults[bucket.id];
    if (!tco) continue;

    // Excel quirk: the Input Sheet "2055 Diesel VE" cells for B9 and B11
    // reference the LNG TCO row (AG167) instead of Diesel (AG165), so their
    // 2055 ZET factors are computed against the LNG baseline.
    const dieselTCO = (zetOnly && (bucket.id === 'B9' || bucket.id === 'B11'))
      ? tco['LNG'].tcoPerKm
      : tco['Diesel'].tcoPerKm;
    const dieselPrice = tco['Diesel'].vehiclePrice;
    const dieselTAT = tatRatings['Diesel'];
    const dieselRange = rangeRatings['Diesel'];

    const rawScores: Record<Powertrain, number> = {} as any;
    const el = BUCKET_CHOICE_ELASTICITIES[bucket.id];
    // TCO factor per PT kept separately so the B12 quirk below can swap them
    const tcoFactors: Record<Powertrain, number> = {} as any;
    const otherFactors: Record<Powertrain, number> = {} as any;

    for (const pt of POWERTRAINS) {
      if (zetOnly && (pt === 'Diesel' || pt === 'CNG' || pt === 'LNG')) {
        rawScores[pt] = 0;
        continue;
      }
      const supplyYear = START_OF_SUPPLY[bucket.size as VehicleSize]?.[pt] ?? 2026;
      if (targetYear < supplyYear) {
        rawScores[pt] = 0;
        continue;
      }

      // Factor 1: TCO — diesel/pt (lower TCO better)
      const tcoArg = el.tco * (dieselTCO / tco[pt].tcoPerKm - 1);

      // Factor 2: Vehicle Price — diesel/pt (lower price better)
      const priceArg = el.price * (dieselPrice / tco[pt].vehiclePrice - 1);

      // Factor 3: Rated Payload — pt/diesel (higher payload better)
      const payloadArg = el.payload * (payloadRatio(bucket, pt, fixed, policy) - 1);

      // Factor 4: TAT/Gradeability — pt/diesel (higher rating better)
      const tatRating = tatRatings[pt];
      const tatArg = el.tat * (tatRating / dieselTAT - 1);

      // Factor 5: Range/Filling — diesel/pt (lower penalty better)
      const rangeRating = (policy?.range_filling_concern_after_2035 === false && targetYear >= 2035)
        ? 1.0
        : rangeRatings[pt];
      const rangeArg = el.range * (dieselRange / rangeRating - 1);

      tcoFactors[pt] = Math.exp(clamp(tcoArg, -50, 50));
      otherFactors[pt] = Math.exp(clamp(priceArg, -50, 50))
        + Math.exp(clamp(payloadArg, -50, 50))
        + Math.exp(clamp(tatArg, -50, 50))
        + Math.exp(clamp(rangeArg, -50, 50));
      rawScores[pt] = tcoFactors[pt] + otherFactors[pt];
    }

    // Excel quirk: B12's BET and H2-ICE TCO factor cells are cross-wired in
    // the workbook (Estimation sheets 2045 & 2050), so each PT scores with
    // the other's TCO factor. Replicated for fidelity with the source model.
    if (bucket.id === 'B12' && !zetOnly
      && rawScores['BET'] > 0 && rawScores['H2-ICE'] > 0) {
      rawScores['BET'] = tcoFactors['H2-ICE'] + otherFactors['BET'];
      rawScores['H2-ICE'] = tcoFactors['BET'] + otherFactors['H2-ICE'];
    }

    // Normalize
    const total = POWERTRAINS.reduce((s, pt) => s + rawScores[pt], 0);
    const shares: Record<Powertrain, number> = {} as any;
    for (const pt of POWERTRAINS) {
      shares[pt] = total > 0 ? rawScores[pt] / total : 0;
    }

    // Excel Estimation-sheet adjustments: multiply shares by the per-bucket
    // supply-delay / maturity / potential-TIV factors, then renormalize.
    const adj = CHOICE_SHARE_ADJUSTMENT[targetYear]?.[bucket.id];
    if (adj) {
      let adjTotal = 0;
      for (const pt of POWERTRAINS) {
        shares[pt] *= adj[pt] ?? 1;
        adjTotal += shares[pt];
      }
      if (adjTotal > 0) {
        for (const pt of POWERTRAINS) shares[pt] /= adjTotal;
      }
    }

    result[bucket.id] = shares;
  }

  // DEBUG
  if (typeof window !== 'undefined' && (window as any).__SIM_DEBUG__) {
    const b1 = result['B1'];
    if (b1) {
      console.log(`[ChoiceModel DEBUG] Year=${targetYear} Bucket=B1`);
      for (const pt of POWERTRAINS) {
        console.log(`  ${pt}: share=${(b1[pt] * 100).toFixed(2)}%`);
      }
    }
    if (targetYear === 2045) {
      const b12 = result['B12'];
      const b12tco = tcoResults['B12'];
      if (b12 && b12tco) {
        console.table({
          'B12_CNG_vs_Diesel_2045': {
            CNG_TCO: b12tco['CNG']?.tcoPerKm?.toFixed(2),
            Diesel_TCO: b12tco['Diesel']?.tcoPerKm?.toFixed(2),
            CNG_share: b12['CNG'],
            Diesel_share: b12['Diesel'],
          }
        });
      }
    }
  }

  return result;
}
