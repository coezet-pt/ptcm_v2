import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { SEGMENTS, SEGMENT_COLORS } from '@/lib/constants/segments';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; scenarioLabel?: string; }

export default function SegmentStockChart({ years, scenarioLabel }: Props) {
  const data = useMemo(() => years.map(y => {
    const row: Record<string, number> = { year: y.year };
    for (const s of SEGMENTS) row[s] = Math.round(y.stockBySegment[s] ?? 0);
    return row;
  }), [years]);

  return (
    <ChartCard
      title="Fleet Stock by Segment"
      subtitle={`Vehicles on road, grouped by vehicle class${scenarioLabel ? ` · ${scenarioLabel}` : ''}`}
      csvData={data}
      csvFilename="fleet_stock_by_segment"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={v => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 10 }} width={45} />
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
