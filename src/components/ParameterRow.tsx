import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import type { ParameterKey, ParameterConfig } from '@/lib/types';
import { PARAMETER_META } from '@/lib/constants/parameterMeta';
import { useScenario } from '@/contexts/ScenarioContext';

export const DELTA_LABELS = ['2025-30', '2031-35', '2036-40', '2041-45', '2046-50', '2051-55'] as const;
export const DELTA_KEYS = ['d2530', 'd3135', 'd3640', 'd4145', 'd4650', 'd5155'] as const;
export type DeltaKey = typeof DELTA_KEYS[number];

const CAGR_MAX = 0.10; // ±10% per Dashboard spec

interface Props {
  paramKey: ParameterKey;
  /** Override label/unit (for parameters that don't yet exist in PARAMETER_META). */
  labelOverride?: string;
  unitOverride?: string;
}

export default function ParameterRow({ paramKey, labelOverride, unitOverride }: Props) {
  const { draftConfig, updateParameter } = useScenario();
  const meta = PARAMETER_META[paramKey];
  const param = draftConfig.parameters[paramKey];

  const isGrowthRate = paramKey.includes('growth');
  const label = labelOverride ?? meta?.label ?? paramKey;
  const unit = unitOverride ?? meta?.unit ?? '';
  const tooltip = meta?.tooltip ?? '';
  const baseValueMax = meta?.maxValue;

  const baseExceeded = baseValueMax !== undefined && param.baseValue > baseValueMax;

  return (
    <div className="py-3 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm font-medium min-w-[180px]">
          {label}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px]"><p>{tooltip}</p></TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            className={`h-8 w-28 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${baseExceeded ? 'border-destructive ring-1 ring-destructive' : ''}`}
            value={param.baseValue}
            step={isGrowthRate ? 0.01 : 1}
            onChange={e => updateParameter(paramKey, 'baseValue', Number(e.target.value))}
          />
          <span className="text-xs text-muted-foreground">{unit}</span>
          <span className="text-[10px] text-muted-foreground">(2025 base{baseValueMax !== undefined ? `, max ${baseValueMax}` : ''})</span>
        </div>
      </div>
      {baseExceeded && (
        <p className="text-[11px] text-destructive mt-1 ml-[192px]">Exceeds max of {baseValueMax}</p>
      )}
      <div className="mt-2 ml-[192px] flex items-end gap-3 flex-wrap">
        <span className="text-[11px] text-muted-foreground self-center">CAGR %</span>
        {DELTA_KEYS.map((dk, i) => {
          const val = param[dk];
          const cagrExceeded = Math.abs(val) > CAGR_MAX;
          return (
            <div key={dk} className="flex flex-col">
              <span className="text-[10px] text-muted-foreground mb-0.5">{DELTA_LABELS[i]}</span>
              <Input
                type="number"
                className={`h-8 w-20 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${cagrExceeded ? 'border-destructive ring-1 ring-destructive' : ''}`}
                value={(val * 100).toFixed(2)}
                step={0.1}
                onChange={e => updateParameter(paramKey, dk, Number(e.target.value) / 100)}
                title={cagrExceeded ? 'Exceeds ±10% cap' : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
