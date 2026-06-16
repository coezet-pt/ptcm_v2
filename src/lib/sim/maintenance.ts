/**
 * Maintenance defaults — converts the engine's baseline maintenance
 * trajectories (Excel B-sheets) into editable ParameterConfig form so the
 * per-bucket Maintenance editor and the simulation engine share one source.
 *
 * Diesel grows at a uniform 4%/yr (Excel rows 55). BET/FCET follow per-year
 * trajectories captured as 4-point knots [2025,2045,2050,2055] in
 * BUCKET_OPEX_CALIBRATION; the derived per-period CAGRs below reproduce the
 * engine's growFromKnots interpolation to floating-point precision.
 */
import type { ParameterConfig } from '@/lib/types';
import { BUCKET_OPEX_CALIBRATION, type Bucket } from '@/lib/constants/extracted';

export type MaintMetric = 'diesel' | 'bet' | 'fcet';

export const MAINT_METRICS: { key: MaintMetric; label: string }[] = [
  { key: 'diesel', label: 'Diesel Maintenance' },
  { key: 'bet',    label: 'BET Aggregates (incl. battery repl.)' },
  { key: 'fcet',   label: 'FCET Aggregates (incl. battery+FC repl.)' },
];

const DIESEL_MAINT_CAGR = 0.04;

/** Per-period CAGRs that reproduce growFromKnots for a 4-point knot series. */
function knotsToConfig(knots: readonly [number, number, number, number]): ParameterConfig {
  const [k25, k45, k50, k55] = knots;
  const cagr2545 = Math.pow(k45 / k25, 1 / 20) - 1;
  const cagr4650 = Math.pow(k50 / k45, 1 / 5) - 1;
  const cagr5155 = Math.pow(k55 / k50, 1 / 5) - 1;
  return {
    baseValue: k25,
    d2530: cagr2545,
    d3135: cagr2545,
    d3640: cagr2545,
    d4145: cagr2545,
    d4650: cagr4650,
    d5155: cagr5155,
  };
}

/**
 * Baseline maintenance config (₹/km) for a bucket × metric. Editing from this
 * preserves BAU results exactly; user edits then flow through the TCO engine.
 */
export function defaultMaintConfig(metric: MaintMetric, bucket: Bucket): ParameterConfig {
  const cal = BUCKET_OPEX_CALIBRATION[bucket.id];
  if (metric === 'bet')  return knotsToConfig(cal.maintBET);
  if (metric === 'fcet') return knotsToConfig(cal.maintFCET);
  // diesel: 2025 base × 4%/yr across all periods
  return {
    baseValue: bucket.maintDieselPerKm,
    d2530: DIESEL_MAINT_CAGR,
    d3135: DIESEL_MAINT_CAGR,
    d3640: DIESEL_MAINT_CAGR,
    d4145: DIESEL_MAINT_CAGR,
    d4650: DIESEL_MAINT_CAGR,
    d5155: DIESEL_MAINT_CAGR,
  };
}
