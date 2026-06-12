import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { AnnualResult, PolicyConfig } from '@/lib/types';
import ChartCard from '@/components/ChartCard';
import { AXIS_TICK, AXIS_LINE, GRID_PROPS, CHART_MARGIN, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE, REF_LINE_COLOR } from '@/lib/chartTheme';

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
        <LineChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tickFormatter={v => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v: number) => `${v.toFixed(1)}%`} labelFormatter={l => `Year ${l}`} />
          <Line type="monotone" dataKey="ZET Share" stroke="#059669" strokeWidth={2.5} dot={false} />
          {inflections.map(inf => (
            <ReferenceLine key={inf.label} x={inf.year} stroke={REF_LINE_COLOR} strokeDasharray="4 4"
              label={{ value: inf.label, position: 'top', fontSize: 9, fill: REF_LINE_COLOR }} />
          ))}
          <ReferenceLine y={50} stroke="#b91c1c" strokeDasharray="3 3"
            label={{ value: '50%', position: 'right', fontSize: 9, fill: '#b91c1c' }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
