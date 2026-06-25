import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useScenario } from '@/contexts/ScenarioContext';
import { buildParamSummary, PARAM_PERIOD_LABELS, fmtNum } from '@/lib/paramSummary';

/**
 * Collapsible summary of the configured input parameters, shown above the charts.
 * Reflects the *applied* config (the one driving the charts) — its 2026 base
 * value, the six period CAGRs the user entered, and the projected 2055 value.
 */
export default function ParameterSummaryTable() {
  const { config } = useScenario();
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => buildParamSummary(config), [config]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-4">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm font-medium hover:bg-secondary transition-colors">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Configured parameters
        <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {open ? 'Hide' : 'Show'} · 2026 base → 2055
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-2 py-1.5 font-medium">Parameter</th>
                <th className="px-2 py-1.5 font-medium">Unit</th>
                <th className="px-2 py-1.5 text-right font-medium">2026</th>
                {PARAM_PERIOD_LABELS.map(l => (
                  <th key={l} className="px-2 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap">
                    {l}<br /><span className="text-[9px]">CAGR %</span>
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right font-semibold">2055</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r, i) => (
                <tr key={r.label} className={i % 2 ? 'bg-muted/30' : ''}>
                  <td className="px-2 py-1 font-sans whitespace-nowrap">
                    {r.label}
                    {r.pins > 0 && (
                      <span className="ml-1 text-[9px] text-primary">({r.pins} pin{r.pins > 1 ? 's' : ''})</span>
                    )}
                  </td>
                  <td className="px-2 py-1 font-sans text-muted-foreground whitespace-nowrap">{r.unit}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmtNum(r.base)}</td>
                  {r.cagrs.map((c, j) => (
                    <td key={j} className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                      {c === 0 ? '—' : `${c > 0 ? '+' : ''}${c.toFixed(1)}`}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-semibold tabular-nums text-primary">{fmtNum(r.value2055)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          2055 is the projected value after compounding each period's CAGR from the 2026 base
          (pinned years override the trajectory). Reflects the currently applied scenario.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
