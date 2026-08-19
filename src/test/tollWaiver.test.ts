import { describe, it, expect } from 'vitest';
import {
  BUCKETS, BAU_PARAMETERS, BAU_POLICY, BAU_FIXED, BAU_SEGMENT_BASE_PRICES,
  POWERTRAINS, TOLL_WAIVER_KEYS,
} from '@/lib/constants/extracted';
import type { AnnualResult, ScenarioConfig } from '@/lib/types';
import { buildTimeSeries } from '@/lib/sim/timeSeries';
import { computeTCO } from '@/lib/sim/tco';
import { computeShares } from '@/lib/sim/choiceModel';
import { computePTTM } from '@/lib/sim/pttm';
import { computeStockEmissions } from '@/lib/sim/stockEmissions';

/**
 * ZET toll waiver — Excel 'Changing with year' rows 276-284 (ZET toll = diesel
 * toll × the waiver multiplier), consumed by the bucket sheets' row
 * "Toll Charges (H2 ICE, BET & FCET)".
 *
 * Two things are pinned here:
 *  1. the waiver reaches every powertrain on that ZET toll row — all 14 B-sheets
 *     route H2-ICE through it alongside BET and FCET, and
 *  2. every band the UI offers actually reaches a result. The choice model only
 *     prices TCO at 2045/2050/2055, so a band outside those decision points
 *     would be a dead control.
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

/** Everything the projection charts draw, year by year. */
function projection(cfg: ScenarioConfig): AnnualResult[] {
  const ts = buildTimeSeries(cfg.parameters, cfg.policy);
  const t = (y: number) => computeTCO(ts, cfg.policy, BUCKETS, y, cfg.fixed, cfg.segmentBasePrices);
  const s45 = computeShares(t(2045), BUCKETS, 2045, cfg.policy, false, cfg.fixed);
  const s50 = computeShares(t(2050), BUCKETS, 2050, cfg.policy, false, cfg.fixed);
  const s55 = computeShares(t(2055), BUCKETS, 2055, cfg.policy, true, cfg.fixed);
  return computeStockEmissions(computePTTM(s45, s50, s55, cfg.policy)).years;
}

/** The same, flattened so two runs can be compared for "did anything move at all". */
const projectionKey = (cfg: ScenarioConfig) => JSON.stringify(projection(cfg));

describe('ZET toll waiver', () => {
  it('waives the toll for BET, H2-ICE and FCET alike (Excel B1-B14 row 60/61)', () => {
    const base = tcoAt(cfgWith(flat(0)), 2045);
    const half = tcoAt(cfgWith(flat(0.5)), 2045);
    const full = tcoAt(cfgWith(flat(1)), 2045);

    for (const b of BUCKETS) {
      for (const pt of ZET_TOLL_PTS) {
        const toll = base[b.id][pt].tollPerKm;
        expect(toll).toBeGreaterThan(0);
        expect(half[b.id][pt].tollPerKm).toBeCloseTo(toll * 0.5, 10);
        expect(full[b.id][pt].tollPerKm).toBeCloseTo(0, 10);
      }
      // Diesel/CNG/LNG stay on the unwaived diesel toll row.
      for (const pt of DIESEL_TOLL_PTS) {
        const toll = base[b.id][pt].tollPerKm;
        expect(half[b.id][pt].tollPerKm).toBeCloseTo(toll, 10);
        expect(full[b.id][pt].tollPerKm).toBeCloseTo(toll, 10);
      }
    }
  });

  it('leaves the BAU baseline untouched when no toll is waived', () => {
    expect(projectionKey(cfgWith(flat(0)))).toBe(projectionKey(cfgWith({})));
  });

  it('has no dead bands — each offered band moves the projection', () => {
    const baseline = projectionKey(cfgWith(flat(0)));
    for (const key of TOLL_WAIVER_KEYS) {
      const moved = projectionKey(cfgWith({ ...flat(0), [key]: 1 }));
      expect(moved, `toll_waiver_bands.${key} had no effect on any chart`).not.toBe(baseline);
    }
  });

  it('raises total ZET share as the waiver deepens', () => {
    const zetShare = (cfg: ScenarioConfig, year: number) => {
      const y = projection(cfg)[year - 2026];
      return ZET_TOLL_PTS.reduce((s, pt) => s + (y.shareByPT[pt] ?? 0), 0);
    };
    for (const year of [2040, 2045, 2050]) {
      const none = zetShare(cfgWith(flat(0)), year);
      const half = zetShare(cfgWith(flat(0.5)), year);
      const full = zetShare(cfgWith(flat(1)), year);
      expect(half).toBeGreaterThan(none);
      expect(full).toBeGreaterThan(half);
    }
  });

  it('keeps every powertrain share a valid distribution under a full waiver', () => {
    for (const y of projection(cfgWith(flat(1)))) {
      const total = POWERTRAINS.reduce((s, pt) => s + (y.shareByPT[pt] ?? 0), 0);
      expect(total).toBeCloseTo(1, 6);
    }
  });
});
