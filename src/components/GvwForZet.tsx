import { NumberField } from '@/components/ui/number-field';
import { useScenario } from '@/contexts/ScenarioContext';
import { ZET_GVW_CLASSES, ZET_GVW_CURRENT_KG } from '@/lib/constants/extracted';

const fmtKg = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

/**
 * Policy support → "GVW for ZET". Users edit the revised GVW (kg) allowed for
 * ZETs (BET/FCET) per size class next to the read-only current GVW — Excel
 * 'No change with year' AT/AU ("GVW Increase for BETs/FCETs"). The engine
 * consumes the delta (revised − current) as additional payload for ZETs.
 */
export default function GvwForZet() {
  const { draftConfig, updatePolicy } = useScenario();
  const additional = draftConfig.policy.zet_additional_gvw_kg ?? {};

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">GVW for ZET</div>
      <p className="text-xs text-muted-foreground">
        Revised GVW (kg) allowed for BET/FCET; any increase over the current GVW raises their rated payload.
      </p>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 items-center pt-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">GVW class</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground text-right">Current (kg)</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground text-right">Revised (kg)</span>
        {ZET_GVW_CLASSES.map(cls => {
          const current = ZET_GVW_CURRENT_KG[cls] ?? 0;
          return (
            <div key={cls} className="contents">
              <span className="text-sm">{cls}</span>
              <span className="text-sm font-mono text-muted-foreground text-right tabular-nums">
                {fmtKg(current)}
              </span>
              <NumberField
                step={100}
                min={current}
                className="h-8 w-24 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={current + (additional[cls] ?? 0)}
                onValueChange={v =>
                  updatePolicy('zet_additional_gvw_kg', { ...additional, [cls]: Math.max(0, v - current) })
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
