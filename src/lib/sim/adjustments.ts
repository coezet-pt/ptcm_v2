/**
 * Estimation-sheet share adjustments — the multipliers applied to the raw
 * choice-model shares before renormalisation.
 *
 * The workbook does NOT store these as constants; it computes them from year
 * inputs. Every layer is the same "delay" shape (Excel 'Input Sheet' BI14,
 * BV14/BV15, CI15):
 *
 *   delay(pt) = 1 − (year[pt] − year[baseline]) / (steadyState − year[baseline])
 *
 * so a powertrain that arrives on the baseline's date scores 1 and one that
 * arrives at the steady-state year scores 0. Which layers apply, and against
 * which baseline, differs per Estimation sheet:
 *
 *   | anchor | layers                                    | baseline | steady state |
 *   |--------|-------------------------------------------|----------|--------------|
 *   | 2045   | supply × potentialTIV                     | Diesel   | 2045         |
 *   | 2050   | supply × maturity × potentialTIV          | Diesel   | 2050         |
 *   | 2055   | maturity                                  | BET      | 2055         |
 *
 * (2045 = 'Estimation SS2045' row 13 + 14; 2050 = 'Estimation2050' rows 12, 13
 * + 14; 2055 = 'Estimation 100% ZET 2055', which is ZET-only so it baselines on
 * BET and carries no potential-TIV layer.)
 *
 * Worked check, B1 (19T Rigid) at 2050: supply CNG 1−(2027−2025)/25 = 0.92 and
 * maturity CNG 1−(2030−2025)/25 = 0.80 → 0.736, which is exactly the value the
 * old hardcoded table carried. Same for BET (0.92×0.60 = 0.552), H2-ICE
 * (0.64×0.32 = 0.2048) and FCET (0.48×0.20 = 0.096).
 */
import type { PolicyConfig } from '@/lib/types';
import type { Bucket, Powertrain, VehicleSize } from '@/lib/constants/extracted';
import {
  BUCKETS,
  POWERTRAINS,
  START_OF_SUPPLY,
  PT_MATURITY_YEARS,
  PT_STEADY_STATE_YEAR,
  CHOICE_SHARE_ADJUSTMENT_BASELINE,
} from '@/lib/constants/extracted';

export type ShareAdjustment = Partial<Record<Powertrain, number>>;

/** The anchors the choice model evaluates. */
export const ADJUSTMENT_YEARS = [2045, 2050, 2055] as const;

/** Excel delay factor, floored at 0 (a powertrain later than steady state cannot go negative). */
export function delayFactor(yearPt: number, yearBase: number, steadyState: number): number {
  const span = steadyState - yearBase;
  if (!Number.isFinite(span) || span <= 0) return 1;
  const f = 1 - (yearPt - yearBase) / span;
  return Number.isFinite(f) ? Math.max(0, f) : 1;
}

/** Maturity years for a config — policy overrides the three ZET entries. */
function maturityYears(policy?: PolicyConfig): Record<Powertrain, number> {
  return {
    ...PT_MATURITY_YEARS,
    BET: policy?.bet_maturity_year ?? PT_MATURITY_YEARS.BET,
    'H2-ICE': policy?.h2ice_maturity_year ?? PT_MATURITY_YEARS['H2-ICE'],
    'H2-FCET': policy?.fcet_maturity_year ?? PT_MATURITY_YEARS['H2-FCET'],
  };
}

/** Start-of-supply delay layer for one bucket at one anchor (baseline: diesel). */
function supplyLayer(size: VehicleSize, steadyState: number): ShareAdjustment {
  const sos = START_OF_SUPPLY[size];
  const out: ShareAdjustment = {};
  if (!sos) return out;
  for (const pt of POWERTRAINS) out[pt] = delayFactor(sos[pt], sos.Diesel, steadyState);
  return out;
}

/** Maturity delay layer at one anchor, against the given baseline powertrain. */
function maturityLayer(
  steadyState: number,
  baseline: Powertrain,
  policy?: PolicyConfig,
): ShareAdjustment {
  const my = maturityYears(policy);
  const out: ShareAdjustment = {};
  for (const pt of POWERTRAINS) out[pt] = delayFactor(my[pt], my[baseline], steadyState);
  return out;
}

/**
 * "Adjustment for Potential TIV" — the availability/volume layer that zeroes
 * CNG or LNG in buckets where they are not offered.
 *
 * Derived once, at module load, by dividing the extracted baseline table by the
 * delay layers computed at the default year inputs. Deriving rather than
 * re-extracting guarantees the computed path reproduces the workbook exactly at
 * defaults, with no transcription risk. It has to be per anchor because the
 * potential-TIV shares themselves differ between 2045 and 2050
 * ('Buckets'!S3 vs X3).
 */
function derivePotentialTiv(): Record<number, Record<string, ShareAdjustment>> {
  const out: Record<number, Record<string, ShareAdjustment>> = {};
  for (const year of [2045, 2050]) {
    const ss = PT_STEADY_STATE_YEAR[year];
    out[year] = {};
    for (const b of BUCKETS) {
      const baseline = CHOICE_SHARE_ADJUSTMENT_BASELINE[year]?.[b.id] ?? {};
      const supply = supplyLayer(b.size as VehicleSize, ss);
      const maturity = year === 2050 ? maturityLayer(ss, 'Diesel') : null;
      const row: ShareAdjustment = {};
      for (const pt of POWERTRAINS) {
        const target = baseline[pt];
        if (target === undefined) continue;
        const delays = (supply[pt] ?? 1) * (maturity ? (maturity[pt] ?? 1) : 1);
        // delays === 0 would make the residual undefined; the baseline is 0 there too.
        row[pt] = delays > 0 ? target / delays : 0;
      }
      out[year][b.id] = row;
    }
  }
  return out;
}

export const POTENTIAL_TIV_ADJUSTMENT = derivePotentialTiv();

/**
 * Share-adjustment multipliers for one bucket at one Estimation anchor.
 * Returns undefined for years the workbook has no Estimation sheet for.
 */
export function computeChoiceShareAdjustment(
  year: number,
  bucket: Bucket,
  policy?: PolicyConfig,
): ShareAdjustment | undefined {
  const ss = PT_STEADY_STATE_YEAR[year];
  if (ss === undefined) return undefined;

  // 2055 ('Estimation 100% ZET 2055') is ZET-only: maturity delay against BET,
  // no start-of-supply and no potential-TIV layer.
  if (year === 2055) {
    const maturity = maturityLayer(ss, 'BET', policy);
    return {
      BET: maturity.BET,
      'H2-ICE': maturity['H2-ICE'],
      'H2-FCET': maturity['H2-FCET'],
    };
  }

  const supply = supplyLayer(bucket.size as VehicleSize, ss);
  const maturity = year === 2050 ? maturityLayer(ss, 'Diesel', policy) : null;
  const potential = POTENTIAL_TIV_ADJUSTMENT[year]?.[bucket.id] ?? {};

  const out: ShareAdjustment = {};
  for (const pt of POWERTRAINS) {
    if (potential[pt] === undefined) continue;
    out[pt] = (supply[pt] ?? 1) * (maturity ? (maturity[pt] ?? 1) : 1) * potential[pt];
  }
  return out;
}
