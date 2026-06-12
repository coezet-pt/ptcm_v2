/**
 * Shared Recharts styling for the editorial (warm cream) theme.
 * Recharts SVG attributes can't resolve CSS variables, so warm hex values
 * matching the index.css tokens are hardcoded here.
 */
import type { CSSProperties } from 'react';

export const CHART_MARGIN = { top: 8, right: 12, left: 0, bottom: 0 };

/** Axis tick text — warm gray, mono numerals */
export const AXIS_TICK = { fontSize: 10, fill: '#8a8174', fontFamily: '"JetBrains Mono", monospace' };

export const AXIS_LINE = { stroke: '#e3dbcb' };

/** Subtle horizontal grid lines on cream */
export const GRID_PROPS = {
  stroke: '#e7dfd0',
  strokeDasharray: '3 3',
  vertical: false,
};

export const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  backgroundColor: '#fffcf5',
  border: '1px solid #e3dbcb',
  borderRadius: 8,
  fontSize: 11,
  fontFamily: '"JetBrains Mono", monospace',
  boxShadow: '0 4px 14px rgba(60, 50, 30, 0.10)',
};

export const TOOLTIP_LABEL_STYLE: CSSProperties = {
  fontWeight: 600,
  color: '#2b2620',
  fontFamily: '"DM Sans", sans-serif',
  marginBottom: 4,
};

export const LEGEND_PROPS = {
  iconType: 'circle' as const,
  iconSize: 7,
  wrapperStyle: { fontSize: 10, fontFamily: '"DM Sans", sans-serif' } as CSSProperties,
};

/** Warm gray for reference lines / annotations */
export const REF_LINE_COLOR = '#a89e8c';
