import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { POWERTRAIN_LABELS, ELECTRICITY_UNIT } from '@/lib/constants/displayLabels';
import { PT_COLORS } from '@/lib/constants/colors';
import { AXIS_TICK, AXIS_LINE, GRID_PROPS, CHART_MARGIN, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE, LEGEND_PROPS } from '@/lib/chartTheme';
import type { AnnualResult } from '@/lib/types';
import ChartCard from '@/components/ChartCard';

interface Props { years: AnnualResult[]; scenarioLabel?: string; }

// Report (Chapter 5) units: diesel in Million litres, natural gas & hydrogen in
// MMT (Million Metric Tonnes), electricity in TWh. The engine stores gas/H₂ in
// million kg, so MMT = million kg ÷ 1000.
const MN_KG_TO_MMT = 1 / 1000;

const TOTAL_H2_COLOR = '#6f6051';

function sub(line: string, scenarioLabel?: string) {
  return `${line}${scenarioLabel ? ` · ${scenarioLabel}` : ''}`;
}

export default function EnergyRequirementsChart({ years, scenarioLabel }: Props) {
  const { diesel, gas, hydrogen, electricity } = useMemo(() => {
    const diesel: Record<string, number>[] = [];
    const gas: Record<string, number>[] = [];
    const hydrogen: Record<string, number>[] = [];
    const electricity: Record<string, number>[] = [];
    for (const y of years) {
      diesel.push({ year: y.year, 'Diesel (Mn litres)': +y.energyByPT.Diesel.toFixed(0) });

      const cng = +(y.energyByPT.CNG * MN_KG_TO_MMT).toFixed(2);
      const lng = +(y.energyByPT.LNG * MN_KG_TO_MMT).toFixed(2);
      gas.push({ year: y.year, 'CNG (MMT)': cng, 'LNG (MMT)': lng });

      const h2ice = +(y.energyByPT['H2-ICE'] * MN_KG_TO_MMT).toFixed(2);
      const h2fcet = +(y.energyByPT['H2-FCET'] * MN_KG_TO_MMT).toFixed(2);
      hydrogen.push({
        year: y.year,
        'H₂-ICE (MMT)': h2ice,
        'H₂-FCET (MMT)': h2fcet,
        'Total H₂ (MMT)': +(h2ice + h2fcet).toFixed(2),
      });

      electricity.push({ year: y.year, 'BET (TWh)': +y.energyByPT.BET.toFixed(2) });
    }
    return { diesel, gas, hydrogen, electricity };
  }, [years]);

  return (
    <>
      {/* 5.1 Diesel */}
      <ChartCard
        title="Diesel Energy Requirement"
        subtitle={sub('Annual diesel demand · Million litres', scenarioLabel)}
        csvData={diesel}
        csvFilename="energy_diesel"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={diesel} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={55}
              tickFormatter={(v: number) => v.toLocaleString()} />
            <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE}
              labelFormatter={l => `Year ${l}`}
              formatter={(v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} Mn litres`} />
            <Legend {...LEGEND_PROPS} />
            <Line type="monotone" dataKey="Diesel (Mn litres)" name={POWERTRAIN_LABELS.Diesel}
              stroke={PT_COLORS.Diesel} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 5.2 Natural gas */}
      <ChartCard
        title="CNG / LNG Energy Requirement"
        subtitle={sub('Annual natural-gas demand · Million Metric Tonnes (MMT)', scenarioLabel)}
        csvData={gas}
        csvFilename="energy_natural_gas"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={gas} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={45} />
            <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE}
              labelFormatter={l => `Year ${l}`}
              formatter={(v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} MMT`} />
            <Legend {...LEGEND_PROPS} />
            <Line type="monotone" dataKey="CNG (MMT)" name={POWERTRAIN_LABELS.CNG}
              stroke={PT_COLORS.CNG} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="LNG (MMT)" name={POWERTRAIN_LABELS.LNG}
              stroke={PT_COLORS.LNG} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 5.3 Hydrogen */}
      <ChartCard
        title="Hydrogen Energy Requirement"
        subtitle={sub('Annual green-H₂ demand · Million Metric Tonnes (MMT)', scenarioLabel)}
        csvData={hydrogen}
        csvFilename="energy_hydrogen"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={hydrogen} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={45} />
            <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE}
              labelFormatter={l => `Year ${l}`}
              formatter={(v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} MMT`} />
            <Legend {...LEGEND_PROPS} />
            <Line type="monotone" dataKey="H₂-ICE (MMT)" name={POWERTRAIN_LABELS['H2-ICE']}
              stroke={PT_COLORS['H2-ICE']} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="H₂-FCET (MMT)" name={POWERTRAIN_LABELS['H2-FCET']}
              stroke={PT_COLORS['H2-FCET']} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="Total H₂ (MMT)" name="Total H₂"
              stroke={TOTAL_H2_COLOR} strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 5.4 Electricity */}
      <ChartCard
        title="Electricity Demand (BET)"
        subtitle={sub(`Annual battery-electric demand · ${ELECTRICITY_UNIT}`, scenarioLabel)}
        csvData={electricity}
        csvFilename="energy_electricity"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={electricity} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={45} />
            <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE}
              labelFormatter={l => `Year ${l}`}
              formatter={(v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ELECTRICITY_UNIT}`} />
            <Legend {...LEGEND_PROPS} />
            <Line type="monotone" dataKey="BET (TWh)" name={POWERTRAIN_LABELS.BET}
              stroke={PT_COLORS.BET} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}
