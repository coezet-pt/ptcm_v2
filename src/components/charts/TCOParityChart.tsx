import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BUCKETS } from '@/lib/constants/extracted';
import { POWERTRAIN_LABELS } from '@/lib/constants/displayLabels';
import { PT_COLORS } from '@/lib/constants/colors';
import type { ParityYears } from '@/lib/types';
import { PARITY_POWERTRAINS } from '@/lib/sim/parity';
import ChartCard from '@/components/ChartCard';

/**
 * First year each ZET's TCO/km reaches diesel, per bucket — Excel 'Buckets'
 * AE3:AG16 ("TCO Parity with Diesel"). Computed live from the engine
 * (see sim/parity.ts), so it responds to every cost and policy lever.
 *
 * NOTE: this component is not currently mounted anywhere. Wire it into
 * ChartSections/ReportDocument if the parity view should be shown.
 */
interface Props {
  scenarioName: string;
  parityYears: ParityYears;
}

const NO_PARITY = 'No parity by 2055';

export default function TCOParityChart({ scenarioName, parityYears }: Props) {
  const data = useMemo(() =>
    BUCKETS.map(b => {
      const entry = parityYears[b.id];
      if (!entry) return null;
      const row: Record<string, string | number | null> = { bucket: b.id };
      for (const pt of PARITY_POWERTRAINS) row[pt] = entry[pt];
      return row;
    }).filter(Boolean) as Record<string, string | number | null>[],
    [parityYears],
  );

  // Buckets with no parity export as the label rather than a silent 2055.
  const csvData = useMemo(() => data.map(d => {
    const row: Record<string, string | number> = { bucket: String(d.bucket) };
    for (const pt of PARITY_POWERTRAINS) row[pt] = d[pt] === null ? NO_PARITY : (d[pt] as number);
    return row;
  }), [data]);

  return (
    <ChartCard
      title="TCO Parity Year by Bucket"
      description={`${scenarioName} · first year ZET cost per km reaches diesel`}
      csvData={csvData}
      csvFilename="tco_parity"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 30, bottom: 0 }}>
          <XAxis type="number" domain={[2026, 2055]} allowDataOverflow tick={{ fontSize: 10 }} />
          <YAxis dataKey="bucket" type="category" tick={{ fontSize: 10 }} width={30} />
          <Tooltip
            labelFormatter={l => `Bucket ${l}`}
            formatter={(v: number | null) => (v === null ? NO_PARITY : String(v))}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {PARITY_POWERTRAINS.map(pt => (
            <Bar key={pt} dataKey={pt} name={POWERTRAIN_LABELS[pt]} fill={PT_COLORS[pt]} barSize={6} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
