import { NumberField } from '@/components/ui/number-field';
import { Label } from '@/components/ui/label';
import { useScenario } from '@/contexts/ScenarioContext';
import { DEFAULT_BATTERY_LIFE_CYCLES, DEFAULT_FUEL_CELL_LIFE_HOURS } from '@/lib/constants/extracted';

/**
 * Key Aggregate Life — Battery Life (charging cycles) and Fuel Cell Life
 * (hrs). Excel 'No change with year' D22/D23. Both feed the battery /
 * fuel-cell replacement portion of BET/FCET maintenance (see tco.ts).
 */
export default function KeyAggregateLifeInput() {
  const { draftConfig, updateFixed } = useScenario();
  const f = draftConfig.fixed;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 p-2 rounded border border-border/50">
        <Label className="text-sm flex-1">
          Battery Life <span className="text-xs text-muted-foreground">(charging cycles)</span>
        </Label>
        <NumberField
          step={100} min={1}
          className="h-8 w-28 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={f.battery_life_cycles ?? DEFAULT_BATTERY_LIFE_CYCLES}
          onValueChange={v => updateFixed('battery_life_cycles', v)}
        />
      </div>
      <div className="flex items-center justify-between gap-3 p-2 rounded border border-border/50">
        <Label className="text-sm flex-1">
          Fuel Cell Life <span className="text-xs text-muted-foreground">(hrs)</span>
        </Label>
        <NumberField
          step={1000} min={1}
          className="h-8 w-28 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={f.fuel_cell_life_hours ?? DEFAULT_FUEL_CELL_LIFE_HOURS}
          onValueChange={v => updateFixed('fuel_cell_life_hours', v)}
        />
      </div>
    </div>
  );
}
