import { describe, it, expect } from 'vitest';
import {
  BUCKETS, BAU_PARAMETERS, BAU_POLICY, BAU_FIXED, BAU_SEGMENT_BASE_PRICES,
} from '@/lib/constants/extracted';
import type { ScenarioConfig } from '@/lib/types';
import { buildTimeSeries } from '@/lib/sim/timeSeries';
import { computeTCO } from '@/lib/sim/tco';

/**
 * BET/FCET demand incentive — Excel 'Changing with year' rows 129-137 (BET) and
 * 142-149 (FCET). Those rows subtract `$AH$128 × battery kWh` in the 2025-30
 * columns and `$AI$128 × kWh` in 2031-35, and subtract nothing from 2036 on.
 *
 * This is a REGRESSION GUARD, not an aspiration. Because the choice model only
 * prices TCO at 2045/2050/2055, an incentive bounded at 2035 cannot move any
 * chart — that inertness is the workbook's behaviour, and "fixing" it by
 * extending the default end years past 2045 would break Excel fidelity. If you
 * are here because this test failed, that is what it is telling you.
 */

function cfg(overrides: Record<string, unknown> = {}): ScenarioConfig {
  return {
    parameters: structuredClone(BAU_PARAMETERS),
    policy: { ...structuredClone(BAU_POLICY), ...overrides },
    fixed: structuredClone(BAU_FIXED),
    segmentBasePrices: structuredClone(BAU_SEGMENT_BASE_PRICES),
  } as unknown as ScenarioConfig;
}

function priceAt(c: ScenarioConfig, year: number, pt: 'BET' | 'H2-FCET') {
  const ts = buildTimeSeries(c.parameters, c.policy);
  return computeTCO(ts, c.policy, BUCKETS, year, c.fixed, c.segmentBasePrices).B1[pt].vehiclePrice;
}

describe('demand incentive (Excel two-phase structure)', () => {
  const b1 = BUCKETS[0];

  it('phase 1 applies through 2030 at the full per-kWh rate', () => {
    const base = priceAt(cfg(), 2030, 'BET');
    const withIncentive = priceAt(cfg({ bet_demand_incentive_per_kwh: 10000 }), 2030, 'BET');
    expect(base - withIncentive).toBeCloseTo(10000 * b1.betBatteryKWh, 6);
  });

  it('phase 2 applies 2031-2035 at the phase-2 rate', () => {
    const c = cfg({ bet_demand_incentive_per_kwh: 10000, bet_demand_incentive_phase2_per_kwh: 5000 });
    expect(priceAt(cfg(), 2035, 'BET') - priceAt(c, 2035, 'BET'))
      .toBeCloseTo(5000 * b1.betBatteryKWh, 6);
    // 2031 is phase 2, not phase 1.
    expect(priceAt(cfg(), 2031, 'BET') - priceAt(c, 2031, 'BET'))
      .toBeCloseTo(5000 * b1.betBatteryKWh, 6);
  });

  it('nothing is subtracted from 2036 on — the workbook stops there', () => {
    const c = cfg({ bet_demand_incentive_per_kwh: 10000, bet_demand_incentive_phase2_per_kwh: 5000 });
    for (const year of [2036, 2045, 2050, 2055]) {
      expect(priceAt(c, year, 'BET'), String(year)).toBe(priceAt(cfg(), year, 'BET'));
    }
  });

  it('FCET follows the same two-phase structure', () => {
    const c = cfg({ fcet_demand_incentive_per_kwh: 30000 });
    expect(priceAt(cfg(), 2030, 'H2-FCET') - priceAt(c, 2030, 'H2-FCET'))
      .toBeCloseTo(30000 * b1.fcetBatteryKWh, 6);
    expect(priceAt(c, 2045, 'H2-FCET')).toBe(priceAt(cfg(), 2045, 'H2-FCET'));
  });

  it('the default end years still bound the incentive before the 2045 anchor', () => {
    // Guards the Excel mapping: $AH$128 = 2026-30, $AI$128 = 2031-35.
    expect(BAU_POLICY.bet_incentive_phase1_end_year).toBe(2030);
    expect(BAU_POLICY.bet_incentive_phase2_end_year).toBe(2035);
    expect(BAU_POLICY.fcet_incentive_phase1_end_year).toBe(2030);
    expect(BAU_POLICY.fcet_incentive_phase2_end_year).toBe(2035);
  });
});
