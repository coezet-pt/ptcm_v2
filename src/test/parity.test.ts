import { describe, it, expect } from 'vitest';
import {
  BUCKETS, BAU_PARAMETERS, BAU_POLICY, BAU_FIXED, BAU_SEGMENT_BASE_PRICES,
} from '@/lib/constants/extracted';
import type { ScenarioConfig } from '@/lib/types';
import { buildTimeSeries } from '@/lib/sim/timeSeries';
import { computeParityYears, PARITY_POWERTRAINS } from '@/lib/sim/parity';

/**
 * TCO parity year per bucket — Excel 'Buckets' AH3:AJ16, "TCO Parity with
 * Diesel Scenario 1" (the BAU column), computed there by an array formula over
 * each bucket sheet's TCO rows. Reproduced here from the engine.
 *
 * The engine is rebased to 2026 while the workbook starts at 2025, so exact
 * agreement is not guaranteed. At the time of writing 36 of the 42 cells match
 * exactly and the remaining six are BET, each exactly one year late; the
 * tolerance below pins that and will fail if the gap ever widens.
 */
const EXCEL_BAU: Record<string, [number, number, number]> = {
  B1: [2031, 2046, 2046], B2: [2032, 2046, 2046], B3: [2028, 2045, 2045],
  B4: [2030, 2046, 2046], B5: [2031, 2045, 2046], B6: [2031, 2046, 2046],
  B7: [2032, 2046, 2046], B8: [2030, 2045, 2045], B9: [2027, 2045, 2045],
  B10: [2026, 2045, 2045], B11: [2026, 2045, 2046], B12: [2034, 2046, 2048],
  B13: [2032, 2046, 2046], B14: [2035, 2046, 2048],
};

function bauParity() {
  const cfg = {
    parameters: structuredClone(BAU_PARAMETERS),
    policy: structuredClone(BAU_POLICY),
    fixed: structuredClone(BAU_FIXED),
    segmentBasePrices: structuredClone(BAU_SEGMENT_BASE_PRICES),
  } as unknown as ScenarioConfig;
  const ts = buildTimeSeries(cfg.parameters, cfg.policy);
  return computeParityYears(ts, cfg.policy, BUCKETS, cfg.fixed, cfg.segmentBasePrices);
}

describe('TCO parity years', () => {
  const parity = bauParity();

  it('every bucket reaches parity for every ZET at BAU', () => {
    for (const b of BUCKETS) {
      for (const pt of PARITY_POWERTRAINS) {
        expect(parity[b.id][pt], `${b.id} ${pt}`).not.toBeNull();
      }
    }
  });

  it('lands within one year of the workbook for all 42 cells', () => {
    for (const b of BUCKETS) {
      const expected = EXCEL_BAU[b.id];
      PARITY_POWERTRAINS.forEach((pt, i) => {
        expect(Math.abs(parity[b.id][pt]! - expected[i]), `${b.id} ${pt}`).toBeLessThanOrEqual(1);
      });
    }
  });

  it('matches the workbook exactly for H2-ICE and H2-FCET', () => {
    for (const b of BUCKETS) {
      expect(parity[b.id]['H2-ICE'], `${b.id} H2-ICE`).toBe(EXCEL_BAU[b.id][1]);
      expect(parity[b.id]['H2-FCET'], `${b.id} H2-FCET`).toBe(EXCEL_BAU[b.id][2]);
    }
  });

  it('BET reaches parity before the hydrogen powertrains', () => {
    for (const b of BUCKETS) {
      expect(parity[b.id].BET!, b.id).toBeLessThan(parity[b.id]['H2-ICE']!);
    }
  });

  it('responds to cost levers — cheaper batteries pull BET parity earlier', () => {
    const cfg = {
      parameters: structuredClone(BAU_PARAMETERS),
      policy: structuredClone(BAU_POLICY),
      fixed: structuredClone(BAU_FIXED),
      segmentBasePrices: structuredClone(BAU_SEGMENT_BASE_PRICES),
    } as unknown as ScenarioConfig;
    cfg.parameters.battery_cost_per_kwh.baseValue *= 0.5;
    const ts = buildTimeSeries(cfg.parameters, cfg.policy);
    const cheaper = computeParityYears(ts, cfg.policy, BUCKETS, cfg.fixed, cfg.segmentBasePrices);
    // At least one bucket must move earlier, and none may move later.
    let moved = 0;
    for (const b of BUCKETS) {
      expect(cheaper[b.id].BET!, b.id).toBeLessThanOrEqual(parity[b.id].BET!);
      if (cheaper[b.id].BET! < parity[b.id].BET!) moved++;
    }
    expect(moved).toBeGreaterThan(0);
  });
});
