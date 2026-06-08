import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { APPLICATIONS, APPLICATION_COLORS } from '@/lib/constants/segments';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; scenarioLabel?: string; }

export default function ApplicationSalesChart({ years, scenarioLabel }: Props) {
  const data = useMemo(() => years.map(y => {
    const row: Record<string, number> = { year: y.year };
    for (const a of APPLICATIONS) row[a] = Math.round(y.salesByApplication[a] ?? 0);
    return row;
  }), [years]);

  return (
    <ChartCard
      title="Annual Sales by Application"
      subtitle={`Units sold per year, grouped by use-case${scenarioLabel ? ` · ${scenarioLabel}` : ''}`}
      csvData={data}
      csvFilename="annual_sales_by_application"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={45} />
          <Tooltip formatter={(v: number) => v.toLocaleString()} labelFormatter={l => `Year ${l}`} />
          {APPLICATIONS.map(a => (
            <Area key={a} type="monotone" dataKey={a} stackId="1"
              fill={APPLICATION_COLORS[a] ?? '#94a3b8'} stroke={APPLICATION_COLORS[a] ?? '#94a3b8'} fillOpacity={0.8} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
