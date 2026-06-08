import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { SEGMENTS, SEGMENT_COLORS } from '@/lib/constants/segments';
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
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={45} />
          <Tooltip formatter={(v: number) => v.toLocaleString()} labelFormatter={l => `Year ${l}`} />
          {SEGMENTS.map(s => (
            <Area key={s} type="monotone" dataKey={s} stackId="1"
              fill={SEGMENT_COLORS[s]} stroke={SEGMENT_COLORS[s]} fillOpacity={0.8} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
