import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useScenario } from '@/contexts/ScenarioContext';
import { BUCKETS } from '@/lib/constants/extracted';
import type { ParameterConfig } from '@/lib/types';
import ParameterEditor from './ParameterEditor';

const METRICS: { key: 'diesel' | 'bet' | 'fcet'; label: string; defaultFn: (b: typeof BUCKETS[number]) => number }[] = [
  { key: 'diesel', label: 'Diesel Maintenance',      defaultFn: b => b.maintDieselPerKm },
  { key: 'bet',    label: 'BET Aggregates (incl. battery repl.)',     defaultFn: b => +(b.maintDieselPerKm * 0.6).toFixed(2) },
  { key: 'fcet',   label: 'FCET Aggregates (incl. battery+FC repl.)', defaultFn: b => +(b.maintDieselPerKm * 0.7).toFixed(2) },
];

function emptyConfigFor(defaultBase: number): ParameterConfig {
  return { baseValue: defaultBase, d2530: 0, d3135: 0, d3640: 0, d4145: 0, d4650: 0, d5155: 0 };
}

export default function BucketMaintenanceInput() {
  const {
    draftConfig, updateBucketMaintenance, setBucketOverride, clearBucketOverride,
  } = useScenario();
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
            <div className="text-sm font-medium mb-1">{m.label} <span className="text-[11px] text-muted-foreground font-normal">— ₹/km</span></div>
            <ParameterEditor
              config={cfg}
              unit="₹/km"
              baseStep={0.1}
              onBaseChange={v => updateBucketMaintenance(m.key, bucketId, 'baseValue', v)}
              onCagrChange={(field, v) => updateBucketMaintenance(m.key, bucketId, field, v)}
              onSetOverride={(year, value) => setBucketOverride(m.key, bucketId, year, value)}
              onClearOverride={year => clearBucketOverride(m.key, bucketId, year)}
            />
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground italic">
        Per-bucket maintenance values are held in state only; they are not yet consumed by the simulation engine in this round.
      </p>
    </div>
  );
}