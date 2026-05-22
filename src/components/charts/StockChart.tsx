import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { POWERTRAINS } from '@/lib/constants/extracted';
import { PT_COLORS } from '@/lib/constants/colors';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; scenarioLabel?: string; }

export default function StockChart({ years, scenarioLabel }: Props) {
  const data = useMemo(() =>
    years.map(y => {
      const row: Record<string, number> = { year: y.year };
      for (const pt of POWERTRAINS) row[pt] = Math.round(y.stockByPT[pt]);
      return row;
    }), [years]);

  const csvData = useMemo(() => data.map(d => ({ ...d })), [data]);

  return (
    <ChartCard
      title="Fleet Stock by Powertrain"
      subtitle={`Vehicles on road · includes scrappage${scenarioLabel ? ` · ${scenarioLabel}` : ''}`}
      csvData={csvData}
      csvFilename="fleet_stock"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={v => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 10 }} width={45} />
          <Tooltip formatter={(v: number) => v.toLocaleString()} labelFormatter={l => `Year ${l}`} />
          {[...POWERTRAINS].reverse().map(pt => (
            <Area key={pt} type="monotone" dataKey={pt} stackId="1"
              fill={PT_COLORS[pt]} stroke={PT_COLORS[pt]} fillOpacity={0.8} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
