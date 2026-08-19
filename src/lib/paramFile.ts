import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ScenarioConfig, ParameterKey, H2SourceMix, H2BlendMode } from '@/lib/types';
import { PARAMETER_META } from '@/lib/constants/parameterMeta';
import { CONFIGURABLE_PARAM_GROUPS } from '@/lib/constants/configurableParams';
import { ZET_GVW_CLASSES, TOLL_WAIVER_KEYS, TOLL_WAIVER_LABELS } from '@/lib/constants/extracted';
import { buildSeriesFromConfig } from '@/lib/sim/timeSeries';

/**
 * Import/export of the user-configurable sidebar parameters as a single flat
 * table, usable as CSV or Excel. One spec drives both directions so the file
 * format and the dashboard can never drift apart.
 *
 * Layout mirrors the on-screen "Configured Parameters (Inputs)" table
 * (one row per editable value):
 *   Parameter | Unit | 2026 | CAGR 2026-30 … 2051-55 | 2055 (projected) | Section | Key
 *
 * - Trajectory params (fuel/energy + key aggregate costs) use the 2026 column
 *   for the base value and the six CAGR columns (entered as %/yr). The 2055
 *   column is the projected value — informational on export, ignored on import.
 * - Scalars / toggles (battery life, funding rates, H2 source mix, GVW…) use
 *   only the 2026 column; their CAGR and 2055 cells stay blank.
 *
 * On import the `Key` column is the source of truth, so rows may be reordered.
 * Blank cells keep the current value, and per-year "pins" are preserved (they
 * are intentionally not represented in the file). Files downloaded before the
 * layout change (a "Value (2026)" column) still import fine.
 */

const PERIOD_KEYS = ['d2530', 'd3135', 'd3640', 'd4145', 'd4650', 'd5155'] as const;
const PERIOD_LABELS = ['2026-30', '2031-35', '2036-40', '2041-45', '2046-50', '2051-55'] as const;

export const COL = {
  section: 'Section',
  parameter: 'Parameter',
  key: 'Key',
  unit: 'Unit',
  value: '2026',
  value2055: '2055 (projected)',
} as const;

/** Header of files downloaded before the layout matched the on-screen table. */
const LEGACY_VALUE_COL = 'Value (2026)';

const CAGR_COLS = PERIOD_LABELS.map(l => `CAGR ${l} (%/yr)`);

export const PARAM_FILE_HEADERS = [
  COL.parameter, COL.unit, COL.value, ...CAGR_COLS, COL.value2055, COL.section, COL.key,
];

const H2_SOURCE_VALUES: H2SourceMix[] = ['green_only', 'blend_2046_green', 'cheapest'];
const H2_BLEND_MODES: H2BlendMode[] = ['uniform', 'bands'];

type Cell = number | string | undefined;
interface Parsed { value?: Cell; cagrs?: (number | undefined)[] }

interface FieldSpec {
  section: string;
  label: string;
  key: string;
  unit: string;
  /** Read the export values from a config. cagrs is a length-6 %/yr array and
   *  value2055 the projected end value for trajectory rows; both are undefined
   *  for scalar rows. value2055 is informational only — ignored on import. */
  read: (c: ScenarioConfig) => { value: Cell; cagrs?: number[]; value2055?: number };
  /** Apply parsed file values onto a (mutable clone of a) config. */
  write: (c: ScenarioConfig, p: Parsed) => void;
}

// ── Trajectory rows (11 params) — base + 6 CAGRs, pins preserved ──────────────
const trajectorySpecs: FieldSpec[] = CONFIGURABLE_PARAM_GROUPS.flatMap(group =>
  group.params.map(({ key, label }): FieldSpec => ({
    section: group.title,
    label,
    key,
    unit: PARAMETER_META[key]?.unit ?? '',
    read: c => {
      const p = c.parameters[key];
      const series = buildSeriesFromConfig(p, false);
      // Costs export at two decimals, matching how they display everywhere else.
      return {
        value: round2(p.baseValue),
        cagrs: PERIOD_KEYS.map(pk => round2(p[pk] * 100)),
        value2055: round2(series.at(-1) ?? p.baseValue),
      };
    },
    write: (c, parsed) => {
      const p = c.parameters[key];
      const v = toNum(parsed.value);
      if (v !== undefined) p.baseValue = v;
      parsed.cagrs?.forEach((cg, i) => {
        if (cg !== undefined) p[PERIOD_KEYS[i]] = cg / 100;
      });
    },
  })),
);

// ── Scalar / toggle rows (Key Aggregate Life, Funding, H2 mix, GVW) ───────────
function numberSpec(
  section: string, label: string, key: string, unit: string,
  get: (c: ScenarioConfig) => number,
  set: (c: ScenarioConfig, v: number) => void,
  /** scale applied to the stored value for display (e.g. 100 for a 0–1 rate shown as %). */
  scale = 1,
): FieldSpec {
  return {
    section, label, key, unit,
    read: c => ({ value: round(get(c) * scale) }),
    write: (c, p) => {
      const v = toNum(p.value);
      if (v !== undefined) set(c, v / scale);
    },
  };
}

function enumSpec<T extends string>(
  section: string, label: string, key: string,
  allowed: readonly T[],
  get: (c: ScenarioConfig) => T,
  set: (c: ScenarioConfig, v: T) => void,
): FieldSpec {
  return {
    section, label, key, unit: allowed.join(' | '),
    read: c => ({ value: get(c) }),
    write: (c, p) => {
      const raw = typeof p.value === 'string' ? p.value.trim() : p.value;
      if (allowed.includes(raw as T)) set(c, raw as T);
    },
  };
}

const FUNDING = 'Funding';
const LIFE = 'Key Aggregate Life';
const H2 = 'Hydrogen Source Mix';
const GVW = 'Policy support — GVW for ZET';
const TOLL = 'Policy support — Toll waiver';
const MATURITY = 'Powertrain maturity';
const SUBSIDY = 'Policy support — Electricity subsidy';

const scalarSpecs: FieldSpec[] = [
  numberSpec(LIFE, 'Battery Life', 'fixed.battery_life_cycles', 'cycles',
    c => c.fixed.battery_life_cycles, (c, v) => { c.fixed.battery_life_cycles = v; }),
  numberSpec(LIFE, 'Fuel Cell Life', 'fixed.fuel_cell_life_hours', 'hrs',
    c => c.fixed.fuel_cell_life_hours, (c, v) => { c.fixed.fuel_cell_life_hours = v; }),

  numberSpec(FUNDING, 'Funding (non-ZETs) — Rate', 'fixed.interest_rate_ice', '%',
    c => c.fixed.interest_rate_ice, (c, v) => { c.fixed.interest_rate_ice = v; }, 100),
  numberSpec(FUNDING, 'Funding (non-ZETs) — Tenure', 'fixed.loan_tenure_years_nonzet', 'yrs',
    c => c.fixed.loan_tenure_years_nonzet ?? c.policy.loan_tenure_years,
    (c, v) => { c.fixed.loan_tenure_years_nonzet = v; }),
  numberSpec(FUNDING, 'Funding (ZETs) — Rate', 'policy.interest_rate_zet', '%',
    c => c.policy.interest_rate_zet, (c, v) => { c.policy.interest_rate_zet = v; }, 100),
  numberSpec(FUNDING, 'Funding (ZETs) — Tenure', 'policy.loan_tenure_years', 'yrs',
    c => c.policy.loan_tenure_years, (c, v) => { c.policy.loan_tenure_years = v; }),

  enumSpec(H2, 'Hydrogen source mix', 'policy.h2_source_mix', H2_SOURCE_VALUES,
    c => c.policy.h2_source_mix, (c, v) => { c.policy.h2_source_mix = v; }),
  enumSpec(H2, 'Grey/green blend mode', 'policy.grey_h2_blend_mode', H2_BLEND_MODES,
    c => c.policy.grey_h2_blend_mode ?? 'uniform', (c, v) => { c.policy.grey_h2_blend_mode = v; }),
  numberSpec(H2, 'Grey H2 share — single %', 'policy.grey_h2_blend_uniform', '%',
    c => c.policy.grey_h2_blend_uniform ?? 0, (c, v) => { c.policy.grey_h2_blend_uniform = clamp01(v); }, 100),

  // Grey H2 share by 5-year block (only the first four periods, 2026–2045)
  ...PERIOD_KEYS.slice(0, 4).map((pk, i): FieldSpec =>
    numberSpec(H2, `Grey H2 share — ${PERIOD_LABELS[i]}`, `policy.grey_h2_blend_bands.${pk}`, '%',
      c => c.policy.grey_h2_blend_bands?.[pk] ?? 0,
      (c, v) => {
        c.policy.grey_h2_blend_bands = { ...(c.policy.grey_h2_blend_bands ?? {}), [pk]: clamp01(v) };
      }, 100)),

  // Additional GVW (kg) for ZETs, per size class
  ...ZET_GVW_CLASSES.map((cls): FieldSpec =>
    numberSpec(GVW, `Additional GVW — ${cls}`, `policy.zet_additional_gvw_kg.${cls}`, 'kg',
      c => c.policy.zet_additional_gvw_kg?.[cls] ?? 0,
      (c, v) => {
        c.policy.zet_additional_gvw_kg = { ...(c.policy.zet_additional_gvw_kg ?? {}), [cls]: v };
      })),

  // Powertrain maturity year — Excel 'No change with year' P65:U65. Drives the
  // 2050 and 2055 Estimation-sheet share adjustments (see sim/adjustments.ts).
  numberSpec(MATURITY, 'BET maturity year', 'policy.bet_maturity_year', 'year',
    c => c.policy.bet_maturity_year, (c, v) => { c.policy.bet_maturity_year = Math.round(v); }),
  numberSpec(MATURITY, 'H2-ICE maturity year', 'policy.h2ice_maturity_year', 'year',
    c => c.policy.h2ice_maturity_year, (c, v) => { c.policy.h2ice_maturity_year = Math.round(v); }),
  numberSpec(MATURITY, 'H2-FCET maturity year', 'policy.fcet_maturity_year', 'year',
    c => c.policy.fcet_maturity_year, (c, v) => { c.policy.fcet_maturity_year = Math.round(v); }),

  // Electricity subsidy for BET charging — dashboard-only lever (the workbook
  // has no subsidy term); applies up to and including the end year.
  numberSpec(SUBSIDY, 'Electricity subsidy', 'policy.electricity_subsidy_per_kwh', 'INR/kWh',
    c => c.policy.electricity_subsidy_per_kwh,
    (c, v) => { c.policy.electricity_subsidy_per_kwh = Math.max(0, v); }),
  numberSpec(SUBSIDY, 'Electricity subsidy — applies until', 'policy.electricity_subsidy_end_year', 'year',
    c => c.policy.electricity_subsidy_end_year,
    (c, v) => { c.policy.electricity_subsidy_end_year = Math.round(v); }),

  // Toll waiver for ZETs — share of ZET toll waived (Excel $AL$276/$AL$277),
  // one value per model decision point (2045 / 2050 / 2055).
  ...TOLL_WAIVER_KEYS.map((pk, i): FieldSpec =>
    numberSpec(TOLL, `Toll waiver for ZETs — ${TOLL_WAIVER_LABELS[i]}`, `policy.toll_waiver_bands.${pk}`, '%',
      c => c.policy.toll_waiver_bands?.[pk] ?? 0,
      (c, v) => {
        c.policy.toll_waiver_bands = { ...(c.policy.toll_waiver_bands ?? {}), [pk]: clamp01(v) };
      }, 100)),
];

const SPECS: FieldSpec[] = [...trajectorySpecs, ...scalarSpecs];
const SPEC_BY_KEY = new Map(SPECS.map(s => [s.key.toLowerCase(), s]));

// ── Helpers ──────────────────────────────────────────────────────────────────
function round(n: number): number {
  return Number.isFinite(n) ? Number(n.toFixed(4)) : 0;
}
function round2(n: number): number {
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function toNum(v: Cell): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : undefined;
}

// ── Export: config → row objects ──────────────────────────────────────────────
export function buildParamRows(config: ScenarioConfig): Record<string, string | number>[] {
  return SPECS.map(spec => {
    const { value, cagrs, value2055 } = spec.read(config);
    const row: Record<string, string | number> = {
      [COL.parameter]: spec.label,
      [COL.unit]: spec.unit,
      [COL.value]: value ?? '',
    };
    CAGR_COLS.forEach((col, i) => { row[col] = cagrs?.[i] ?? ''; });
    row[COL.value2055] = value2055 ?? '';
    row[COL.section] = spec.section;
    row[COL.key] = spec.key;
    return row;
  });
}

// ── Import: row records → merged config ───────────────────────────────────────
/** Apply parsed file records onto a clone of `base`, returning a new config. */
export function applyParamRows(
  records: Record<string, Cell>[],
  base: ScenarioConfig,
): { config: ScenarioConfig; applied: number; unknownKeys: string[] } {
  const next = structuredClone(base);
  const unknownKeys: string[] = [];
  let applied = 0;

  for (const rec of records) {
    const keyRaw = String(rec[COL.key] ?? '').trim();
    if (!keyRaw) continue;
    const spec = SPEC_BY_KEY.get(keyRaw.toLowerCase());
    if (!spec) { unknownKeys.push(keyRaw); continue; }
    const cagrs = CAGR_COLS.map(col => toNum(rec[col]));
    // Prefer the current "2026" column; fall back to the legacy header so
    // files downloaded before the layout change still import.
    const value = COL.value in rec ? rec[COL.value] : rec[LEGACY_VALUE_COL];
    spec.write(next, { value, cagrs });
    applied++;
  }

  return { config: next, applied, unknownKeys };
}

// ── File generation / download ────────────────────────────────────────────────
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Numeric columns that display with two decimals (trajectory/cost rows only). */
const TWO_DEC_COLS = [COL.value, ...CAGR_COLS, COL.value2055];

/** A row is a trajectory (cost) row iff its CAGR cells are filled in. */
const isTrajectoryRow = (row: Record<string, string | number>) => row[CAGR_COLS[0]] !== '';

export function downloadParamsCsv(config: ScenarioConfig, filename = 'PTCM_parameters.csv'): void {
  // Cost cells are written as "99.00"-style strings so the CSV shows two
  // decimals everywhere, matching the dashboard tables.
  const rows = buildParamRows(config).map(row => {
    if (!isTrajectoryRow(row)) return row;
    const out = { ...row };
    for (const col of TWO_DEC_COLS) {
      if (typeof out[col] === 'number') out[col] = (out[col] as number).toFixed(2);
    }
    return out;
  });
  const csv = Papa.unparse({ fields: PARAM_FILE_HEADERS, data: rows });
  // Prepend a UTF-8 BOM so Excel renders Unicode (₹, em-dashes) correctly
  // instead of mojibake when it opens the file.
  triggerDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename);
}

export function downloadParamsXlsx(config: ScenarioConfig, filename = 'PTCM_parameters.xlsx'): void {
  const rows = buildParamRows(config);
  const ws = XLSX.utils.json_to_sheet(rows, { header: PARAM_FILE_HEADERS });
  ws['!cols'] = [{ wch: 34 }, { wch: 12 }, { wch: 12 },
    ...CAGR_COLS.map(() => ({ wch: 14 })),
    { wch: 14 }, { wch: 22 }, { wch: 34 }];
  // Cost cells stay numeric but get a 0.00 number format so Excel shows two
  // decimals (99.00) without "number stored as text" warnings.
  rows.forEach((row, r) => {
    if (!isTrajectoryRow(row)) return;
    for (const col of TWO_DEC_COLS) {
      const c = PARAM_FILE_HEADERS.indexOf(col);
      const cell = ws[XLSX.utils.encode_cell({ r: r + 1, c })];
      if (cell && cell.t === 'n') cell.z = '0.00';
    }
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Parameters');
  XLSX.writeFile(wb, filename);
}

// ── File parsing ──────────────────────────────────────────────────────────────
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

async function parseFileToRecords(file: File): Promise<Record<string, Cell>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buf = await readFileAsArrayBuffer(file);
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('The workbook has no sheets.');
    return XLSX.utils.sheet_to_json<Record<string, Cell>>(ws, { defval: '' });
  }
  // default: CSV / text
  const text = await readFileAsText(file);
  const out = Papa.parse<Record<string, Cell>>(text, { header: true, skipEmptyLines: true });
  return out.data;
}

/** Parse an uploaded CSV/Excel file and merge it onto `base`. */
export async function importParamsFile(
  file: File,
  base: ScenarioConfig,
): Promise<{ config: ScenarioConfig; applied: number; unknownKeys: string[] }> {
  const records = await parseFileToRecords(file);
  if (!records.length) throw new Error('No rows found in the file.');
  const first = records[0];
  if (!(COL.key in first)) {
    throw new Error(`Missing the "${COL.key}" column. Please use a file downloaded from this dashboard.`);
  }
  const result = applyParamRows(records, base);
  if (result.applied === 0) {
    throw new Error('No recognised parameters were found in the file.');
  }
  return result;
}
