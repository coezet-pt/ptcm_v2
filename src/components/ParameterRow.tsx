import { useMemo, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { ParameterKey } from '@/lib/types';
import { PARAMETER_META } from '@/lib/constants/parameterMeta';
import { useScenario } from '@/contexts/ScenarioContext';
import { buildSeriesFromConfig } from '@/lib/sim/timeSeries';
import ParameterEditor from './ParameterEditor';

export const DELTA_LABELS = ['2026-30', '2031-35', '2036-40', '2041-45', '2046-50', '2051-55'] as const;
export const DELTA_KEYS = ['d2530', 'd3135', 'd3640', 'd4145', 'd4650', 'd5155'] as const;
export type DeltaKey = typeof DELTA_KEYS[number];

interface Props {
  paramKey: ParameterKey;
  labelOverride?: string;
  unitOverride?: string;
}

export default function ParameterRow({ paramKey, labelOverride, unitOverride }: Props) {
  const { draftConfig, updateParameter, setParameterOverride, clearParameterOverride } = useScenario();
  const [open, setOpen] = useState(false);
  const meta = PARAMETER_META[paramKey];
  const param = draftConfig.parameters[paramKey];

  const isGrowthRate = paramKey.includes('growth');
  const label = labelOverride ?? meta?.label ?? paramKey;
  const unit = unitOverride ?? meta?.unit ?? '';
  const tooltip = meta?.tooltip ?? '';
  const baseValueMax = meta?.maxValue;
  const pinCount = param.overrides ? Object.keys(param.overrides).length : 0;

  // Live final-year (2055) value, recomputed from the draft config so the
  // projected value updates the instant a base/CAGR/pin changes — no Apply needed.
  const value2055 = useMemo(
    () => buildSeriesFromConfig(param, isGrowthRate).at(-1) ?? param.baseValue,
    [param, isGrowthRate],
  );
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="py-1 border-b border-border/50 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-2 text-left hover:bg-muted/40 rounded px-1 py-1.5 transition-colors"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-sm font-medium flex-1 flex items-start gap-1.5 min-w-0">
          <span className="whitespace-normal leading-snug break-words">{label}</span>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span onClick={e => e.stopPropagation()}>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px]"><p>{tooltip}</p></TooltipContent>
            </Tooltip>
          )}
        </span>
        <span className="flex flex-col items-end shrink-0 leading-tight">
          <span className="font-mono text-sm text-muted-foreground tabular-nums">
            {fmt(param.baseValue)}
            <span className="text-[10px] ml-1">{unit}</span>
          </span>
          <span className="font-mono text-[10px] text-primary tabular-nums">
            2055: {fmt(value2055)}
          </span>
        </span>
        {pinCount > 0 && (
          <span className="text-[10px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5">
            {pinCount} pin{pinCount > 1 ? 's' : ''}
          </span>
        )}
      </button>
      {open && (
        <div className="ml-5 mt-1 mb-2 border-l border-border/60 pl-3">
          <ParameterEditor
            config={param}
            unit={unit}
            baseValueMax={baseValueMax}
            isGrowthRate={isGrowthRate}
            baseStep={isGrowthRate ? 0.01 : 1}
            onBaseChange={v => updateParameter(paramKey, 'baseValue', v)}
            onCagrChange={(field, v) => updateParameter(paramKey, field, v)}
            onSetOverride={(year, value) => setParameterOverride(paramKey, year, value)}
            onClearOverride={year => clearParameterOverride(paramKey, year)}
            cagrMax={0.20}
          />
        </div>
      )}
    </div>
  );
}