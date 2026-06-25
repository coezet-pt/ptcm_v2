import { useMemo } from 'react';
import { Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, CartesianGrid, Legend } from 'recharts';
import { CUMULATIVE_EMISSIONS_SUBTITLE, EMISSIONS_UNIT_SHORT } from '@/lib/constants/displayLabels';
import ChartCard from '@/components/ChartCard';
import { AXIS_TICK, AXIS_LINE, GRID_PROPS, CHART_MARGIN, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE, LEGEND_PROPS } from '@/lib/chartTheme';
import type { AnnualResult } from '@/lib/types';

interface Props { years: AnnualResult[]; scenarioLabel?: string; }

export default function CumulativeAvoidedChart({ years, scenarioLabel }: Props) {
  const data = useMemo(() => {
    let cumAvoided = 0;
    let cumActual = 0;
    let cumCounter = 0;
    return years.map(y => {
      const annualAvoided = Math.max(0, y.dieselCounterfactualEmissions - y.totalEmissions);
      cumAvoided += annualAvoided;
      cumActual  += y.totalEmissions;
      cumCounter += y.dieselCounterfactualEmissions;
      return {
        year: y.year,
        'Cumulative reduction':       +cumAvoided.toFixed(3),
        'Cumulative Actual':          +cumActual.toFixed(3),
        'Cumulative Diesel-only':     +cumCounter.toFixed(3),
      };
    });
  }, [years]);

  return (
    <ChartCard
      title="Cumulative CO₂ emission reduction"
      subtitle={`${CUMULATIVE_EMISSIONS_SUBTITLE}${scenarioLabel ? ` · ${scenarioLabel}` : ''}`}
      csvData={data}
      csvFilename="cumulative_co2_avoided"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={data} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="avoidedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#059669" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={45} />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            labelFormatter={l => `Year ${l}`}
            formatter={(v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${EMISSIONS_UNIT_SHORT}`}
          />
          <Legend {...LEGEND_PROPS} />
          <Area type="monotone" dataKey="Cumulative reduction"
            fill="url(#avoidedFill)" stroke="#059669" strokeWidth={2} />
          <Line type="monotone" dataKey="Cumulative Diesel-only"
            stroke="#b91c1c" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
          <Line type="monotone" dataKey="Cumulative Actual"
            stroke="#6f6051" strokeWidth={1.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}