import { useMemo } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { DIESEL_FUEL_UNIT, DIESEL_SAVINGS_SUBTITLE } from '@/lib/constants/displayLabels';
import { AXIS_TICK, AXIS_LINE, GRID_PROPS, CHART_MARGIN, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE, LEGEND_PROPS } from '@/lib/chartTheme';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; scenarioLabel?: string; }

const fmt = (v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${DIESEL_FUEL_UNIT}`;

export default function DieselSavingsChart({ years, scenarioLabel }: Props) {
  const data = useMemo(() =>
    years.map(y => {
      const actual = y.energyByPT.Diesel;
      const counterfactual = y.dieselCounterfactualLitres;
      return {
        year: y.year,
        'Diesel Used': +actual.toFixed(0),
        'Diesel Saved': +Math.max(0, counterfactual - actual).toFixed(0),
        'All-Diesel Fleet': +counterfactual.toFixed(0),
      };
    }), [years]);

  return (
    <ChartCard
      title="Diesel Savings from Powertrain Transition"
      subtitle={`${DIESEL_SAVINGS_SUBTITLE}${scenarioLabel ? ` · ${scenarioLabel}` : ''}`}
      csvData={data}
      csvFilename="diesel_savings"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={data} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="dieselSavedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#059669" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={55}
            tickFormatter={(v: number) => v.toLocaleString()} />
          <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE}
            labelFormatter={l => `Year ${l}`} formatter={(v: number) => fmt(v)} />
          <Legend {...LEGEND_PROPS} />
          <Area type="monotone" dataKey="Diesel Used" stackId="diesel"
            fill="#8a6d3b" stroke="#8a6d3b" fillOpacity={0.7} dot={false} />
          <Area type="monotone" dataKey="Diesel Saved" stackId="diesel"
            fill="url(#dieselSavedFill)" stroke="#059669" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="All-Diesel Fleet"
            stroke="#b91c1c" strokeWidth={2} strokeDasharray="6 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
