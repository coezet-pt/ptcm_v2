import type { ScenarioConfig } from '@/lib/types';
import { buildSeriesFromConfig } from '@/lib/sim/timeSeries';
import { PARAMETER_META } from '@/lib/constants/parameterMeta';
import { CONFIGURABLE_PARAM_GROUPS } from '@/lib/constants/configurableParams';
import { DELTA_KEYS } from '@/components/ParameterRow';

export interface ParamSummaryRow {
  group: string;
  label: string;
  unit: string;
  base: number;
  /** Per-period CAGRs as percentages (2026-30 … 2051-55). */
  cagrs: number[];
  value2055: number;
  /** Number of pinned per-year overrides (shown as a note). */
  pins: number;
}

/**
 * Flatten the user-configurable trajectory parameters into table rows:
 * 2026 base value, the six period CAGRs (%), and the projected 2055 value.
 * Used by the on-page summary table and the downloadable report.
 */
export function buildParamSummary(config: ScenarioConfig): ParamSummaryRow[] {
  const rows: ParamSummaryRow[] = [];
  for (const group of CONFIGURABLE_PARAM_GROUPS) {
    for (const { key, label } of group.params) {
      const p = config.parameters[key];
      if (!p) continue;
      const series = buildSeriesFromConfig(p, false);
      rows.push({
        group: group.title,
        label,
        unit: PARAMETER_META[key]?.unit ?? '',
        base: p.baseValue,
        cagrs: DELTA_KEYS.map(dk => p[dk] * 100),
        value2055: series.at(-1) ?? p.baseValue,
        pins: p.overrides ? Object.keys(p.overrides).length : 0,
      });
    }
  }
  return rows;
}

export const PARAM_PERIOD_LABELS = ['2026-30', '2031-35', '2036-40', '2041-45', '2046-50', '2051-55'];

export const fmtNum = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });
