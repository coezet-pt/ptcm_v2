import type { SimulationResult, PolicyConfig } from '@/lib/types';

import AnnualSalesChart from '@/components/charts/AnnualSalesChart';
import ShareChart from '@/components/charts/ShareChart';
import StockChart from '@/components/charts/StockChart';
import EmissionsChart from '@/components/charts/EmissionsChart';
import CumulativeAvoidedChart from '@/components/charts/CumulativeAvoidedChart';
import ZETPenetrationChart from '@/components/charts/ZETPenetrationChart';
import SegmentSalesChart from '@/components/charts/SegmentSalesChart';
import SegmentStockChart from '@/components/charts/SegmentStockChart';
import ApplicationSalesChart from '@/components/charts/ApplicationSalesChart';
import ApplicationStockChart from '@/components/charts/ApplicationStockChart';

interface Props {
  result: SimulationResult;
  policy: PolicyConfig;
  scenarioLabel: string;
  isComputing: boolean;
}

const NAV = [
  { id: 'powertrain', label: 'Powertrain mix' },
  { id: 'emissions', label: 'Emissions & ZET' },
  { id: 'segments', label: 'Segments & applications' },
];

const PRELIM_NOTE =
  'Preliminary grouping — uses vehicle size / use-case from BUCKETS. Will switch to the workbook\u2019s formal 7-segment / 10-application taxonomy after the v3 extraction.';

function SectionHeader({ title, kicker }: { title: string; kicker: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap border-b border-border pb-2">
      <h3 className="font-serif text-xl tracking-tight">{title}</h3>
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{kicker}</span>
    </div>
  );
}

export default function ChartSections({ result, policy, scenarioLabel, isComputing }: Props) {
  return (
    <div>
      {/* Sticky anchor nav, sits just under the app header */}
      <nav className="sticky top-14 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur-sm flex gap-2 overflow-x-auto">
        {NAV.map(n => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium whitespace-nowrap hover:bg-secondary transition-colors"
          >
            {n.label}
          </a>
        ))}
      </nav>

      <div
        className="mt-4 space-y-10"
        style={{ opacity: isComputing ? 0.6 : 1, transition: 'opacity 0.2s' }}
      >
        <section id="powertrain" className="scroll-mt-28 space-y-4">
          <SectionHeader title="Powertrain mix" kicker="Sales · share · stock" />
          <AnnualSalesChart years={result.years} scenarioLabel={scenarioLabel} />
          <ShareChart years={result.years} scenarioLabel={scenarioLabel} />
          <StockChart years={result.years} scenarioLabel={scenarioLabel} />
        </section>

        <section id="emissions" className="scroll-mt-28 space-y-4">
          <SectionHeader title="Emissions & ZET penetration" kicker="Well To Wheel (WTW) CO₂e" />
          <EmissionsChart years={result.years} scenarioLabel={scenarioLabel} />
          <CumulativeAvoidedChart years={result.years} scenarioLabel={scenarioLabel} />
          <ZETPenetrationChart years={result.years} policy={policy} scenarioLabel={scenarioLabel} />
        </section>

        <section id="segments" className="scroll-mt-28 space-y-4">
          <SectionHeader title="Segments & applications" kicker="Preliminary taxonomy" />
          <p className="text-xs text-muted-foreground -mt-2">{PRELIM_NOTE}</p>
          <SegmentSalesChart years={result.years} scenarioLabel={scenarioLabel} />
          <SegmentStockChart years={result.years} scenarioLabel={scenarioLabel} />
          <ApplicationSalesChart years={result.years} scenarioLabel={scenarioLabel} />
          <ApplicationStockChart years={result.years} scenarioLabel={scenarioLabel} />
        </section>
      </div>
    </div>
  );
}
