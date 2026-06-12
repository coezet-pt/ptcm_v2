import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Pin, AlertTriangle } from 'lucide-react';
import type { ParameterConfig } from '@/lib/types';
import { DELTA_LABELS, DELTA_KEYS, type DeltaKey } from './ParameterRow';

const CAGR_MAX = 0.10;
const YEARS = Array.from({ length: 30 }, (_, i) => 2026 + i); // 2026..2055

/** Years covered by each CAGR range (mirrors RANGE_YEARS in ScenarioContext). */
const RANGE_START: Record<DeltaKey, number> = {
  d2530: 2026, d3135: 2031, d3640: 2036, d4145: 2041, d4650: 2046, d5155: 2051,
};
function yearsInRange(dk: DeltaKey): [number, number] {
  const start = RANGE_START[dk];
  return [start, start + 4];
}

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
function buildSeries(cfg: ParameterConfig, isGrowthRate: boolean, ignoreOverrides = false): number[] {
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
    if (!ignoreOverrides && !isGrowthRate && cfg.overrides && cfg.overrides[y] !== undefined) {
      arr[i] = cfg.overrides[y];
    }
  }
  return arr;
}

interface SparklineProps {
  series: number[];
  /** CAGR-only trajectory (no pins); rendered as a dashed ghost when it differs. */
  ghost?: number[];
  /** Pinned years to mark with dots. */
  pinnedYears?: number[];
}

function Sparkline({ series, ghost, pinnedYears = [] }: SparklineProps) {
  const W = 240, H = 48;
  const { d, ghostD, dots, min, max } = useMemo(() => {
    const all = ghost ? [...series, ...ghost] : series;
    const mn = Math.min(...all);
    const mx = Math.max(...all);
    const range = mx - mn || 1;
    const step = W / (series.length - 1);
    const toPath = (s: number[]) => s
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(H - ((v - mn) / range) * H).toFixed(1)}`)
      .join(' ');
    const dotPts = pinnedYears
      .map(y => y - 2025)
      .filter(i => i >= 0 && i < series.length)
      .map(i => ({
        x: i * step,
        y: H - ((series[i] - mn) / range) * H,
      }));
    return { d: toPath(series), ghostD: ghost ? toPath(ghost) : null, dots: dotPts, min: mn, max: mx };
  }, [series, ghost, pinnedYears]);

  return (
    <div className="flex items-center gap-3">
      <svg width={W} height={H} className="overflow-visible">
        {ghostD && (
          <path d={ghostD} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        )}
        <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} />
        {dots.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={1} />
        ))}
      </svg>
      <div className="text-[10px] text-muted-foreground font-mono leading-tight">
        <div>2025: {series[0].toFixed(2)}</div>
        <div>2055: {series[series.length - 1].toFixed(2)}</div>
        <div className="opacity-60">min {min.toFixed(1)} · max {max.toFixed(1)}</div>
        {ghostD && <div className="opacity-60">dashed = CAGR only</div>}
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
  // CAGR edit awaiting confirmation because it would delete pins in its range
  const [pendingCagr, setPendingCagr] = useState<{ field: DeltaKey; raw: string } | null>(null);

  const series = useMemo(() => buildSeries(config, !!isGrowthRate), [config, isGrowthRate]);
  const baseExceeded = baseValueMax !== undefined && config.baseValue > baseValueMax;
  const overrides = (!isGrowthRate && config.overrides) || {};
  const pinnedYears = Object.keys(overrides).map(Number).sort((a, b) => a - b);
  const hasPins = pinnedYears.length > 0;

  // CAGR-only trajectory, used for the ghost curve and per-pin "vs trend" deltas
  const trendSeries = useMemo(
    () => (hasPins ? buildSeries(config, !!isGrowthRate, true) : series),
    [config, isGrowthRate, hasPins, series],
  );

  const pinsInRange = (dk: DeltaKey) => {
    const [start, end] = yearsInRange(dk);
    return pinnedYears.filter(y => y >= start && y <= end);
  };

  const handlePin = () => {
    const n = Number(draftVal);
    if (!Number.isFinite(n)) return;
    onSetOverride(year, n);
    setDraftVal('');
  };

  const handleCagrInput = (dk: DeltaKey, raw: string) => {
    if (pinsInRange(dk).length > 0) {
      setPendingCagr({ field: dk, raw });
    } else {
      onCagrChange(dk, Number(raw) / 100);
      if (pendingCagr?.field === dk) setPendingCagr(null);
    }
  };

  const applyPendingCagr = () => {
    if (!pendingCagr) return;
    const n = Number(pendingCagr.raw);
    if (Number.isFinite(n)) onCagrChange(pendingCagr.field, n / 100);
    setPendingCagr(null);
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

      {/* Spot-year override — hidden for growth-rate params (engine ignores their pins) */}
      {!isGrowthRate && (
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
          {hasPins && (
            <div className="flex flex-wrap gap-1.5">
              {pinnedYears.map(y => {
                const trend = trendSeries[y - 2025];
                const pct = trend !== 0 ? ((overrides[y] / trend) - 1) * 100 : null;
                return (
                  <span key={y} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-mono">
                    {y}: {overrides[y].toFixed(2)}
                    {pct !== null && (
                      <span className="text-muted-foreground">
                        ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}% vs trend)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onClearOverride(y)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove pin for ${y}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            Pinned values override the CAGR for that year; later years grow from the pin.
          </p>
        </div>
      )}

      {/* CAGR by range */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          CAGR % by range <span className="normal-case opacity-70">(max ±10%)</span>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {DELTA_KEYS.map((dk, i) => {
            const isPending = pendingCagr?.field === dk;
            const displayed = isPending ? pendingCagr.raw : (config[dk] * 100).toFixed(2);
            const over = Math.abs(Number(displayed)) > CAGR_MAX * 100;
            const rangePins = pinsInRange(dk);
            return (
              <div key={dk} className="flex flex-col">
                <span className="text-[10px] text-muted-foreground mb-0.5 inline-flex items-center gap-1">
                  {DELTA_LABELS[i]}
                  {rangePins.length > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 text-primary"
                      title={`Pinned year${rangePins.length > 1 ? 's' : ''} in this range: ${rangePins.join(', ')}`}
                    >
                      <Pin className="h-2.5 w-2.5" />{rangePins.length}
                    </span>
                  )}
                </span>
                <Input
                  type="number"
                  step={0.1}
                  className={`h-8 w-20 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${over ? 'border-destructive ring-1 ring-destructive' : ''} ${isPending ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
                  value={displayed}
                  onChange={e => handleCagrInput(dk, e.target.value)}
                  title={over ? 'Exceeds ±10% cap' : undefined}
                />
              </div>
            );
          })}
        </div>
        {pendingCagr && (
          <div className="flex items-center gap-2 flex-wrap rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1.5 text-[11px]">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>
              Changing {DELTA_LABELS[DELTA_KEYS.indexOf(pendingCagr.field)]} will remove{' '}
              {pinsInRange(pendingCagr.field).length} pin{pinsInRange(pendingCagr.field).length > 1 ? 's' : ''}{' '}
              ({pinsInRange(pendingCagr.field).join(', ')}).
            </span>
            <Button type="button" size="sm" variant="destructive" className="h-6 px-2 text-[11px]" onClick={applyPendingCagr}>
              Apply &amp; remove pins
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setPendingCagr(null)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Sparkline preview */}
      <div className="pt-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Trajectory preview</div>
        <Sparkline
          series={series}
          ghost={hasPins ? trendSeries : undefined}
          pinnedYears={pinnedYears}
        />
      </div>
    </div>
  );
}
