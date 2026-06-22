import { describe, it, expect } from 'vitest';
import {
  BUCKETS, BAU_PARAMETERS, BAU_POLICY, BAU_FIXED, BAU_SEGMENT_BASE_PRICES, POWERTRAINS,
} from '@/lib/constants/extracted';
import type { ScenarioConfig, FixedParameters } from '@/lib/types';
import { buildTimeSeries } from '@/lib/sim/timeSeries';
import { computeTCO } from '@/lib/sim/tco';
import { computeShares } from '@/lib/sim/choiceModel';
import { computePTTM } from '@/lib/sim/pttm';
import { computeStockEmissions } from '@/lib/sim/stockEmissions';
import { runSanityChecks } from '@/lib/sim/sanityCheck';

const config: ScenarioConfig = {
  parameters: { ...BAU_PARAMETERS } as ScenarioConfig['parameters'],
  policy: { ...BAU_POLICY },
  fixed: structuredClone(BAU_FIXED) as FixedParameters,
  segmentBasePrices: structuredClone(BAU_SEGMENT_BASE_PRICES) as ScenarioConfig['segmentBasePrices'],
};

describe('2026 rebase — full pipeline', () => {
  const ts = buildTimeSeries(config.parameters, config.policy);
  const tco2045 = computeTCO(ts, config.policy, BUCKETS, 2045, config.fixed, config.segmentBasePrices);
  const tco2050 = computeTCO(ts, config.policy, BUCKETS, 2050, config.fixed, config.segmentBasePrices);
  const tco2055 = computeTCO(ts, config.policy, BUCKETS, 2055, config.fixed, config.segmentBasePrices);
  const s45 = computeShares(tco2045, BUCKETS, 2045, config.policy, false, config.fixed);
  const s50 = computeShares(tco2050, BUCKETS, 2050, config.policy, false, config.fixed);
  const s55 = computeShares(tco2055, BUCKETS, 2055, config.policy, true, config.fixed);
  const annual = computePTTM(s45, s50, s55, config.policy);
  const result = computeStockEmissions(annual);

  it('series starts at 2026 and ends 2055', () => {
    expect(result.years[0].year).toBe(2026);
    expect(result.years[result.years.length - 1].year).toBe(2055);
    expect(result.years.length).toBe(30);
  });

  it('diesel price trajectory matches Excel (99 @2026, ~144.22 @2045)', () => {
    expect(ts.diesel_price_per_l[0]).toBeCloseTo(99, 2);
    const idx2045 = 2045 - 2026;
    expect(ts.diesel_price_per_l[idx2045]).toBeCloseTo(144.22, 0);
  });

  it('reports sanity checks', () => {
    const checks = runSanityChecks(result);
    const lines = checks.map(c => `${c.passed ? 'PASS' : 'FAIL'} ${c.name}: ${c.message} (exp ${c.expected})`);
    // eslint-disable-next-line no-console
    console.log('\n' + lines.join('\n'));
    const y = (yr: number) => result.years.find(r => r.year === yr)!;
    const tot = (yr: number) => POWERTRAINS.reduce((s, pt) => s + y(yr).salesByPT[pt], 0);
    // eslint-disable-next-line no-console
    console.log(`\n2026 total sales: ${Math.round(tot(2026)).toLocaleString()} (Excel 301,120)`);
    // eslint-disable-next-line no-console
    console.log(`2026 diesel sales: ${Math.round(y(2026).salesByPT.Diesel).toLocaleString()} (Excel 286,923)`);
    // eslint-disable-next-line no-console
    console.log(`2045 ZET share: ${(y(2045).zetShare * 100).toFixed(1)}% | 2055 ZET share: ${(y(2055).zetShare * 100).toFixed(1)}%`);
    expect(checks.every(c => c.passed)).toBe(true);
  });
});
