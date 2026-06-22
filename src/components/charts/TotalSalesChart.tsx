import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { SALE_VOLUME_SUBTITLE } from '@/lib/constants/displayLabels';
import { PT_COLORS } from '@/lib/constants/colors';
import { AXIS_TICK, AXIS_LINE, GRID_PROPS, CHART_MARGIN, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE } from '@/lib/chartTheme';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; scenarioLabel?: string; }

export default function TotalSalesChart({ years, scenarioLabel }: Props) {
  const data = useMemo(() =>
    years.map(y => ({ year: y.year, total: Math.round(y.tiv) })), [years]);

  const csvData = useMemo(() => data.map(d => ({ year: d.year, 'Total sales': d.total })), [data]);

  return (
    <ChartCard
      title="Annual Sales Volumes"
      subtitle={`Total industry volume · ${SALE_VOLUME_SUBTITLE}${scenarioLabel ? ` · ${scenarioLabel} scenario` : ''}`}
      csvData={csvData}
      csvFilename="annual_sales_volumes"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={45} />
          <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v: number) => v.toLocaleString()} labelFormatter={l => `Year ${l}`} />
          <Line type="monotone" dataKey="total" name="Total sales" stroke={PT_COLORS.Diesel} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
