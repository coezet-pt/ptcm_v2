import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useScenario } from '@/contexts/ScenarioContext';
import { BUCKETS } from '@/lib/constants/extracted';
import { MAINT_METRICS, defaultMaintConfig } from '@/lib/sim/maintenance';
import type { ParameterConfig } from '@/lib/types';
import ParameterEditor from './ParameterEditor';

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

      {MAINT_METRICS.map(m => {
        const cfg: ParameterConfig = bm?.[m.key]?.[bucketId] ?? defaultMaintConfig(m.key, bucket);
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
    </div>
  );
}