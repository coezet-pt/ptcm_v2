import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import type { AnnualResult, PolicyConfig } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props {
  years: AnnualResult[];
  policy: PolicyConfig;
  scenarioLabel?: string;
}

export default function ZETPenetrationChart({ years, policy, scenarioLabel }: Props) {
  const data = useMemo(() =>
    years.map(y => ({ year: y.year, 'ZET Share': parseFloat((y.zetShare * 100).toFixed(2)) })),
    [years],
  );

  const csvData = useMemo(() =>
    data.map(d => ({ year: d.year, 'ZET Share (%)': d['ZET Share'] })),
    [data],
  );

  const inflections = [
    { year: policy.bet_inflection_year, label: 'BET' },
    { year: policy.h2ice_inflection_year, label: 'H2-ICE' },
    { year: policy.fcet_inflection_year, label: 'FCET' },
  ];

  return (
    <ChartCard
      title="ZET Penetration"
      subtitle={`BET + H₂-ICE + H₂-FCET share of new sales${scenarioLabel ? ` · ${scenarioLabel}` : ''}`}
      csvData={csvData}
      csvFilename="zet_penetration"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} width={40} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} labelFormatter={l => `Year ${l}`} />
          <Line type="monotone" dataKey="ZET Share" stroke="#10b981" strokeWidth={2} dot={false} />
          {inflections.map(inf => (
            <ReferenceLine key={inf.label} x={inf.year} stroke="#94a3b8" strokeDasharray="4 4"
              label={{ value: inf.label, position: 'top', fontSize: 9, fill: '#94a3b8' }} />
          ))}
          <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="3 3"
            label={{ value: '50%', position: 'right', fontSize: 9, fill: '#ef4444' }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
