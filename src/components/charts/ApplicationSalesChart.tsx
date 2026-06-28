import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { APPLICATIONS, APPLICATION_COLORS } from '@/lib/constants/segments';
import { AXIS_TICK, AXIS_LINE, GRID_PROPS, CHART_MARGIN, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE, LEGEND_PROPS } from '@/lib/chartTheme';
import { SALE_VOLUME_SUBTITLE, POWERTRAIN_LABELS } from '@/lib/constants/displayLabels';
import type { Powertrain } from '@/lib/constants/extracted';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; scenarioLabel?: string; pt?: Powertrain; }

export default function ApplicationSalesChart({ years, scenarioLabel, pt }: Props) {
  const data = useMemo(() => years.map(y => {
    const src = pt ? (y.salesByApplicationPT[pt] ?? {}) : y.salesByApplication;
    const row: Record<string, number> = { year: y.year };
    for (const a of APPLICATIONS) row[a] = Math.round(src[a] ?? 0);
    return row;
  }), [years, pt]);

  const ptLabel = pt ? POWERTRAIN_LABELS[pt] : '';

  return (
    <ChartCard
      title={`Annual Sales by Application${ptLabel ? ` — ${ptLabel}` : ''}`}
      subtitle={`${SALE_VOLUME_SUBTITLE}, grouped by use-case${ptLabel ? ` · ${ptLabel} only` : ''}${scenarioLabel ? ` · ${scenarioLabel}` : ''}`}
      csvData={data}
      csvFilename={`annual_sales_by_application${pt ? `_${pt}` : ''}`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={45} />
          <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v: number) => v.toLocaleString()} labelFormatter={l => `Year ${l}`} />
          <Legend {...LEGEND_PROPS} />
          {APPLICATIONS.map(a => (
            <Area key={a} type="monotone" dataKey={a} stackId="1"
              fill={APPLICATION_COLORS[a] ?? '#94a3b8'} stroke={APPLICATION_COLORS[a] ?? '#94a3b8'} fillOpacity={0.8} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
