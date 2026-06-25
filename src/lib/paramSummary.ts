import type { ScenarioConfig } from '@/lib/types';
import { buildSeriesFromConfig } from '@/lib/sim/timeSeries';
import { PARAMETER_META } from '@/lib/constants/parameterMeta';
import { CONFIGURABLE_PARAM_GROUPS } from '@/lib/constants/configurableParams';
import {
  DEFAULT_BATTERY_LIFE_CYCLES, DEFAULT_FUEL_CELL_LIFE_HOURS, ZET_GVW_CLASSES,
} from '@/lib/constants/extracted';
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

// ── Non-trajectory inputs (single fixed values / categorical choices) ──

export interface OtherInputRow {
  label: string;
  value: string;
}
export interface OtherInputSection {
  title: string;
  rows: OtherInputRow[];
}

const H2_MIX_LABELS: Record<string, string> = {
  green_only: 'Green only',
  blend_2046_green: 'Grey/green blend',
  cheapest: 'Lowest cost option',
};

/**
 * The remaining user-configurable sidebar inputs that don't have a year-by-year
 * trajectory (Key Aggregate Life, Hydrogen Source Mix, Funding, Policy support).
 * Shown as a simple name/value list below the trajectory table. Reflects the
 * applied config.
 */
export function buildOtherInputs(config: ScenarioConfig): OtherInputSection[] {
  const { fixed, policy } = config;
  const sections: OtherInputSection[] = [];

  // Key Aggregate Life
  sections.push({
    title: 'Key Aggregate Life',
    rows: [
      { label: 'Battery Life', value: `${fmtNum(fixed.battery_life_cycles ?? DEFAULT_BATTERY_LIFE_CYCLES)} cycles` },
      { label: 'Fuel Cell Life', value: `${fmtNum(fixed.fuel_cell_life_hours ?? DEFAULT_FUEL_CELL_LIFE_HOURS)} hrs` },
    ],
  });

  // Hydrogen Source Mix
  const h2Rows: OtherInputRow[] = [
    { label: 'Hydrogen source', value: H2_MIX_LABELS[policy.h2_source_mix] ?? policy.h2_source_mix },
  ];
  if (policy.h2_source_mix === 'blend_2046_green') {
    const mode = policy.grey_h2_blend_mode ?? 'uniform';
    if (mode === 'uniform') {
      h2Rows.push({
        label: 'Grey share (2026–2045)',
        value: `${Math.round((policy.grey_h2_blend_uniform ?? 0) * 100)}%`,
      });
    } else {
      const bands = policy.grey_h2_blend_bands ?? {};
      const parts = DELTA_KEYS.slice(0, 4).map(
        (k, i) => `${PARAM_PERIOD_LABELS[i]} ${Math.round((bands[k] ?? 0) * 100)}%`,
      );
      h2Rows.push({ label: 'Grey share by block', value: parts.join(' · ') });
    }
  }
  sections.push({ title: 'Hydrogen Source Mix', rows: h2Rows });

  // Funding
  const nonZetTenure = fixed.loan_tenure_years_nonzet ?? policy.loan_tenure_years;
  sections.push({
    title: 'Funding',
    rows: [
      { label: 'Non-ZETs — interest rate', value: `${(fixed.interest_rate_ice * 100).toFixed(1)}%` },
      { label: 'Non-ZETs — loan tenure', value: `${fmtNum(nonZetTenure)} yrs` },
      { label: 'ZETs — interest rate', value: `${(policy.interest_rate_zet * 100).toFixed(1)}%` },
      { label: 'ZETs — loan tenure', value: `${fmtNum(policy.loan_tenure_years)} yrs` },
    ],
  });

  // Policy support — additional GVW for ZETs, per size class
  const gvw = policy.zet_additional_gvw_kg ?? {};
  sections.push({
    title: 'Policy support — additional GVW for ZETs',
    rows: ZET_GVW_CLASSES.map(cls => ({
      label: cls,
      value: `${fmtNum(gvw[cls] ?? 0)} kg`,
    })),
  });

  return sections;
}
