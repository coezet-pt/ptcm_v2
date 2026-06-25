import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { POWERTRAINS } from '@/lib/constants/extracted';
import { POWERTRAIN_LABELS } from '@/lib/constants/displayLabels';
import { PT_COLORS } from '@/lib/constants/colors';
import { AXIS_TICK, AXIS_LINE, GRID_PROPS, CHART_MARGIN, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE, LEGEND_PROPS } from '@/lib/chartTheme';
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
      title="Annual sales mix by power train (%)"
      subtitle={scenarioLabel ? `${scenarioLabel} scenario` : undefined}
      csvData={csvData}
      csvFilename="market_share"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} stackOffset="expand" margin={CHART_MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v: number) => `${(v * 100).toFixed(1)}%`} labelFormatter={l => `Year ${l}`} />
          <Legend {...LEGEND_PROPS} />
          {POWERTRAINS.map(pt => (
            <Area key={pt} type="monotone" dataKey={pt} name={POWERTRAIN_LABELS[pt]} stackId="1"
              fill={PT_COLORS[pt]} stroke={PT_COLORS[pt]} fillOpacity={0.8} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
