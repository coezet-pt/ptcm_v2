import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useScenario } from '@/contexts/ScenarioContext';
import type { FixedParameters } from '@/lib/types';
import type { Powertrain } from '@/lib/constants/extracted';
import { POWERTRAINS } from '@/lib/constants/extracted';

const SCALAR_GROUPS: { title: string; rows: { key: keyof FixedParameters; label: string; unit: string; step?: number }[] }[] = [
  {
    title: 'Financial',
    rows: [
      { key: 'interest_rate_ice', label: 'Interest rate (Diesel/CNG/LNG/H₂-ICE)', unit: 'fraction', step: 0.005 },
      { key: 'insurance_rate_per_year', label: 'Insurance rate per year', unit: 'fraction', step: 0.005 },
    ],
  },
  {
    title: 'Component & Consumption',
    rows: [
      { key: 'adblue_consumption_l_per_l_diesel', label: 'AdBlue consumption per L diesel', unit: 'L/L', step: 0.005 },
      { key: 'battery_life_cycles', label: 'Battery life', unit: 'cycles', step: 100 },
      { key: 'fuel_cell_life_hours', label: 'Fuel cell life', unit: 'hours', step: 500 },
      { key: 'battery_energy_density_kg_per_kwh', label: 'Battery energy density', unit: 'kg/kWh', step: 0.5 },
      { key: 'fuel_cell_power_density_kg_per_kw', label: 'Fuel cell power density', unit: 'kg/kW', step: 0.5 },
    ],
  },
];

export default function FixedParamGroup() {
  const { draftConfig, updateFixed } = useScenario();
  const f = draftConfig.fixed;

  return (
    <div className="space-y-5">
      {SCALAR_GROUPS.map(group => (
        <div key={group.title} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.rows.map(row => (
              <div key={row.key as string} className="flex items-center justify-between gap-3 p-2 rounded border border-border/50">
                <Label className="text-sm flex-1">
                  {row.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">({row.unit})</span>
                </Label>
                <Input
                  type="number"
                  step={row.step ?? 1}
                  className="h-8 w-28 text-right font-mono text-sm"
                  value={f[row.key] as number}
                  onChange={e => updateFixed(row.key, Number(e.target.value) as any)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Powertrain ratings (matrices) */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Powertrain Ratings (relative to Diesel = 1.0)</h4>
        <RatingMatrix
          label="TAT / gradeability / productivity"
          field="tat_gradeability"
          values={f.tat_gradeability}
          onChange={(pt, v) => updateFixed('tat_gradeability', { ...f.tat_gradeability, [pt]: v })}
        />
        <RatingMatrix
          label="Range & filling time"
          field="range_filling_time"
          values={f.range_filling_time}
          onChange={(pt, v) => updateFixed('range_filling_time', { ...f.range_filling_time, [pt]: v })}
        />
      </div>
    </div>
  );
}

export function RatingMatrix({
  label, values, onChange,
}: {
  label: string;
  field?: string;
  values: Record<Powertrain, number>;
  onChange: (pt: Powertrain, v: number) => void;
}) {
  return (
    <div className="rounded border border-border/50 p-3">
      <div className="text-sm font-medium mb-2">{label}</div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
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
