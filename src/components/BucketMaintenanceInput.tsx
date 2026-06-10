import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useScenario } from '@/contexts/ScenarioContext';
import { BUCKETS } from '@/lib/constants/extracted';
import type { ParameterConfig } from '@/lib/types';
import { DELTA_LABELS, DELTA_KEYS } from './ParameterRow';

const CAGR_MAX = 0.10;

const METRICS: { key: 'diesel' | 'bet' | 'fcet'; label: string; defaultFn: (b: typeof BUCKETS[number]) => number }[] = [
  { key: 'diesel', label: 'Diesel Maintenance',      defaultFn: b => b.maintDieselPerKm },
  { key: 'bet',    label: 'BET Aggregates (incl. battery repl.)',     defaultFn: b => +(b.maintDieselPerKm * 0.6).toFixed(2) },
  { key: 'fcet',   label: 'FCET Aggregates (incl. battery+FC repl.)', defaultFn: b => +(b.maintDieselPerKm * 0.7).toFixed(2) },
];

function emptyConfigFor(defaultBase: number): ParameterConfig {
  return { baseValue: defaultBase, d2530: 0, d3135: 0, d3640: 0, d4145: 0, d4650: 0, d5155: 0 };
}

export default function BucketMaintenanceInput() {
  const { draftConfig, updateBucketMaintenance } = useScenario();
  const [bucketId, setBucketId] = useState<string>('B1');
  const bucket = BUCKETS.find(b => b.id === bucketId)!;
  const bm = draftConfig.fixed.bucket_maintenance;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Bucket:</label>
        <Select value={bucketId} onValueChange={setBucketId}>
          <SelectTrigger className="w-[260px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUCKETS.map(b => (
              <SelectItem key={b.id} value={b.id}>
                {b.id} — {b.useCase} ({b.size})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {METRICS.map(m => {
        const cfg: ParameterConfig = bm?.[m.key]?.[bucketId] ?? emptyConfigFor(m.defaultFn(bucket));
        return (
          <div key={m.key} className="py-3 border-b border-border/50 last:border-b-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-sm font-medium min-w-[260px]">{m.label}</div>
              <Input
                type="number"
                className="h-8 w-24 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={cfg.baseValue}
                step={0.1}
                onChange={e => updateBucketMaintenance(m.key, bucketId, 'baseValue', Number(e.target.value))}
              />
              <span className="text-xs text-muted-foreground">₹/km</span>
            </div>
            <div className="mt-2 ml-[272px] flex items-end gap-3 flex-wrap">
              <span className="text-[11px] text-muted-foreground self-center">CAGR %</span>
              {DELTA_KEYS.map((dk, i) => {
                const v = cfg[dk];
                const over = Math.abs(v) > CAGR_MAX;
                return (
                  <div key={dk} className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground mb-0.5">{DELTA_LABELS[i]}</span>
                    <Input
                      type="number"
                      className={`h-8 w-20 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${over ? 'border-destructive ring-1 ring-destructive' : ''}`}
                      value={(v * 100).toFixed(2)}
                      step={0.1}
                      onChange={e => updateBucketMaintenance(m.key, bucketId, dk, Number(e.target.value) / 100)}
                      title={over ? 'Exceeds ±10% cap' : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground italic">
        Per-bucket maintenance values are held in state only; they are not yet consumed by the simulation engine in this round.
      </p>
    </div>
  );
}