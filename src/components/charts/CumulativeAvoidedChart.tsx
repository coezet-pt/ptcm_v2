import { useMemo } from 'react';
import { Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, CartesianGrid, Legend } from 'recharts';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';
import { AXIS_TICK, AXIS_LINE, GRID_PROPS, CHART_MARGIN, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE, LEGEND_PROPS } from '@/lib/chartTheme';

interface Props { years: AnnualResult[]; scenarioLabel?: string; }

export default function CumulativeAvoidedChart({ years, scenarioLabel }: Props) {
  const { data, totalAvoided } = useMemo(() => {
    let cumAvoided = 0;
    let cumActual = 0;
    let cumCounter = 0;
    const rows = years.map(y => {
      const annualAvoided = Math.max(0, y.dieselCounterfactualEmissions - y.totalEmissions);
      cumAvoided += annualAvoided;
      cumActual  += y.totalEmissions;
      cumCounter += y.dieselCounterfactualEmissions;
      return {
        year: y.year,
        'Cumulative Avoided':         +cumAvoided.toFixed(3),
        'Cumulative Actual':          +cumActual.toFixed(3),
        'Cumulative Diesel-only':     +cumCounter.toFixed(3),
      };
    });
    return { data: rows, totalAvoided: cumAvoided };
  }, [years]);

  return (
    <ChartCard
      title="Cumulative CO₂ Avoided"
      subtitle={`Mt CO₂e, running total 2025\u2013${years[years.length - 1]?.year ?? 2055} · vs diesel-only counterfactual · ${totalAvoided.toLocaleString(undefined, { maximumFractionDigits: 1 })} Mt avoided by ${years[years.length - 1]?.year ?? 2055}${scenarioLabel ? ` · ${scenarioLabel}` : ''}`}
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
            formatter={(v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} Mt`}
          />
          <Legend {...LEGEND_PROPS} />
          <Area type="monotone" dataKey="Cumulative Avoided"
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