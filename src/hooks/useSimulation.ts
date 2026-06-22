/**
 * Orchestrating hook: timeSeries → tco → choiceModel → pttm → stockEmissions
 * with 300ms debounce and stable memoization [fix #6].
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import type { ScenarioConfig, SimulationResult } from '@/lib/types';
import { BUCKETS, START_OF_SUPPLY, PTTM_PILOT_SHARE, POWERTRAINS } from '@/lib/constants/extracted';
import { buildTimeSeries, START_YEAR } from '@/lib/sim/timeSeries';
import { computeTCO, greyH2FractionForYear } from '@/lib/sim/tco';
import { computeShares } from '@/lib/sim/choiceModel';
import { computePTTM } from '@/lib/sim/pttm';
import { computeStockEmissions } from '@/lib/sim/stockEmissions';

/** Stable JSON stringify — sorts keys recursively [fix #6] */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + sorted.map(k => JSON.stringify(k) + ':' + stableStringify((obj as any)[k])).join(',') + '}';
}

function runSimulation(config: ScenarioConfig): SimulationResult {
  const ts = buildTimeSeries(config.parameters, config.policy);
  const tco2045 = computeTCO(ts, config.policy, BUCKETS, 2045, config.fixed, config.segmentBasePrices);
  const tco2050 = computeTCO(ts, config.policy, BUCKETS, 2050, config.fixed, config.segmentBasePrices);
  const tco2055 = computeTCO(ts, config.policy, BUCKETS, 2055, config.fixed, config.segmentBasePrices);
  const shares2045 = computeShares(tco2045, BUCKETS, 2045, config.policy, false, config.fixed);
  const shares2050 = computeShares(tco2050, BUCKETS, 2050, config.policy, false, config.fixed);
  // 2055 is the Excel '100% ZET' anchor — diesel/CNG/LNG excluded by design
  const shares2055 = computeShares(tco2055, BUCKETS, 2055, config.policy, true, config.fixed);
  const annualSales = computePTTM(shares2045, shares2050, shares2055, config.policy);
  // Grey-H2 supply fraction per year (2026…2055) — feeds H2 emission factors so
  // a grey/green blend raises CO2 as well as lowering H2 cost.
  const greyH2ByYear = Array.from({ length: 30 }, (_, i) =>
    greyH2FractionForYear(ts, config.policy, START_YEAR + i));
  const result = computeStockEmissions(annualSales, greyH2ByYear);

  // 🔬 Diagnostic dump
  if (typeof window !== 'undefined') {
    console.group('🔬 PTCM Diagnostic Dump — BAU 2055');

    // Layer 1: choice model output
    console.group('Layer 1 — Choice Model 2055 shares');
    console.table(
      Object.fromEntries(
        Object.entries(shares2055).map(([bucket, pts]) => [
          bucket,
          Object.fromEntries(
            Object.entries(pts).map(([pt, v]) => [pt, (v as number).toExponential(3)])
          )
        ])
      )
    );
    console.groupEnd();

    // Layer 2: aggregated 2055 share targets
    console.group('Layer 2 — Aggregated 2055 share targets passed to PTTM');
    const agg2055: Record<string, number> = {};
    for (const pt of ['Diesel','CNG','LNG','BET','H2-ICE','H2-FCET']) {
      agg2055[pt] = Object.entries(shares2055).reduce((sum, [bid, pts]) => {
        const bucket = BUCKETS.find(b => b.id === bid);
        return sum + ((pts as any)[pt] || 0) * (bucket?.tivShare2045 || 0);
      }, 0);
    }
    console.table(agg2055);
    console.groupEnd();

    // Layer 3: Gompertz/Weibull params for B12
    console.group('Layer 3 — Gompertz/Weibull params for B12');
    for (const pt of ['CNG','LNG','BET','H2-ICE','H2-FCET']) {
      console.log(pt, {
        startYear: (START_OF_SUPPLY as any)['28T Rigid']?.[pt],
        AB_2055: (shares2055 as any).B12?.[pt],
        Z_2045: (shares2045 as any).B12?.[pt],
        W_pilot: (PTTM_PILOT_SHARE as any)[pt] ?? 'n/a (Weibull)',
      });
    }
    console.groupEnd();

    // Layer 4: PTTM annual share output
    console.group('Layer 4 — PTTM share output for years 2030, 2040, 2045, 2055');
    for (const year of [2030, 2040, 2045, 2055]) {
      const idx = year - START_YEAR;
      const entry = annualSales[idx];
      if (entry) {
        console.log(year, { share: { ...entry.share }, sales: { ...entry.sales } });
      } else {
        console.log(year, 'no data');
      }
    }
    console.groupEnd();

    console.groupEnd();

    // Choice model verification
    if ((window as any).__SIM_DEBUG__) {
      console.group('🎯 Choice model verification — B1 2045');
      const expectedB1: Record<string, number> = {
        Diesel: 0.1652, CNG: 0.1060, LNG: 0.0951,
        BET: 0.3640, 'H2-ICE': 0.1026, 'H2-FCET': 0.1671,
      };
      for (const [pt, expShare] of Object.entries(expectedB1)) {
        const actual = shares2045['B1']?.[pt as any] ?? 0;
        const ok = Math.abs(actual - expShare) < 0.05;
        console.log(`${pt}: expected ${(expShare*100).toFixed(1)}%, actual ${(actual*100).toFixed(1)}%`, ok ? '✅' : '❌');
      }
      console.groupEnd();
    }

    // PTTM verification block
    if ((window as any).__SIM_DEBUG__) {
      console.group('🔬 PTTM verification — BAU expected values');
      const expected: Record<number, Record<string, number>> = {
        2030: { BET: 0.0077, 'H2-ICE': 0.0006, 'H2-FCET': 0.0001, CNG: 0.0232, LNG: 0.0013 },
        2045: { BET: 0.5693, 'H2-ICE': 0.0677, 'H2-FCET': 0.0612, CNG: 0.1183, LNG: 0.0086 },
        2055: { BET: 0.6995, 'H2-ICE': 0.1187, 'H2-FCET': 0.1818, CNG: 0.0000, LNG: 0.0000 },
      };
      for (const [yearStr, exp] of Object.entries(expected)) {
        const yr = +yearStr;
        const idx = yr - START_YEAR;
        const yearData = result.years[idx];
        console.log(`Year ${yr}:`);
        if (yearData) {
          for (const [pt, expVal] of Object.entries(exp)) {
            const actual = yearData.shareByPT[pt as any] ?? 0;
            const diff = Math.abs(actual - expVal);
            const ok = diff < 0.02;
            console.log(`  ${pt}: expected ${(expVal*100).toFixed(2)}%, actual ${(actual*100).toFixed(2)}%`, ok ? '✅' : '❌');
          }
        } else {
          console.log('  no data');
        }
      }
      console.groupEnd();
    }
  }

  return result;
}

export function useSimulation(config: ScenarioConfig): {
  result: SimulationResult | null;
  isComputing: boolean;
} {
  const configKey = useMemo(() => stableStringify(config), [config]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setIsComputing(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const r = runSimulation(config);
        setResult(r);
      } catch (e) {
        console.error('[useSimulation] Error:', e);
      } finally {
        setIsComputing(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  return { result, isComputing };
}

