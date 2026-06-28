import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { SimulationResult, PolicyConfig } from '@/lib/types';

import TotalSalesChart from '@/components/charts/TotalSalesChart';
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
import DieselSavingsChart from '@/components/charts/DieselSavingsChart';
import EnergyRequirementsChart from '@/components/charts/EnergyRequirementsChart';

interface Props {
  result: SimulationResult;
  policy: PolicyConfig;
  scenarioLabel: string;
  isComputing: boolean;
}

type SectionId = 'powertrain' | 'emissions' | 'energy';

const NAV: { id: SectionId; label: string }[] = [
  { id: 'powertrain', label: 'projection - powertrain' },
  { id: 'emissions', label: 'impact - emission' },
  { id: 'energy', label: 'impact - fuel/energy requirement' },
];

export const SECTION_META: Record<SectionId, { title: string; kicker: string }> = {
  powertrain: { title: 'Powertrain mix', kicker: 'Sales · share · stock · segments' },
  emissions: { title: 'Emissions', kicker: 'Well To Wheel (WTW) CO₂e' },
  energy: { title: 'Energy requirements & savings', kicker: 'Annual energy demand · diesel displaced' },
};

const PRELIM_NOTE =
  'Preliminary grouping — uses vehicle size / use-case from BUCKETS. Will switch to the workbook’s formal 7-segment / 10-application taxonomy after the v3 extraction.';

function SectionHeader({ title, kicker }: { title: string; kicker: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap border-b border-border pb-2">
      <h3 className="font-serif text-xl tracking-tight">{title}</h3>
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{kicker}</span>
    </div>
  );
}

export default function ChartSections({ result, policy, scenarioLabel, isComputing }: Props) {
  const [active, setActive] = useState<SectionId>('powertrain');
  const [appsOpen, setAppsOpen] = useState(false);
  const meta = SECTION_META[active];

  return (
    <div>
      {/* Sticky category switcher, sits just under the app header */}
      <nav className="sticky top-14 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur-sm flex gap-2 overflow-x-auto">
        {NAV.map(n => (
          <button
            key={n.id}
            type="button"
            onClick={() => setActive(n.id)}
            aria-pressed={active === n.id}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
              active === n.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-secondary'
            }`}
          >
            {n.label}
          </button>
        ))}
      </nav>

      <div
        className="mt-4 space-y-4"
        style={{ opacity: isComputing ? 0.6 : 1, transition: 'opacity 0.2s' }}
      >
        <SectionHeader title={meta.title} kicker={meta.kicker} />

        {active === 'powertrain' && (
          <>
            <TotalSalesChart years={result.years} scenarioLabel={scenarioLabel} />
            <AnnualSalesChart years={result.years} scenarioLabel={scenarioLabel} />
            <ShareChart years={result.years} scenarioLabel={scenarioLabel} />
            <StockChart years={result.years} scenarioLabel={scenarioLabel} />
            <ZETPenetrationChart years={result.years} policy={policy} scenarioLabel={scenarioLabel} />

            <Collapsible open={appsOpen} onOpenChange={setAppsOpen} className="space-y-4">
              <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm font-medium hover:bg-secondary transition-colors">
                {appsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Applications &amp; segments
                <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {appsOpen ? 'Hide' : 'Show'} · 4 charts
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4">
                <p className="text-xs text-muted-foreground">{PRELIM_NOTE}</p>
                <SegmentSalesChart years={result.years} scenarioLabel={scenarioLabel} />
                <SegmentStockChart years={result.years} scenarioLabel={scenarioLabel} />
                <ApplicationSalesChart years={result.years} scenarioLabel={scenarioLabel} />
                <ApplicationStockChart years={result.years} scenarioLabel={scenarioLabel} />
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {active === 'emissions' && (
          <>
            <EmissionsChart years={result.years} scenarioLabel={scenarioLabel} />
            <CumulativeAvoidedChart years={result.years} scenarioLabel={scenarioLabel} />
          </>
        )}

        {active === 'energy' && (
          <>
            <DieselSavingsChart years={result.years} scenarioLabel={scenarioLabel} />
            <EnergyRequirementsChart years={result.years} scenarioLabel={scenarioLabel} />
          </>
        )}
      </div>
    </div>
  );
}
