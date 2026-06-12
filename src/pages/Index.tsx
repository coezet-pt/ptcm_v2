import { ScenarioProvider, useScenario } from '@/contexts/ScenarioContext';
import ScenarioPicker from '@/components/ScenarioPicker';
import InputPanel from '@/components/InputPanel';
import ModelHealthBadge from '@/components/ModelHealthBadge';
import KpiCard from '@/components/KpiCard';
import KpiRail, { type KpiItem } from '@/components/KpiRail';
import ChartSections from '@/components/ChartSections';
import { useSimulation } from '@/hooks/useSimulation';
import { Truck } from 'lucide-react';
import { useEffect, useState } from 'react';

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
  const [railOpen, setRailOpen] = useState(true);

  useEffect(() => {
    if (simResult) {
      console.log('SimulationResult:', simResult);
    }
  }, [simResult]);

  const scenarioLabel = SCENARIO_LABEL[activeScenario] ?? activeScenario;
  const y2045 = simResult?.years.find(y => y.year === 2045);

  const kpis: KpiItem[] = simResult ? [
    {
      label: 'Year of 50% ZET',
      value: simResult.year50PctZet ?? '—',
      context: 'ZET share of new sales crosses 50%',
    },
    {
      label: 'ZET Share 2045',
      value: y2045 ? `${(y2045.zetShare * 100).toFixed(1)}%` : '—',
      context: 'Of annual sales',
    },
    {
      label: 'Total ZET Sales',
      value: `${(simResult.totalZetSales / 1e6).toFixed(1)}M`,
      context: 'Cumulative trucks 2025–2055',
    },
    {
      label: 'Diesel Stock Peak',
      value: simResult.dieselStockPeakYear,
      context: `${(simResult.dieselStockPeakValue / 1e6).toFixed(1)}M vehicles`,
    },
    {
      label: 'CO₂ Avoided',
      value: `${Math.round(simResult.cumulativeCO2Avoided).toLocaleString()} Mt`,
      context: 'Cumulative vs diesel counterfactual',
    },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
              <Truck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold leading-tight tracking-tight truncate">
                PTCM Dashboard · India M&HDT Trucks
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground truncate">
                2025 — 2055 · Interactive cost &amp; fleet model
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 relative shrink-0">
            <ModelHealthBadge simResult={simResult} />
            <ScenarioPicker />
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row items-stretch">
        {/* Left sidebar — transition controls */}
        <aside className="w-full lg:w-[360px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-border lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto px-4 py-5">
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Transition controls</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Adjust cost trajectories, constants and policy levers, then apply to refresh the model.
            </p>
          </div>
          <InputPanel />
        </aside>

        {/* Center — editorial title + stacked chart sections */}
        <main className="flex-1 min-w-0 px-4 lg:px-8 py-6">
          <div className="mb-6">
            <h2 className="font-serif text-3xl lg:text-[2.5rem] leading-tight tracking-tight">
              Powertrain transition — <em className="text-accent">heavy trucks</em>, 2025–2055
            </h2>
            <p className="mt-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {scenarioLabel} scenario · PTCM interactive engine
            </p>
          </div>

          {/* KPI band — small screens only; right rail covers lg+ */}
          {simResult && (
            <section className="lg:hidden grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {kpis.map(k => (
                <KpiCard key={k.label} label={k.label} value={k.value} context={k.context} />
              ))}
            </section>
          )}

          {simResult ? (
            <ChartSections
              result={simResult}
              policy={config.policy}
              scenarioLabel={scenarioLabel}
              isComputing={isComputing}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center min-h-[400px]">
              <p className="text-muted-foreground text-sm">Running simulation…</p>
            </div>
          )}
        </main>

        {/* Right rail — headline metrics, collapsible */}
        {simResult && (
          <aside className={`hidden lg:block shrink-0 transition-[width] duration-200 ${railOpen ? 'w-[250px]' : 'w-10'}`}>
            <KpiRail items={kpis} open={railOpen} onToggle={() => setRailOpen(o => !o)} />
          </aside>
        )}
      </div>
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
