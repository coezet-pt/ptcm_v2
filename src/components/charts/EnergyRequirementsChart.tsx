import { useMemo } from 'react';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { POWERTRAINS, type Powertrain } from '@/lib/constants/extracted';
import { POWERTRAIN_LABELS, ENERGY_UNIT_BY_PT, ELECTRICITY_UNIT } from '@/lib/constants/displayLabels';
import { PT_COLORS } from '@/lib/constants/colors';
import { AXIS_TICK, AXIS_LINE, GRID_PROPS, CHART_MARGIN, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE, LEGEND_PROPS } from '@/lib/chartTheme';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; scenarioLabel?: string; }

// Lower-heating-value energy content (kWh per kg of fuel) used to express the
// gas/hydrogen carriers on a common electricity-equivalent (TWh) axis.
// Methane (CNG/LNG) ≈ 50 MJ/kg, hydrogen ≈ 120 MJ/kg.
const KWH_PER_KG: Partial<Record<Powertrain, number>> = {
  CNG: 13.9, LNG: 13.9, 'H2-ICE': 33.33, 'H2-FCET': 33.33,
};

// BET energy is already TWh; gas/H2 (million kg) → TWh via LHV.
function toTWh(pt: Powertrain, native: number): number {
  if (pt === 'BET') return native;
  const kwhPerKg = KWH_PER_KG[pt] ?? 0;
  return native * kwhPerKg / 1000; // (million kg) × kWh/kg ÷ 1e3 = TWh
}

const RIGHT_AXIS_PT = POWERTRAINS.filter(pt => pt !== 'Diesel');
const DIESEL_LABEL = POWERTRAIN_LABELS.Diesel;
const BET_LABEL = POWERTRAIN_LABELS.BET;

export default function EnergyRequirementsChart({ years, scenarioLabel }: Props) {
  const { chartData, csvData } = useMemo(() => {
    const chart: Record<string, number>[] = [];
    const csv: Record<string, number>[] = [];
    for (const y of years) {
      const crow: Record<string, number> = { year: y.year };
      const xrow: Record<string, number> = { year: y.year };
      crow[DIESEL_LABEL] = +y.energyByPT.Diesel.toFixed(1);
      xrow[`Diesel (${ENERGY_UNIT_BY_PT.Diesel})`] = +y.energyByPT.Diesel.toFixed(1);
      for (const pt of RIGHT_AXIS_PT) {
        const native = y.energyByPT[pt];
        const label = POWERTRAIN_LABELS[pt];
        crow[label] = +toTWh(pt, native).toFixed(2);
        crow[`native:${label}`] = +native.toFixed(2);
        xrow[`${label} (${ENERGY_UNIT_BY_PT[pt]})`] = +native.toFixed(2);
        if (pt !== 'BET') xrow[`${label} (TWh-eq)`] = +toTWh(pt, native).toFixed(2);
      }
      chart.push(crow);
      csv.push(xrow);
    }
    return { chartData: chart, csvData: csv };
  }, [years]);

  return (
    <ChartCard
      title="Energy Requirement by Powertrain"
      subtitle={`Diesel in Mn litres (left); other carriers as electricity-equivalent ${ELECTRICITY_UNIT} (right, gas/H₂ via LHV)${scenarioLabel ? ` · ${scenarioLabel}` : ''}`}
      csvData={csvData}
      csvFilename="energy_requirements"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={chartData} margin={{ ...CHART_MARGIN, right: 12 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis yAxisId="diesel" tick={AXIS_TICK} axisLine={false} tickLine={false} width={55}
            tickFormatter={(v: number) => v.toLocaleString()} />
          <YAxis yAxisId="other" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
          <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE}
            labelFormatter={l => `Year ${l}`}
            formatter={(value: number, name: string, item: { payload?: Record<string, number> }) => {
              if (name === DIESEL_LABEL) {
                return [`${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${ENERGY_UNIT_BY_PT.Diesel}`, name];
              }
              if (name === BET_LABEL) {
                return [`${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${ELECTRICITY_UNIT}`, name];
              }
              const native = item?.payload?.[`native:${name}`] ?? 0;
              return [`${native.toLocaleString(undefined, { maximumFractionDigits: 2 })} Mn kg (${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${ELECTRICITY_UNIT})`, name];
            }} />
          <Legend {...LEGEND_PROPS} />
          <Line yAxisId="diesel" type="monotone" dataKey={DIESEL_LABEL} name={DIESEL_LABEL}
            stroke={PT_COLORS.Diesel} strokeWidth={2.5} dot={false} />
          {RIGHT_AXIS_PT.map(pt => (
            <Line key={pt} yAxisId="other" type="monotone" dataKey={POWERTRAIN_LABELS[pt]} name={POWERTRAIN_LABELS[pt]}
              stroke={PT_COLORS[pt]} strokeWidth={2} dot={false} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
