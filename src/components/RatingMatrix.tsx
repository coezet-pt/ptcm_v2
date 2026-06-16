import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Powertrain } from '@/lib/constants/extracted';
import { POWERTRAINS } from '@/lib/constants/extracted';

/** Per-powertrain rating editor (relative to Diesel = 1.0). */
export function RatingMatrix({
  label, values, onChange,
}: {
  label: string;
  values: Record<Powertrain, number>;
  onChange: (pt: Powertrain, v: number) => void;
}) {
  return (
    <div className="rounded border border-border/50 p-3">
      <div className="text-sm font-medium mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {POWERTRAINS.map(pt => (
          <div key={pt} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{pt}</Label>
            <Input
              type="number"
              step={0.05}
              className="h-8 text-right font-mono text-xs"
              value={values[pt]}
              onChange={e => onChange(pt, Number(e.target.value))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
