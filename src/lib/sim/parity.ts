/**
 * TCO parity — the first year each ZET's total cost of ownership per km drops
 * to or below diesel's, per bucket.
 *
 * Excel 'Buckets' AE3:AG16 / AH3:AJ16 ("TCO Parity with Diesel"), an array
 * formula over each bucket sheet's TCO summary block:
 *
 *   =IFERROR(INDEX(B1!$C$182:$AG$182,
 *      MATCH(1,(B1!$C$168:$AG$168 <= B1!$C$165:$AG$165)*1, 0)), "No Parity")
 *
 * where row 165 is the diesel TCO/km, rows 168/169/170 are BET / H2-ICE / FCET,
 * and row 182 is the year header. In other words: scan the years left to right
 * and take the first one where the ZET line has reached diesel; if it never
 * does, there is no parity.
 */
import type {
  ParameterKey, PolicyConfig, FixedParameters, SegmentBasePrices,
  ParityPowertrain, ParityYears,
} from '@/lib/types';
import type { Bucket, Powertrain } from '@/lib/constants/extracted';
import { computeTCO } from './tco';
import { START_YEAR } from './timeSeries';

/** The powertrains the parity chart compares against diesel. */
export const PARITY_POWERTRAINS: readonly ParityPowertrain[] = ['BET', 'H2-ICE', 'H2-FCET'];
export type { ParityPowertrain, ParityYears };

const END_YEAR = 2055;

export function computeParityYears(
  ts: Record<ParameterKey, number[]>,
  policy: PolicyConfig,
  buckets: Bucket[],
  fixed?: FixedParameters,
  segmentBasePrices?: SegmentBasePrices,
): ParityYears {
  const result: ParityYears = {};
  for (const b of buckets) {
    result[b.id] = { BET: null, 'H2-ICE': null, 'H2-FCET': null };
  }

  // One pass over the horizon; stop early once every bucket × ZET has parity.
  let outstanding = buckets.length * PARITY_POWERTRAINS.length;

  for (let year = START_YEAR; year <= END_YEAR && outstanding > 0; year++) {
    const tco = computeTCO(ts, policy, buckets, year, fixed, segmentBasePrices);
    for (const b of buckets) {
      const row = tco[b.id];
      if (!row) continue;
      const diesel = row['Diesel']?.tcoPerKm;
      if (!Number.isFinite(diesel)) continue;
      for (const pt of PARITY_POWERTRAINS) {
        if (result[b.id][pt] !== null) continue;
        const zet = row[pt as Powertrain]?.tcoPerKm;
        if (Number.isFinite(zet) && zet <= diesel) {
          result[b.id][pt] = year;
          outstanding--;
        }
      }
    }
  }

  return result;
}
