import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { SimulationResult, PolicyConfig } from '@/lib/types';

import AnnualSalesChart from '@/components/charts/AnnualSalesChart';
import ShareChart from '@/components/charts/ShareChart';
import StockChart from '@/components/charts/StockChart';
import EmissionsChart from '@/components/charts/EmissionsChart';
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

const TABS = [
  { id: 'sales',        label: 'Annual Sales' },
  { id: 'share',        label: 'Market Share' },
  { id: 'stock',        label: 'Fleet Stock' },
  { id: 'emissions',    label: 'Emissions' },
  { id: 'zet',          label: 'ZET Penetration' },
  { id: 'seg-sales',    label: 'Sales by Segment' },
  { id: 'seg-stock',    label: 'Stock by Segment' },
  { id: 'app-sales',    label: 'Sales by Application' },
  { id: 'app-stock',    label: 'Stock by Application' },
];

export default function ChartTabs({ result, policy, scenarioLabel, isComputing }: Props) {
  const [active, setActive] = useState('sales');

  return (
    <Tabs value={active} onValueChange={setActive} className="w-full">
      <div className="overflow-x-auto -mx-1 px-1">
        <TabsList className="inline-flex h-auto flex-nowrap whitespace-nowrap">
          {TABS.map(t => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 py-1.5">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <div
        className="mt-3"
        style={{ opacity: isComputing ? 0.6 : 1, transition: 'opacity 0.2s' }}
      >
        <TabsContent value="sales" className="mt-0">
          <AnnualSalesChart years={result.years} scenarioLabel={scenarioLabel} />
        </TabsContent>
        <TabsContent value="share" className="mt-0">
          <ShareChart years={result.years} scenarioLabel={scenarioLabel} />
        </TabsContent>
        <TabsContent value="stock" className="mt-0">
          <StockChart years={result.years} scenarioLabel={scenarioLabel} />
        </TabsContent>
        <TabsContent value="emissions" className="mt-0">
          <EmissionsChart years={result.years} scenarioLabel={scenarioLabel} />
        </TabsContent>
        <TabsContent value="zet" className="mt-0">
          <ZETPenetrationChart years={result.years} policy={policy} scenarioLabel={scenarioLabel} />
        </TabsContent>
        <TabsContent value="seg-sales" className="mt-0">
          <SegmentSalesChart years={result.years} scenarioLabel={scenarioLabel} />
        </TabsContent>
        <TabsContent value="seg-stock" className="mt-0">
          <SegmentStockChart years={result.years} scenarioLabel={scenarioLabel} />
        </TabsContent>
        <TabsContent value="app-sales" className="mt-0">
          <ApplicationSalesChart years={result.years} scenarioLabel={scenarioLabel} />
        </TabsContent>
        <TabsContent value="app-stock" className="mt-0">
          <ApplicationStockChart years={result.years} scenarioLabel={scenarioLabel} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
