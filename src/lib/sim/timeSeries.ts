/**
 * Time-series projection — builds year-by-year arrays (2026–2055)
 * for all 15 cost parameters using compound growth per period.
 */
import type { ParameterConfig, ParameterKey, PolicyConfig, ScenarioConfig } from '@/lib/types';

export const START_YEAR = 2026;
export const END_YEAR = 2055;
export const YEAR_COUNT = END_YEAR - START_YEAR + 1; // 30

const GROWTH_RATE_KEYS: ParameterKey[] = [
  'diesel_vehicle_growth',
  'engine_trans_growth',
  'e_powertrain_growth',
];

/**
 * Build a year-by-year array (2026–2055) for a single parameter config:
 * compound-grow from baseValue through the six CAGR periods. The first period
 * (d2530) spans 2027–2030 — four steps from the 2026 base. Growth-rate
 * configs start at 1.0 (cumulative multiplier). A spot-year override pins the
 * absolute value for that year; subsequent years compound from the pinned value.
 */
export function buildSeriesFromConfig(
  p: ParameterConfig,
  isGrowthRate = false,
): number[] {
  const arr: number[] = new Array(YEAR_COUNT);
  arr[0] = isGrowthRate ? 1.0 : p.baseValue;

  for (let i = 1; i < YEAR_COUNT; i++) {
    const year = START_YEAR + i;
    let delta: number;
    if (year <= 2030)      delta = p.d2530;
    else if (year <= 2035) delta = p.d3135;
    else if (year <= 2040) delta = p.d3640;
    else if (year <= 2045) delta = p.d4145;
    else if (year <= 2050) delta = p.d4650;
    else                   delta = p.d5155;

    arr[i] = arr[i - 1] * (1 + delta);

    if (!isGrowthRate && p.overrides && p.overrides[year] !== undefined) {
      arr[i] = p.overrides[year];
    }
  }

  return arr;
}

/**
 * For each parameter, compound-grow from baseValue through 4 delta periods.
 * Growth-rate keys (diesel_vehicle_growth etc.) start at 1.0 and store
 * cumulative multiplier rather than absolute values.
 *
 * When policy.diesel_price_5pct_yoy_after_2045 is true, the d5155 delta
 * for diesel_price_per_l is overridden to 0.05.
 */
export function buildTimeSeries(
  params: ScenarioConfig['parameters'],
  policy?: PolicyConfig,
): Record<ParameterKey, number[]> {
  const result = {} as Record<ParameterKey, number[]>;

  for (const key of Object.keys(params) as ParameterKey[]) {
    let p = params[key];
    const isGrowthRate = GROWTH_RATE_KEYS.includes(key);

    // Override diesel price growth to 5%/yr for both post-2045 periods when set.
    if (policy?.diesel_price_5pct_yoy_after_2045 && key === 'diesel_price_per_l') {
      p = { ...p, d4650: 0.05, d5155: 0.05 };
    }

    result[key] = buildSeriesFromConfig(p, isGrowthRate);
  }

  return result;
}

/** Get value at a specific year from a time-series array. */
export function getValueAtYear(series: number[], year: number): number {
  const idx = year - START_YEAR;
  if (idx < 0) return series[0];
  if (idx >= YEAR_COUNT) return series[YEAR_COUNT - 1];
  return series[idx];
}

/** Convenience: year index from calendar year */
export function yearIndex(year: number): number {
  return Math.max(0, Math.min(year - START_YEAR, YEAR_COUNT - 1));
}
