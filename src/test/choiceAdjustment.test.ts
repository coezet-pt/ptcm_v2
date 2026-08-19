import { describe, it, expect } from 'vitest';
import {
  BUCKETS, POWERTRAINS, BAU_POLICY, BAU_PARAMETERS, BAU_FIXED, BAU_SEGMENT_BASE_PRICES,
  CHOICE_SHARE_ADJUSTMENT_BASELINE, PT_MATURITY_YEARS,
} from '@/lib/constants/extracted';
import type { AnnualResult, ScenarioConfig } from '@/lib/types';
import {
  ADJUSTMENT_YEARS, computeChoiceShareAdjustment, delayFactor,
} from '@/lib/sim/adjustments';
import { buildTimeSeries } from '@/lib/sim/timeSeries';
import { computeTCO } from '@/lib/sim/tco';
import { computeShares } from '@/lib/sim/choiceModel';
import { computePTTM } from '@/lib/sim/pttm';
import { computeStockEmissions } from '@/lib/sim/stockEmissions';

/**
 * The Estimation-sheet share adjustments are rebuilt from the year inputs
 * rather than read from a table (see sim/adjustments.ts). Two things matter:
 * the rebuild must reproduce the extracted workbook snapshot exactly at default
 * inputs, and the maturity years must actually reach a result.
 */

function baseCfg(): ScenarioConfig {
  return {
    parameters: structuredClone(BAU_PARAMETERS),
    policy: structuredClone(BAU_POLICY),
    fixed: structuredClone(BAU_FIXED),
    segmentBasePrices: structuredClone(BAU_SEGMENT_BASE_PRICES),
  } as unknown as ScenarioConfig;
}

function projection(cfg: ScenarioConfig): AnnualResult[] {
  const ts = buildTimeSeries(cfg.parameters, cfg.policy);
  const t = (y: number) => computeTCO(ts, cfg.policy, BUCKETS, y, cfg.fixed, cfg.segmentBasePrices);
  const s45 = computeShares(t(2045), BUCKETS, 2045, cfg.policy, false, cfg.fixed);
  const s50 = computeShares(t(2050), BUCKETS, 2050, cfg.policy, false, cfg.fixed);
  const s55 = computeShares(t(2055), BUCKETS, 2055, cfg.policy, true, cfg.fixed);
  return computeStockEmissions(computePTTM(s45, s50, s55, cfg.policy)).years;
}
const projectionKey = (cfg: ScenarioConfig) => JSON.stringify(projection(cfg));

describe('Estimation share adjustments', () => {
  it('delayFactor matches the Excel worked examples', () => {
    // 'Input Sheet' BV14/BV15 for 19T Rigid at the 2050 anchor.
    expect(delayFactor(2027, 2025, 2050)).toBeCloseTo(0.92, 10); // CNG start of supply
    expect(delayFactor(2034, 2025, 2050)).toBeCloseTo(0.64, 10); // H2-ICE start of supply
    expect(delayFactor(2038, 2025, 2050)).toBeCloseTo(0.48, 10); // FCET start of supply
    expect(delayFactor(2030, 2025, 2050)).toBeCloseTo(0.80, 10); // CNG maturity
    expect(delayFactor(2042, 2025, 2050)).toBeCloseTo(0.32, 10); // H2-ICE maturity
    // 'Input Sheet' CI15/CJ15 — 2055 anchor, baselined on BET.
    expect(delayFactor(2042, 2035, 2055)).toBeCloseTo(0.65, 10);
    expect(delayFactor(2045, 2035, 2055)).toBeCloseTo(0.50, 10);
  });

  it('reproduces the extracted workbook table at default inputs', () => {
    for (const year of ADJUSTMENT_YEARS) {
      for (const b of BUCKETS) {
        const expected = CHOICE_SHARE_ADJUSTMENT_BASELINE[year]?.[b.id] ?? {};
        const actual = computeChoiceShareAdjustment(year, b, BAU_POLICY as never) ?? {};
        for (const pt of POWERTRAINS) {
          if (expected[pt] === undefined) continue;
          expect(actual[pt], `${year} ${b.id} ${pt}`).toBeCloseTo(expected[pt]!, 9);
        }
      }
    }
  });

  it('policy maturity years default to the workbook values', () => {
    expect(BAU_POLICY.bet_maturity_year).toBe(PT_MATURITY_YEARS.BET);
    expect(BAU_POLICY.h2ice_maturity_year).toBe(PT_MATURITY_YEARS['H2-ICE']);
    expect(BAU_POLICY.fcet_maturity_year).toBe(PT_MATURITY_YEARS['H2-FCET']);
  });

  it('has no dead levers — each maturity year moves the projection', () => {
    const baseline = projectionKey(baseCfg());
    const levers = [
      ['bet_maturity_year', 2030],
      ['h2ice_maturity_year', 2036],
      ['fcet_maturity_year', 2038],
    ] as const;
    for (const [key, value] of levers) {
      const cfg = baseCfg();
      (cfg.policy as unknown as Record<string, unknown>)[key] = value;
      expect(projectionKey(cfg), `policy.${key} had no effect on any chart`).not.toBe(baseline);
    }
  });

  it('an earlier ZET maturity raises ZET share', () => {
    const zetShare = (cfg: ScenarioConfig, year: number) => {
      const y = projection(cfg)[year - 2026];
      return (['BET', 'H2-ICE', 'H2-FCET'] as const)
        .reduce((s, pt) => s + (y.shareByPT[pt] ?? 0), 0);
    };
    const earlier = baseCfg();
    earlier.policy.bet_maturity_year = 2030;
    earlier.policy.h2ice_maturity_year = 2036;
    earlier.policy.fcet_maturity_year = 2038;
    expect(zetShare(earlier, 2050)).toBeGreaterThan(zetShare(baseCfg(), 2050));
  });
});
