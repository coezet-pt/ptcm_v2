import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { SEGMENTS, SEGMENT_COLORS } from '@/lib/constants/segments';
import { AXIS_TICK, AXIS_LINE, GRID_PROPS, CHART_MARGIN, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE, LEGEND_PROPS } from '@/lib/chartTheme';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; scenarioLabel?: string; }

export default function SegmentSalesChart({ years, scenarioLabel }: Props) {
  const data = useMemo(() => years.map(y => {
    const row: Record<string, number> = { year: y.year };
    for (const s of SEGMENTS) row[s] = Math.round(y.salesBySegment[s] ?? 0);
    return row;
  }), [years]);

  return (
    <ChartCard
      title="Annual Sales by Segment"
      subtitle={`Units sold per year, grouped by vehicle class${scenarioLabel ? ` · ${scenarioLabel}` : ''}`}
      csvData={data}
      csvFilename="annual_sales_by_segment"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={45} />
          <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v: number) => v.toLocaleString()} labelFormatter={l => `Year ${l}`} />
          <Legend {...LEGEND_PROPS} />
          {SEGMENTS.map(s => (
            <Area key={s} type="monotone" dataKey={s} stackId="1"
              fill={SEGMENT_COLORS[s]} stroke={SEGMENT_COLORS[s]} fillOpacity={0.8} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
