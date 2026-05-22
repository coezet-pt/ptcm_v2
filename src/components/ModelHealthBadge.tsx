import { useMemo } from 'react';
import { CheckCircle, AlertTriangle, XCircle, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SimulationResult } from '@/lib/types';
import { runSanityChecks } from '@/lib/sim/sanityCheck';

interface Props {
  simResult: SimulationResult | null;
}

export default function ModelHealthBadge({ simResult }: Props) {
  const checks = useMemo(
    () => (simResult ? runSanityChecks(simResult) : []),
    [simResult],
  );

  if (!simResult || checks.length === 0) return null;

  const passCount = checks.filter(c => c.passed).length;
  const total = checks.length;
  const failCount = total - passCount;
  const failures = checks.filter(c => !c.passed);

  const variant = failCount === 0 ? 'default' : failCount <= 3 ? 'secondary' : 'destructive';
  const Icon = failCount === 0 ? CheckCircle : failCount <= 3 ? AlertTriangle : XCircle;
  const color = failCount === 0 ? 'text-emerald-500' : failCount <= 3 ? 'text-amber-500' : 'text-red-500';

  const tooltipSummary = failCount === 0
    ? `All ${total} checks passing`
    : `${passCount}/${total} checks passing — Failing: ${failures.map(f => f.message).join('; ').slice(0, 220)}${failures.map(f => f.message).join('; ').length > 220 ? '…' : ''}`;

  return (
    <Collapsible>
      <Tooltip>
        <TooltipTrigger asChild>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs">
              <Badge variant={variant} className="gap-1 cursor-pointer">
                <Icon className={`h-3 w-3 ${color}`} />
                {passCount}/{total}
                <ChevronDown className="h-3 w-3" />
              </Badge>
            </button>
          </CollapsibleTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm text-xs">
          {tooltipSummary}
        </TooltipContent>
      </Tooltip>
      <CollapsibleContent className="absolute right-0 top-full mt-1 z-50 w-96 rounded-lg border bg-card p-3 shadow-lg">
        <p className="text-xs font-semibold mb-2">Model Health Checks</p>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {checks.map(c => (
            <div key={c.name} className="flex items-start gap-2 text-xs">
              {c.passed
                ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                : <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground ml-1">
                  {c.message} (expected: {c.expected})
                </span>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
