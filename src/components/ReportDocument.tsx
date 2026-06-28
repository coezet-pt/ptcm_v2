import type { SimulationResult, PolicyConfig, ScenarioConfig } from '@/lib/types';
import { buildParamSummary, buildOtherInputs, PARAM_PERIOD_LABELS, fmtNum } from '@/lib/paramSummary';
import { SECTION_META } from '@/components/ChartSections';

import TotalSalesChart from '@/components/charts/TotalSalesChart';
import AnnualSalesChart from '@/components/charts/AnnualSalesChart';
import ShareChart from '@/components/charts/ShareChart';
import StockChart from '@/components/charts/StockChart';
import ZETPenetrationChart from '@/components/charts/ZETPenetrationChart';
import SegmentSalesChart from '@/components/charts/SegmentSalesChart';
import SegmentStockChart from '@/components/charts/SegmentStockChart';
import ApplicationSalesChart from '@/components/charts/ApplicationSalesChart';
import ApplicationStockChart from '@/components/charts/ApplicationStockChart';
import EmissionsChart from '@/components/charts/EmissionsChart';
import CumulativeAvoidedChart from '@/components/charts/CumulativeAvoidedChart';
import DieselSavingsChart from '@/components/charts/DieselSavingsChart';
import EnergyRequirementsChart from '@/components/charts/EnergyRequirementsChart';

interface Props {
  result: SimulationResult;
  config: ScenarioConfig;
  policy: PolicyConfig;
  scenarioLabel: string;
}

/** Wrap a section so each becomes its own paginated block in the PDF. */
function Block({ children }: { children: React.ReactNode }) {
  return <div data-report-block style={{ marginBottom: 12 }}>{children}</div>;
}

/** Same section heading used on the dashboard (title + kicker), for the PDF. */
function SectionHeading({ title, kicker }: { title: string; kicker: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap border-b border-border pb-2 mb-3">
      <h2 className="font-serif text-xl tracking-tight">{title}</h2>
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{kicker}</span>
    </div>
  );
}

/**
 * Off-screen report layout captured block-by-block into a PDF. Renders every
 * chart (across all tabs) plus the configured-parameters table. The capturing
 * code hides chart action buttons / data-table footers via the `.report-capture`
 * CSS scope (see index.css).
 */
export default function ReportDocument({ result, config, policy, scenarioLabel }: Props) {
  const years = result.years;
  const rows = buildParamSummary(config);
  const otherSections = buildOtherInputs(config);
  const generated = new Date().toLocaleString();
  const cellBorder = { border: '1px solid hsl(var(--border))' } as const;

  return (
    <div className="bg-background text-foreground" style={{ padding: 8 }}>
      <Block>
        <div style={{ borderBottom: '2px solid hsl(var(--border))', paddingBottom: 8, marginBottom: 8 }}>
          <h1 className="font-serif text-2xl tracking-tight">
            PTCM Dashboard — Powertrain transition projections (2026–55)
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            India M&amp;HDT Trucks · {scenarioLabel} scenario · Generated {generated}
          </p>
        </div>

        <h2 className="font-serif text-lg mb-2">Configured parameters</h2>
        <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-2 py-1 font-medium" style={{ border: '1px solid hsl(var(--border))' }}>Parameter</th>
              <th className="px-2 py-1 font-medium" style={{ border: '1px solid hsl(var(--border))' }}>Unit</th>
              <th className="px-2 py-1 text-right font-medium" style={{ border: '1px solid hsl(var(--border))' }}>2026</th>
              {PARAM_PERIOD_LABELS.map(l => (
                <th key={l} className="px-2 py-1 text-right font-medium" style={{ border: '1px solid hsl(var(--border))' }}>
                  {l}<br />CAGR %
                </th>
              ))}
              <th className="px-2 py-1 text-right font-semibold" style={{ border: '1px solid hsl(var(--border))' }}>2055</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map(r => (
              <tr key={r.label}>
                <td className="px-2 py-1 font-sans" style={{ border: '1px solid hsl(var(--border))' }}>
                  {r.label}{r.pins > 0 ? ` (${r.pins} pin${r.pins > 1 ? 's' : ''})` : ''}
                </td>
                <td className="px-2 py-1 font-sans text-muted-foreground" style={{ border: '1px solid hsl(var(--border))' }}>{r.unit}</td>
                <td className="px-2 py-1 text-right" style={{ border: '1px solid hsl(var(--border))' }}>{fmtNum(r.base)}</td>
                {r.cagrs.map((c, j) => (
                  <td key={j} className="px-2 py-1 text-right text-muted-foreground" style={{ border: '1px solid hsl(var(--border))' }}>
                    {c === 0 ? '—' : `${c > 0 ? '+' : ''}${c.toFixed(1)}`}
                  </td>
                ))}
                <td className="px-2 py-1 text-right font-semibold" style={{ border: '1px solid hsl(var(--border))' }}>{fmtNum(r.value2055)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      <Block>
        <h2 className="font-serif text-lg mb-2">Other configured inputs</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {otherSections.map(section => (
            <table key={section.title} className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-2 py-1 font-medium" style={cellBorder}>{section.title}</th>
                  <th className="px-2 py-1" style={cellBorder} />
                </tr>
              </thead>
              <tbody>
                {section.rows.map(r => (
                  <tr key={r.label}>
                    <td className="px-2 py-1" style={cellBorder}>{r.label}</td>
                    <td className="px-2 py-1 text-right font-mono" style={cellBorder}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </Block>

      {/* Powertrain mix — heading rides with the first chart so it never orphans at a page break */}
      <Block>
        <SectionHeading title={SECTION_META.powertrain.title} kicker={SECTION_META.powertrain.kicker} />
        <TotalSalesChart years={years} scenarioLabel={scenarioLabel} />
      </Block>
      <Block><AnnualSalesChart years={years} scenarioLabel={scenarioLabel} /></Block>
      <Block><ShareChart years={years} scenarioLabel={scenarioLabel} /></Block>
      <Block><StockChart years={years} scenarioLabel={scenarioLabel} /></Block>
      <Block><ZETPenetrationChart years={years} policy={policy} scenarioLabel={scenarioLabel} /></Block>
      <Block><SegmentSalesChart years={years} scenarioLabel={scenarioLabel} /></Block>
      <Block><SegmentStockChart years={years} scenarioLabel={scenarioLabel} /></Block>
      <Block><ApplicationSalesChart years={years} scenarioLabel={scenarioLabel} /></Block>
      <Block><ApplicationStockChart years={years} scenarioLabel={scenarioLabel} /></Block>

      {/* Emissions */}
      <Block>
        <SectionHeading title={SECTION_META.emissions.title} kicker={SECTION_META.emissions.kicker} />
        <EmissionsChart years={years} scenarioLabel={scenarioLabel} />
      </Block>
      <Block><CumulativeAvoidedChart years={years} scenarioLabel={scenarioLabel} /></Block>

      {/* Energy requirements & savings */}
      <Block>
        <SectionHeading title={SECTION_META.energy.title} kicker={SECTION_META.energy.kicker} />
        <DieselSavingsChart years={years} scenarioLabel={scenarioLabel} />
      </Block>
      <Block><EnergyRequirementsChart years={years} scenarioLabel={scenarioLabel} /></Block>
    </div>
  );
}
