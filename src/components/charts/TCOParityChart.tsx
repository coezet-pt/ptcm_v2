import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TCO_PARITY_YEARS, BUCKETS } from '@/lib/constants/extracted';
import { PT_COLORS } from '@/lib/constants/colors';
import ChartCard from '@/components/ChartCard';

interface Props {
  scenarioName: string;
}

const ZET_PTS = ['BET', 'H2-ICE', 'H2-FCET'] as const;

export default function TCOParityChart({ scenarioName }: Props) {
  const isBAU = scenarioName === 'BAU' || scenarioName === 'BWS-1' || scenarioName === 'BWS-2';
  const isBEST = scenarioName === 'BEST';
  const isCustom = !isBAU && !isBEST;
  const sourceKey = isBEST ? 'scenario4_BEST' : 'scenario1_BAU';
  const source = TCO_PARITY_YEARS[sourceKey as keyof typeof TCO_PARITY_YEARS];

  const data = useMemo(() =>
    BUCKETS.map(b => {
      const entry = source[b.id as keyof typeof source];
      if (!entry) return null;
      return {
        bucket: b.id,
        BET: (entry as any).BET ?? 2055,
        'H2-ICE': (entry as any)['H2-ICE'] ?? 2055,
        'H2-FCET': (entry as any)['H2-FCET'] ?? 2055,
      };
    }).filter(Boolean),
    [source],
  );

  const csvData = useMemo(() => data.map(d => ({ ...d! })), [data]);

  return (
    <ChartCard
      title="TCO Parity Year by Bucket"
      description={isCustom ? '(Showing BAU baseline — custom parity not computed)' : `${isBEST ? 'BEST' : 'BAU'} scenario`}
      csvData={csvData}
      csvFilename="tco_parity"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 30, bottom: 0 }}>
          <XAxis type="number" domain={[2025, 2055]} tick={{ fontSize: 10 }} />
          <YAxis dataKey="bucket" type="category" tick={{ fontSize: 10 }} width={30} />
          <Tooltip labelFormatter={l => `Bucket ${l}`} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {ZET_PTS.map(pt => (
            <Bar key={pt} dataKey={pt} fill={PT_COLORS[pt]} barSize={6} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
