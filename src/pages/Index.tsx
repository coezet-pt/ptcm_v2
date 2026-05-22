import { ScenarioProvider, useScenario } from '@/contexts/ScenarioContext';
import ScenarioPicker from '@/components/ScenarioPicker';
import InputPanel from '@/components/InputPanel';
import ModelHealthBadge from '@/components/ModelHealthBadge';
import KpiCard from '@/components/KpiCard';
import { useSimulation } from '@/hooks/useSimulation';
import { Truck } from 'lucide-react';
import { useEffect } from 'react';

import AnnualSalesChart from '@/components/charts/AnnualSalesChart';
import ShareChart from '@/components/charts/ShareChart';
import StockChart from '@/components/charts/StockChart';
import EmissionsChart from '@/components/charts/EmissionsChart';
import ZETPenetrationChart from '@/components/charts/ZETPenetrationChart';


const SCENARIO_LABEL: Record<string, string> = {
  BAU: 'Basic',
  'BWS-1': 'BWS-1',
  'BWS-2': 'BWS-2',
  BEST: 'BEST',
  Custom: 'Custom',
};

function DashboardContent() {
  const { config, activeScenario } = useScenario();
  const { result: simResult, isComputing } = useSimulation(config);

  useEffect(() => {
    if (simResult) {
      console.log('SimulationResult:', simResult);
    }
  }, [simResult]);

  const scenarioLabel = SCENARIO_LABEL[activeScenario] ?? activeScenario;
  const y2045 = simResult?.years.find(y => y.year === 2045);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight">
                PTCM Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">
                India Heavy Truck Fleet Transition 2025–2055
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 relative">
            <ModelHealthBadge simResult={simResult} />
            <ScenarioPicker />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <InputPanel />

        {simResult && (
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
              label="Year of 50% ZET"
              value={simResult.year50PctZet ?? '—'}
              context="ZET share of new sales crosses 50%"
            />
            <KpiCard
              label="ZET Share 2045"
              value={y2045 ? `${(y2045.zetShare * 100).toFixed(1)}%` : '—'}
              context="Of annual sales"
            />
            <KpiCard
              label="Total ZET Sales"
              value={`${(simResult.totalZetSales / 1e6).toFixed(1)}M`}
              context="Cumulative trucks 2025–2055"
            />
            <KpiCard
              label="Diesel Stock Peak"
              value={simResult.dieselStockPeakYear}
              context={`${(simResult.dieselStockPeakValue / 1e6).toFixed(1)}M vehicles`}
            />
            <KpiCard
              label="CO₂ Avoided"
              value={`${Math.round(simResult.cumulativeCO2Avoided).toLocaleString()} Mt`}
              context="Cumulative vs diesel counterfactual"
            />
          </section>
        )}

        <section>
          {simResult ? (
            <div
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              style={{ opacity: isComputing ? 0.6 : 1, transition: 'opacity 0.2s' }}
            >
              <AnnualSalesChart years={simResult.years} scenarioLabel={scenarioLabel} />
              <ShareChart years={simResult.years} scenarioLabel={scenarioLabel} />
              <StockChart years={simResult.years} scenarioLabel={scenarioLabel} />
              <EmissionsChart years={simResult.years} scenarioLabel={scenarioLabel} />
              <ZETPenetrationChart years={simResult.years} policy={config.policy} scenarioLabel={scenarioLabel} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center min-h-[400px]">
              <p className="text-muted-foreground text-sm">Running simulation…</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function Index() {
  return (
    <ScenarioProvider>
      <DashboardContent />
    </ScenarioProvider>
  );
}
