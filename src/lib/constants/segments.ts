/**
 * Segment & Application taxonomy — formal workbook taxonomy (CoEZET_PTCM_v3).
 *
 * Segment = vehicle body family (Rigid / Tipper / Tractor) — derived from
 *   bucket.size per the Buckets sheet 'Model' column.
 * Application = use-case — matches bucket.useCase verbatim.
 */
import { BUCKETS, type Powertrain } from './extracted';

// ── Segments = body family (3 categories per v3 workbook) ───────────────────
export type Segment = 'Rigid' | 'Tipper (Rigid)' | 'Tractor (T-T)';

export const SEGMENTS: Segment[] = ['Rigid', 'Tipper (Rigid)', 'Tractor (T-T)'];

function sizeToSegment(size: string): Segment {
  const s = size.toLowerCase();
  if (s.includes('tip')) return 'Tipper (Rigid)';
  if (s.includes('tractor')) return 'Tractor (T-T)';
  return 'Rigid';
}

export const SEGMENT_OF_BUCKET: Record<string, Segment> = Object.fromEntries(
  BUCKETS.map(b => [b.id, sizeToSegment(b.size)]),
);

export const SEGMENT_COLORS: Record<Segment, string> = {
  'Rigid':          '#3b82f6',
  'Tipper (Rigid)': '#f59e0b',
  'Tractor (T-T)':  '#10b981',
};

// ── Applications = useCase (9 categories, matches workbook verbatim) ────────
export type Application = string;

export const APPLICATIONS: Application[] = Array.from(
  new Set(BUCKETS.map(b => b.useCase)),
);

export const APPLICATION_OF_BUCKET: Record<string, Application> = Object.fromEntries(
  BUCKETS.map(b => [b.id, b.useCase]),
);

export const APPLICATION_COLORS: Record<Application, string> = {
  'Market Load':                       '#3b82f6',
  'Parcel Load and FMCG':              '#8b5cf6',
  'Perishables':                       '#06b6d4',
  'Construction & Mining':             '#f59e0b',
  'Cement (Bulkers & Bagged)':         '#a3a3a3',
  'Steel & metal products':            '#64748b',
  'Tankers - POL & CNG cascades':      '#ef4444',
  'Tankers - Non POL':                 '#ec4899',
  'LPG bullet tankers':                '#14b8a6',
};

export type BucketSalesByPT = Record<string, Record<Powertrain, number>>;
