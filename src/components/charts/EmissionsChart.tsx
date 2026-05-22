import { useMemo } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { POWERTRAINS } from '@/lib/constants/extracted';
import { PT_COLORS } from '@/lib/constants/colors';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; scenarioLabel?: string; }

export default function EmissionsChart({ years, scenarioLabel }: Props) {
  const data = useMemo(() =>
    years.map(y => {
      const row: Record<string, number> = { year: y.year };
      for (const pt of POWERTRAINS) row[pt] = parseFloat(y.emissionsByPT[pt].toFixed(3));
      row['Diesel Counterfactual'] = parseFloat(y.dieselCounterfactualEmissions.toFixed(3));
      return row;
    }), [years]);

  const csvData = useMemo(() => data.map(d => ({ ...d })), [data]);

  return (
    <ChartCard
      title="Emissions by Powertrain"
      subtitle={`Mt CO₂e per year · well-to-wheel basis${scenarioLabel ? ` · ${scenarioLabel}` : ''}`}
      csvData={csvData}
      csvFilename="emissions"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={45} />
          <Tooltip labelFormatter={l => `Year ${l}`} />
          {[...POWERTRAINS].reverse().map(pt => (
            <Area key={pt} type="monotone" dataKey={pt} stackId="1"
              fill={PT_COLORS[pt]} stroke={PT_COLORS[pt]} fillOpacity={0.8} dot={false} />
          ))}
          <Line type="monotone" dataKey="Diesel Counterfactual"
            stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
