import { ScenarioProvider, useScenario } from '@/contexts/ScenarioContext';
import ScenarioPicker from '@/components/ScenarioPicker';
import InputPanel, { InputActionBar } from '@/components/InputPanel';
import ModelHealthBadge from '@/components/ModelHealthBadge';
import KpiCard from '@/components/KpiCard';
import KpiRail, { type KpiItem } from '@/components/KpiRail';
import ChartSections from '@/components/ChartSections';
import { useSimulation } from '@/hooks/useSimulation';
import { Truck } from 'lucide-react';
import { useEffect, useState } from 'react';

const SCENARIO_LABEL: Record<string, string> = {
  BAU: 'Default',
  'BWS-1': 'BWS-1',
  'BWS-2': 'BWS-2',
  BEST: 'BEST',
  Custom: 'Custom',
};

function DashboardContent() {
  const { config, activeScenario } = useScenario();
  const { result: simResult, isComputing } = useSimulation(config);
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    if (simResult) {
      console.log('SimulationResult:', simResult);
    }
  }, [simResult]);

  const scenarioLabel = SCENARIO_LABEL[activeScenario] ?? activeScenario;
  const yFinal = simResult?.years[simResult.years.length - 1];

  // Diesel peak-sales year (Diesel only — other powertrains dropped from rail).
  const dieselPeak = simResult
    ? simResult.years.reduce(
        (best, y) => (y.salesByPT.Diesel > best.salesByPT.Diesel ? y : best),
        simResult.years[0],
      )
    : null;

  // Cumulative diesel displaced 2026–55, billion litres.
  // Excel 'Energy Requirementsfinal' col 5: Σ(Diesel No P/T Adoption − Diesel actual); reported in Billion Litres.
  const cumDieselSavedBnL = simResult
    ? simResult.years.reduce(
        (s, y) => s + Math.max(0, y.dieselCounterfactualLitres - y.energyByPT.Diesel),
        0,
      ) / 1000
    : 0;

  const kpis: KpiItem[] = simResult ? [
    {
      label: 'Market Size 2055',
      value: yFinal ? `${(yFinal.tiv / 1e5).toFixed(1)} Lakh` : '—',
      context: 'Total industry volume, trucks/yr (2055)',
    },
    {
      label: '50% ZET Adoption',
      value: simResult.year50PctZet ?? '—',
      context: 'ZET share of new sales crosses 50%',
    },
    {
      label: 'Diesel Peak Sales',
      value: dieselPeak ? dieselPeak.year : '—',
      context: dieselPeak ? `${Math.round(dieselPeak.salesByPT.Diesel).toLocaleString()} trucks/yr` : undefined,
    },
    {
      // Excel 'Emissions' col 11 "Cummulative Emission Reduction" = Σ(diesel-only − with-adoption).
      label: 'CO₂ Reduction 2026–55',
      value: `${Math.round(simResult.cumulativeCO2Avoided).toLocaleString()} MMT`,
      context: 'Cumulative, vs an all-diesel fleet',
    },
    {
      label: 'Diesel Saved 2026–55',
      value: `${Math.round(cumDieselSavedBnL).toLocaleString()} bn L`,
      context: 'Cumulative diesel displaced vs all-diesel fleet',
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
              <h1 className="text-sm font-bold leading-tight tracking-tight">
                PTCM Dashboard · India M&HDT Trucks
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground leading-snug">
                2026 — 2055 · Interactive cost &amp; fleet model
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
        {/* Left sidebar — user configurable parameters */}
        <aside className="w-full lg:w-[360px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-border lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:flex lg:flex-col">
          <div className="flex-1 min-h-0 lg:overflow-y-auto overflow-x-hidden px-4 py-5">
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">User configurable parameters</p>
            </div>
            <InputPanel />
          </div>
          <InputActionBar />
        </aside>

        {/* Center — editorial title + stacked chart sections */}
        <main className="flex-1 min-w-0 px-4 lg:px-8 py-6">
          <div className="mb-6">
            <h2 className="font-serif text-3xl lg:text-[2.5rem] leading-tight tracking-tight">
              Powertrain transition projections - M&HD trucks (2026-55)
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
