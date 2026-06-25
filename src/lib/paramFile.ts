import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ScenarioConfig, ParameterKey, H2SourceMix, H2BlendMode } from '@/lib/types';
import { PARAMETER_META } from '@/lib/constants/parameterMeta';
import { CONFIGURABLE_PARAM_GROUPS } from '@/lib/constants/configurableParams';
import { ZET_GVW_CLASSES } from '@/lib/constants/extracted';

/**
 * Import/export of the user-configurable sidebar parameters as a single flat
 * table, usable as CSV or Excel. One spec drives both directions so the file
 * format and the dashboard can never drift apart.
 *
 * Layout (one row per editable value):
 *   Section | Parameter | Key | Unit | Value (2026) | CAGR 2026-30 … 2051-55
 *
 * - Trajectory params (fuel/energy + key aggregate costs) use the Value column
 *   for the 2026 base and the six CAGR columns (entered as %/yr).
 * - Scalars / toggles (battery life, funding rates, H2 source mix, GVW…) use
 *   only the Value column; their CAGR cells stay blank.
 *
 * On import the `Key` column is the source of truth, so rows may be reordered.
 * Blank cells keep the current value, and per-year "pins" are preserved (they
 * are intentionally not represented in the file).
 */

const PERIOD_KEYS = ['d2530', 'd3135', 'd3640', 'd4145', 'd4650', 'd5155'] as const;
const PERIOD_LABELS = ['2026-30', '2031-35', '2036-40', '2041-45', '2046-50', '2051-55'] as const;

export const COL = {
  section: 'Section',
  parameter: 'Parameter',
  key: 'Key',
  unit: 'Unit',
  value: 'Value (2026)',
} as const;

const CAGR_COLS = PERIOD_LABELS.map(l => `CAGR ${l} (%/yr)`);

export const PARAM_FILE_HEADERS = [
  COL.section, COL.parameter, COL.key, COL.unit, COL.value, ...CAGR_COLS,
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
  /** Read the export values from a config. cagrs is a length-6 %/yr array for
   *  trajectory rows, or undefined for scalar rows. */
  read: (c: ScenarioConfig) => { value: Cell; cagrs?: number[] };
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
      return { value: p.baseValue, cagrs: PERIOD_KEYS.map(pk => round(p[pk] * 100)) };
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
];

const SPECS: FieldSpec[] = [...trajectorySpecs, ...scalarSpecs];
const SPEC_BY_KEY = new Map(SPECS.map(s => [s.key.toLowerCase(), s]));

// ── Helpers ──────────────────────────────────────────────────────────────────
function round(n: number): number {
  return Number.isFinite(n) ? Number(n.toFixed(4)) : 0;
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
    const { value, cagrs } = spec.read(config);
    const row: Record<string, string | number> = {
      [COL.section]: spec.section,
      [COL.parameter]: spec.label,
      [COL.key]: spec.key,
      [COL.unit]: spec.unit,
      [COL.value]: value ?? '',
    };
    CAGR_COLS.forEach((col, i) => { row[col] = cagrs?.[i] ?? ''; });
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
    spec.write(next, { value: rec[COL.value], cagrs });
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

export function downloadParamsCsv(config: ScenarioConfig, filename = 'PTCM_parameters.csv'): void {
  const csv = Papa.unparse({ fields: PARAM_FILE_HEADERS, data: buildParamRows(config) });
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}

export function downloadParamsXlsx(config: ScenarioConfig, filename = 'PTCM_parameters.xlsx'): void {
  const ws = XLSX.utils.json_to_sheet(buildParamRows(config), { header: PARAM_FILE_HEADERS });
  ws['!cols'] = [{ wch: 22 }, { wch: 34 }, { wch: 34 }, { wch: 12 }, { wch: 12 },
    ...CAGR_COLS.map(() => ({ wch: 14 }))];
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
