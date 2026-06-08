/**
 * Segment & Application taxonomy.
 *
 * Derived from existing BUCKETS (bucket.size → segment, bucket.useCase → application).
 * Does NOT modify extracted.ts. When the v3 workbook's segment-share tables are
 * extracted, this file can be augmented with the formal segment definitions.
 */
import { BUCKETS, type Powertrain, type VehicleSize } from './extracted';

// ── Segments = vehicle weight class ──────────────────────────────────────────
export type Segment = VehicleSize;

export const SEGMENTS: Segment[] = Array.from(
  new Set(BUCKETS.map(b => b.size))
) as Segment[];

export const SEGMENT_OF_BUCKET: Record<string, Segment> = Object.fromEntries(
  BUCKETS.map(b => [b.id, b.size as Segment])
);

// Stable colour ramp (distinct from PT palette).
export const SEGMENT_COLORS: Record<Segment, string> = {
  '15T Rigid':   '#60a5fa',
  '19T Rigid':   '#3b82f6',
  '28T Rigid':   '#2563eb',
  '35T Rigid':   '#1d4ed8',
  '48T Rigid':   '#1e40af',
  '28T Tipper':  '#f59e0b',
  '35T Tipper':  '#d97706',
  '40T Tractor': '#10b981',
  '55T Tractor': '#059669',
};

// ── Applications = useCase ───────────────────────────────────────────────────
export type Application = string;

export const APPLICATIONS: Application[] = Array.from(
  new Set(BUCKETS.map(b => b.useCase))
);

export const APPLICATION_OF_BUCKET: Record<string, Application> = Object.fromEntries(
  BUCKETS.map(b => [b.id, b.useCase])
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
