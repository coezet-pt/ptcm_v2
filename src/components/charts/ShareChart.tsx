import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { POWERTRAINS } from '@/lib/constants/extracted';
import { PT_COLORS } from '@/lib/constants/colors';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; scenarioLabel?: string; }

export default function ShareChart({ years, scenarioLabel }: Props) {
  const data = useMemo(() =>
    years.map(y => {
      const row: Record<string, number> = { year: y.year };
      for (const pt of POWERTRAINS) row[pt] = y.shareByPT[pt];
      return row;
    }), [years]);

  const csvData = useMemo(() =>
    data.map(d => {
      const row: Record<string, unknown> = { year: d.year };
      for (const pt of POWERTRAINS) row[pt] = `${((d[pt] as number) * 100).toFixed(2)}%`;
      return row;
    }), [data]);

  return (
    <ChartCard
      title="Market Share by Powertrain"
      subtitle={`% of annual sales${scenarioLabel ? ` · ${scenarioLabel} scenario` : ''}`}
      csvData={csvData}
      csvFilename="market_share"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} stackOffset="expand" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10 }} width={40} />
          <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} labelFormatter={l => `Year ${l}`} />
          {[...POWERTRAINS].reverse().map(pt => (
            <Area key={pt} type="monotone" dataKey={pt} stackId="1"
              fill={PT_COLORS[pt]} stroke={PT_COLORS[pt]} fillOpacity={0.8} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
