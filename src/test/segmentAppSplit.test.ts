import { describe, it, expect } from 'vitest';
import {
  BUCKETS, BAU_PARAMETERS, BAU_POLICY, BAU_FIXED, BAU_SEGMENT_BASE_PRICES, POWERTRAINS,
} from '@/lib/constants/extracted';
import { SEGMENTS, APPLICATIONS } from '@/lib/constants/segments';
import { SEGMENT_SHARES, CNG_SEGMENT_SHARES, LNG_SEGMENT_SHARES, APPLICATION_SHARES } from '@/lib/constants/segmentAppShares';
import type { ScenarioConfig, FixedParameters } from '@/lib/types';
import { buildTimeSeries } from '@/lib/sim/timeSeries';
import { computeTCO } from '@/lib/sim/tco';
import { computeShares } from '@/lib/sim/choiceModel';
import { computePTTM } from '@/lib/sim/pttm';
import { computeStockEmissions } from '@/lib/sim/stockEmissions';

const config: ScenarioConfig = {
  parameters: { ...BAU_PARAMETERS } as ScenarioConfig['parameters'],
  policy: { ...BAU_POLICY },
  fixed: structuredClone(BAU_FIXED) as FixedParameters,
  segmentBasePrices: structuredClone(BAU_SEGMENT_BASE_PRICES) as ScenarioConfig['segmentBasePrices'],
};

describe('segment/application splits — Excel Segmentwise & Applicationwise sheets', () => {
  const ts = buildTimeSeries(config.parameters, config.policy);
  const tco2045 = computeTCO(ts, config.policy, BUCKETS, 2045, config.fixed, config.segmentBasePrices);
  const tco2050 = computeTCO(ts, config.policy, BUCKETS, 2050, config.fixed, config.segmentBasePrices);
  const tco2055 = computeTCO(ts, config.policy, BUCKETS, 2055, config.fixed, config.segmentBasePrices);
  const s45 = computeShares(tco2045, BUCKETS, 2045, config.policy, false, config.fixed);
  const s50 = computeShares(tco2050, BUCKETS, 2050, config.policy, false, config.fixed);
  const s55 = computeShares(tco2055, BUCKETS, 2055, config.policy, true, config.fixed);
  const annual = computePTTM(s45, s50, s55, config.policy);
  const result = computeStockEmissions(annual);

  const y = (yr: number) => result.years.find(r => r.year === yr)!;
  const shareIdx = (yr: number) => yr - 2025;

  it('every share table row covers 2025–2055 and columns sum to 1 each year', () => {
    for (const table of [SEGMENT_SHARES, CNG_SEGMENT_SHARES, LNG_SEGMENT_SHARES]) {
      for (const seg of SEGMENTS) expect(table[seg]).toHaveLength(31);
      for (let i = 0; i < 31; i++) {
        const sum = SEGMENTS.reduce((s, seg) => s + table[seg][i], 0);
        expect(sum).toBeCloseTo(1, 9);
      }
    }
    for (const app of APPLICATIONS) expect(APPLICATION_SHARES[app]).toHaveLength(31);
    for (let i = 0; i < 31; i++) {
      const sum = APPLICATIONS.reduce((s, app) => s + APPLICATION_SHARES[app][i], 0);
      expect(sum).toBeCloseTo(1, 9);
    }
  });

  it('TT 40-46T is non-zero (Excel share 1% in 2026 rising to 10%)', () => {
    expect(y(2026).stockBySegment['TT 40-46T']).toBeGreaterThan(0);
    expect(y(2045).stockBySegment['TT 40-46T']).toBeGreaterThan(0);
    expect(y(2026).salesBySegment['TT 40-46T']).toBeGreaterThan(0);
  });

  it('Diesel segment split follows the general share table (Excel method)', () => {
    for (const yr of [2026, 2040, 2055]) {
      const r = y(yr);
      for (const seg of SEGMENTS) {
        expect(r.stockBySegmentPT.Diesel[seg])
          .toBeCloseTo(r.stockByPT.Diesel * SEGMENT_SHARES[seg][shareIdx(yr)], 6);
      }
    }
  });

  it('CNG confined to Rigid 12–28.5T, LNG confined to TT bands (normalised shares)', () => {
    const r = y(2030);
    expect(r.stockBySegmentPT.CNG['Rigid 28.5-40T']).toBe(0);
    expect(r.stockBySegmentPT.CNG['TT 46-55T']).toBe(0);
    expect(r.stockBySegmentPT.LNG['Rigid 12-19T']).toBe(0);
    expect(r.stockBySegmentPT.CNG['Rigid 12-19T'])
      .toBeCloseTo(r.stockByPT.CNG * CNG_SEGMENT_SHARES['Rigid 12-19T'][shareIdx(2030)], 6);
    expect(r.stockBySegmentPT.LNG['TT 40-46T'])
      .toBeCloseTo(r.stockByPT.LNG * LNG_SEGMENT_SHARES['TT 40-46T'][shareIdx(2030)], 6);
  });

  it('segment and application splits reconcile to per-powertrain totals', () => {
    for (const r of result.years) {
      const totalStock = POWERTRAINS.reduce((s, pt) => s + r.stockByPT[pt], 0);
      const segStock = SEGMENTS.reduce((s, seg) => s + r.stockBySegment[seg], 0);
      const appStock = APPLICATIONS.reduce((s, app) => s + r.stockByApplication[app], 0);
      expect(segStock).toBeCloseTo(totalStock, 4);
      expect(appStock).toBeCloseTo(totalStock, 4);
      const totalSales = POWERTRAINS.reduce((s, pt) => s + r.salesByPT[pt], 0);
      const segSales = SEGMENTS.reduce((s, seg) => s + r.salesBySegment[seg], 0);
      const appSales = APPLICATIONS.reduce((s, app) => s + r.salesByApplication[app], 0);
      expect(segSales).toBeCloseTo(totalSales, 4);
      expect(appSales).toBeCloseTo(totalSales, 4);
    }
  });

  it('reproduces Excel Segmentwise/Applicationwise Stock 2026 within model tolerance', () => {
    // Excel 'Segmentwise Stock' / 'Applicationwise Stock' 2026 column.
    // Note: the dashboard seeds the whole end-2025 stock as diesel
    // (DIESEL_STOCK_END_2025 = 5,315,061 incl. Excel's 11,875 CNG / 368 LNG /
    // 149 BET), so early-year CNG/LNG stock is compared net of that 2025 seed.
    const r = y(2026);
    const excel = {
      dieselRigid12_19: 1344025.18,      // Diesel 5,376,100.7 × 0.25
      dieselTT40_46: 53761.01,           // Diesel × 0.01
      cngRigid12_19ExSeed: 9552.85,      // (CNG 25,248.99 − 11,875 seed) × 0.7142857
      lngTT46_55ExSeed: 348.15,          // (LNG 782.47 − 368 seed) × 0.84
      appMarketLoadTotal: 1567044.33,    // all-PT Market Load total
    };
    // Dashboard per-PT totals differ slightly from Excel (share-model approximation),
    // so allow 5%; the split logic itself is exact (verified above).
    const within = (actual: number, exp: number) =>
      expect(Math.abs(actual - exp) / exp).toBeLessThan(0.05);
    within(r.stockBySegmentPT.Diesel['Rigid 12-19T'], excel.dieselRigid12_19);
    within(r.stockBySegmentPT.Diesel['TT 40-46T'], excel.dieselTT40_46);
    within(r.stockBySegmentPT.CNG['Rigid 12-19T'], excel.cngRigid12_19ExSeed);
    within(r.stockBySegmentPT.LNG['TT 46-55T'], excel.lngTT46_55ExSeed);
    within(r.stockByApplication['Market Load'], excel.appMarketLoadTotal);
  });
});
