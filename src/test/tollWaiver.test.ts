import { describe, it, expect } from 'vitest';
import {
  BUCKETS, BAU_PARAMETERS, BAU_POLICY, BAU_FIXED, BAU_SEGMENT_BASE_PRICES,
  TOLL_WAIVER_KEYS,
} from '@/lib/constants/extracted';
import type { AnnualResult, ScenarioConfig } from '@/lib/types';
import { buildTimeSeries } from '@/lib/sim/timeSeries';
import { computeTCO, tollWaiverForYear } from '@/lib/sim/tco';
import { computeShares } from '@/lib/sim/choiceModel';
import { computePTTM } from '@/lib/sim/pttm';
import { computeStockEmissions } from '@/lib/sim/stockEmissions';
import { computeParityYears } from '@/lib/sim/parity';

/**
 * ZET toll waiver — Excel 'Changing with year' rows 276-284, identical in
 * PTCM v2 and v5:
 *   years ≤ 2033  → ZET toll = diesel toll × $AL$276
 *   2034-39       → ZET toll = diesel toll × $AL$277
 *   2040 onward   → ZET toll = diesel toll (R276 = R265), no waiver
 * consumed by the bucket sheets' row "Toll Charges (H2 ICE, BET & FCET)".
 *
 * PTTM only reads the 2045/2050/2055 Estimation sheets, so — as in the Excel —
 * the waiver moves the yearly TCO and the TCO parity years, never the sales /
 * stock / emissions projection.
 */

const ZET_TOLL_PTS = ['BET', 'H2-ICE', 'H2-FCET'] as const;
const DIESEL_TOLL_PTS = ['Diesel', 'CNG', 'LNG'] as const;

function cfgWith(bands: Record<string, number>): ScenarioConfig {
  return {
    parameters: structuredClone(BAU_PARAMETERS),
    policy: { ...structuredClone(BAU_POLICY), toll_waiver_bands: bands },
    fixed: structuredClone(BAU_FIXED),
    segmentBasePrices: structuredClone(BAU_SEGMENT_BASE_PRICES),
  } as unknown as ScenarioConfig;
}

const flat = (v: number) =>
  Object.fromEntries(TOLL_WAIVER_KEYS.map(k => [k, v])) as Record<string, number>;

function tcoAt(cfg: ScenarioConfig, year: number) {
  const ts = buildTimeSeries(cfg.parameters, cfg.policy);
  return computeTCO(ts, cfg.policy, BUCKETS, year, cfg.fixed, cfg.segmentBasePrices);
}

function projection(cfg: ScenarioConfig): AnnualResult[] {
  const t = (y: number) => tcoAt(cfg, y);
  const s45 = computeShares(t(2045), BUCKETS, 2045, cfg.policy, false, cfg.fixed);
  const s50 = computeShares(t(2050), BUCKETS, 2050, cfg.policy, false, cfg.fixed);
  const s55 = computeShares(t(2055), BUCKETS, 2055, cfg.policy, true, cfg.fixed);
  return computeStockEmissions(computePTTM(s45, s50, s55, cfg.policy)).years;
}

function parity(cfg: ScenarioConfig) {
  const ts = buildTimeSeries(cfg.parameters, cfg.policy);
  return computeParityYears(ts, cfg.policy, BUCKETS, cfg.fixed, cfg.segmentBasePrices);
}

describe('ZET toll waiver (Excel $AL$276 / $AL$277)', () => {
  it('offers exactly the two Excel bands', () => {
    expect([...TOLL_WAIVER_KEYS]).toEqual(['till2033', 'd3439']);
  });

  it('maps years to bands like Excel row 276 (≤2033, 2034-39, none from 2040)', () => {
    const policy = { ...BAU_POLICY, toll_waiver_bands: { till2033: 0.3, d3439: 0.7 } } as never;
    expect(tollWaiverForYear(policy, 2026)).toBe(0.3);
    expect(tollWaiverForYear(policy, 2033)).toBe(0.3);
    expect(tollWaiverForYear(policy, 2034)).toBe(0.7);
    expect(tollWaiverForYear(policy, 2039)).toBe(0.7);
    expect(tollWaiverForYear(policy, 2040)).toBe(0);
    expect(tollWaiverForYear(policy, 2055)).toBe(0);
  });

  it('waives the toll for BET, H2-ICE and FCET only, in waived years', () => {
    for (const year of [2030, 2036]) {
      const base = tcoAt(cfgWith(flat(0)), year);
      const half = tcoAt(cfgWith(flat(0.5)), year);
      for (const b of BUCKETS) {
        for (const pt of ZET_TOLL_PTS) {
          const toll = base[b.id][pt].tollPerKm;
          expect(toll).toBeGreaterThan(0);
          expect(half[b.id][pt].tollPerKm).toBeCloseTo(toll * 0.5, 10);
        }
        for (const pt of DIESEL_TOLL_PTS) {
          expect(half[b.id][pt].tollPerKm).toBeCloseTo(base[b.id][pt].tollPerKm, 10);
        }
      }
    }
  });

  it('charges the full toll from 2040, so 2045/2050/2055 TCO is unchanged', () => {
    for (const year of [2040, 2045, 2050, 2055]) {
      expect(JSON.stringify(tcoAt(cfgWith(flat(1)), year)))
        .toBe(JSON.stringify(tcoAt(cfgWith(flat(0)), year)));
    }
  });

  it('leaves the sales / stock / emissions projection untouched, as in the Excel', () => {
    expect(JSON.stringify(projection(cfgWith(flat(1)))))
      .toBe(JSON.stringify(projection(cfgWith(flat(0)))));
  });

  it('moves the TCO parity years — each band on its own', () => {
    const baseline = JSON.stringify(parity(cfgWith(flat(0))));
    for (const key of TOLL_WAIVER_KEYS) {
      const moved = JSON.stringify(parity(cfgWith({ ...flat(0), [key]: 1 })));
      expect(moved, `toll_waiver_bands.${key} had no effect on parity`).not.toBe(baseline);
    }
  });

  it('never delays parity — a deeper waiver brings it the same year or earlier', () => {
    const none = parity(cfgWith(flat(0)));
    const full = parity(cfgWith(flat(1)));
    for (const b of BUCKETS) {
      for (const pt of ZET_TOLL_PTS) {
        const n = none[b.id][pt], f = full[b.id][pt];
        if (n !== null) expect(f).not.toBeNull();
        if (n !== null && f !== null) expect(f).toBeLessThanOrEqual(n);
      }
    }
  });
});
