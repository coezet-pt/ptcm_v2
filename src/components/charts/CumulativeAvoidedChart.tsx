import { useMemo } from 'react';
import { Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

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
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="avoidedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#10b981" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={45} />
          <Tooltip
            labelFormatter={l => `Year ${l}`}
            formatter={(v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} Mt`}
          />
          <Area type="monotone" dataKey="Cumulative Avoided"
            fill="url(#avoidedFill)" stroke="#10b981" strokeWidth={2} />
          <Line type="monotone" dataKey="Cumulative Diesel-only"
            stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
          <Line type="monotone" dataKey="Cumulative Actual"
            stroke="#6b7280" strokeWidth={1.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}