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

type BlockKind = 'intro' | 'section' | 'chart';

/**
 * Wrap a section so each becomes its own paginated block in the PDF. `kind`
 * drives pagination in report.tsx: 'section' banners force a new page, 'chart'
 * blocks are laid 2 per page, 'intro' flows on the opening page(s).
 */
function Block({ kind, children }: { kind: BlockKind; children: React.ReactNode }) {
  return <div data-report-block data-block-kind={kind} style={{ marginBottom: 12 }}>{children}</div>;
}

/** Section banner — same title + kicker used on the dashboard (see SECTION_META). */
function SectionBanner({ title, kicker }: { title: string; kicker: string }) {
  return (
    <Block kind="section">
      <div className="flex items-baseline justify-between gap-3 flex-wrap border-b-2 border-border pb-2">
        <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{kicker}</span>
      </div>
    </Block>
  );
}

/** A numbered chart block: "Figure N" eyebrow above the chart card. */
function Figure({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <Block kind="chart">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
        Figure {n}
      </p>
      {children}
    </Block>
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

  // Sequenced sections; figures are numbered with a running counter so the
  // captions read Figure 1..13 across the whole report.
  const sections = [
    {
      meta: SECTION_META.powertrain,
      charts: [
        <TotalSalesChart years={years} scenarioLabel={scenarioLabel} />,
        <AnnualSalesChart years={years} scenarioLabel={scenarioLabel} />,
        <ShareChart years={years} scenarioLabel={scenarioLabel} />,
        <StockChart years={years} scenarioLabel={scenarioLabel} />,
        <ZETPenetrationChart years={years} policy={policy} scenarioLabel={scenarioLabel} />,
        <SegmentSalesChart years={years} scenarioLabel={scenarioLabel} />,
        <SegmentStockChart years={years} scenarioLabel={scenarioLabel} />,
        <ApplicationSalesChart years={years} scenarioLabel={scenarioLabel} />,
        <ApplicationStockChart years={years} scenarioLabel={scenarioLabel} />,
      ],
    },
    {
      meta: SECTION_META.emissions,
      charts: [
        <EmissionsChart years={years} scenarioLabel={scenarioLabel} />,
        <CumulativeAvoidedChart years={years} scenarioLabel={scenarioLabel} />,
      ],
    },
    {
      meta: SECTION_META.energy,
      charts: [
        <DieselSavingsChart years={years} scenarioLabel={scenarioLabel} />,
        <EnergyRequirementsChart years={years} scenarioLabel={scenarioLabel} />,
      ],
    },
  ];
  let figureNo = 0;

  return (
    <div className="bg-background text-foreground" style={{ padding: 8 }}>
      <Block kind="intro">
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

      <Block kind="intro">
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

      {/* One banner per section (forces a new page), then its charts 2-per-page. */}
      {sections.map(section => (
        <div key={section.meta.title} style={{ display: 'contents' }}>
          <SectionBanner title={section.meta.title} kicker={section.meta.kicker} />
          {section.charts.map((chart, i) => (
            <Figure key={i} n={++figureNo}>{chart}</Figure>
          ))}
        </div>
      ))}
    </div>
  );
}
