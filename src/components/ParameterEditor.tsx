import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Pin } from 'lucide-react';
import type { ParameterConfig } from '@/lib/types';
import { DELTA_LABELS, DELTA_KEYS, type DeltaKey } from './ParameterRow';

const CAGR_MAX = 0.10;
const YEARS = Array.from({ length: 30 }, (_, i) => 2026 + i); // 2026..2055

interface Props {
  config: ParameterConfig;
  unit?: string;
  baseValueMax?: number;
  isGrowthRate?: boolean;
  baseStep?: number;
  onBaseChange: (value: number) => void;
  onCagrChange: (field: DeltaKey, value: number) => void;
  onSetOverride: (year: number, value: number) => void;
  onClearOverride: (year: number) => void;
}

/** Build a single-parameter 2025–2055 series mirroring buildTimeSeries logic. */
function buildSeries(cfg: ParameterConfig, isGrowthRate: boolean): number[] {
  const arr: number[] = new Array(31);
  arr[0] = isGrowthRate ? 1 : cfg.baseValue;
  for (let i = 1; i < 31; i++) {
    const y = 2025 + i;
    const d =
      y <= 2030 ? cfg.d2530 :
      y <= 2035 ? cfg.d3135 :
      y <= 2040 ? cfg.d3640 :
      y <= 2045 ? cfg.d4145 :
      y <= 2050 ? cfg.d4650 : cfg.d5155;
    arr[i] = arr[i - 1] * (1 + d);
    if (!isGrowthRate && cfg.overrides && cfg.overrides[y] !== undefined) {
      arr[i] = cfg.overrides[y];
    }
  }
  return arr;
}

function Sparkline({ series }: { series: number[] }) {
  const { d, min, max } = useMemo(() => {
    const mn = Math.min(...series);
    const mx = Math.max(...series);
    const range = mx - mn || 1;
    const W = 240, H = 48;
    const step = W / (series.length - 1);
    const path = series
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(H - ((v - mn) / range) * H).toFixed(1)}`)
      .join(' ');
    return { d: path, min: mn, max: mx };
  }, [series]);

  return (
    <div className="flex items-center gap-3">
      <svg width={240} height={48} className="overflow-visible">
        <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} />
      </svg>
      <div className="text-[10px] text-muted-foreground font-mono leading-tight">
        <div>2025: {series[0].toFixed(2)}</div>
        <div>2055: {series[series.length - 1].toFixed(2)}</div>
        <div className="opacity-60">min {min.toFixed(1)} · max {max.toFixed(1)}</div>
      </div>
    </div>
  );
}

export default function ParameterEditor({
  config, unit, baseValueMax, isGrowthRate, baseStep,
  onBaseChange, onCagrChange, onSetOverride, onClearOverride,
}: Props) {
  const [year, setYear] = useState<number>(2030);
  const [draftVal, setDraftVal] = useState<string>('');

  const series = useMemo(() => buildSeries(config, !!isGrowthRate), [config, isGrowthRate]);
  const baseExceeded = baseValueMax !== undefined && config.baseValue > baseValueMax;
  const overrides = config.overrides ?? {};
  const pinnedYears = Object.keys(overrides).map(Number).sort((a, b) => a - b);

  const handlePin = () => {
    const n = Number(draftVal);
    if (!Number.isFinite(n)) return;
    onSetOverride(year, n);
    setDraftVal('');
  };

  return (
    <div className="space-y-4 pt-3 pl-1">
      {/* 2025 base value */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-muted-foreground w-[100px]">2025 base value</span>
        <Input
          type="number"
          step={baseStep ?? (isGrowthRate ? 0.01 : 1)}
          className={`h-8 w-28 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${baseExceeded ? 'border-destructive ring-1 ring-destructive' : ''}`}
          value={config.baseValue}
          onChange={e => onBaseChange(Number(e.target.value))}
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
        {baseValueMax !== undefined && (
          <span className="text-[10px] text-muted-foreground">max {baseValueMax}</span>
        )}
        {baseExceeded && (
          <span className="text-[11px] text-destructive">Exceeds max of {baseValueMax}</span>
        )}
      </div>

      {/* Spot-year override */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pin a year (override)</div>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground mb-0.5">Year</span>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground mb-0.5">Value at {year}</span>
            <Input
              type="number"
              step={baseStep ?? 0.1}
              placeholder={series[year - 2025].toFixed(2)}
              className="h-8 w-28 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={draftVal}
              onChange={e => setDraftVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handlePin(); }}
            />
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={handlePin} className="gap-1">
            <Pin className="h-3 w-3" /> Pin
          </Button>
        </div>
        {pinnedYears.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pinnedYears.map(y => (
              <span key={y} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-mono">
                {y}: {overrides[y].toFixed(2)}
                <button
                  type="button"
                  onClick={() => onClearOverride(y)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove pin for ${y}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* CAGR by range */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          CAGR % by range <span className="normal-case opacity-70">(editing a range clears pins inside it; max ±10%)</span>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {DELTA_KEYS.map((dk, i) => {
            const val = config[dk];
            const over = Math.abs(val) > CAGR_MAX;
            return (
              <div key={dk} className="flex flex-col">
                <span className="text-[10px] text-muted-foreground mb-0.5">{DELTA_LABELS[i]}</span>
                <Input
                  type="number"
                  step={0.1}
                  className={`h-8 w-20 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${over ? 'border-destructive ring-1 ring-destructive' : ''}`}
                  value={(val * 100).toFixed(2)}
                  onChange={e => onCagrChange(dk, Number(e.target.value) / 100)}
                  title={over ? 'Exceeds ±10% cap' : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Sparkline preview */}
      <div className="pt-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Trajectory preview</div>
        <Sparkline series={series} />
      </div>
    </div>
  );
}