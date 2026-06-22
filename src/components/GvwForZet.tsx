import { NumberField } from '@/components/ui/number-field';
import { useScenario } from '@/contexts/ScenarioContext';
import { ZET_GVW_CLASSES } from '@/lib/constants/extracted';

/**
 * Policy support → "GVW for ZET". Additional GVW (kg) granted to ZETs
 * (BET/FCET) per size class — Excel 'No change with year' AT/AU
 * ("GVW Increase for BETs/FCETs"). Raises the rated payload of ZETs.
 */
export default function GvwForZet() {
  const { draftConfig, updatePolicy } = useScenario();
  const additional = draftConfig.policy.zet_additional_gvw_kg ?? {};

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">GVW for ZET</div>
      <p className="text-xs text-muted-foreground">
        Additional GVW (kg) allowed for BET/FCET; raises their rated payload.
      </p>
      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 items-center pt-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">GVW class</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground text-right">Additional GVW (kg)</span>
        {ZET_GVW_CLASSES.map(cls => (
          <div key={cls} className="contents">
            <span className="text-sm">{cls}</span>
            <NumberField
              step={100}
              min={0}
              className="h-8 w-24 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={additional[cls] ?? 0}
              onValueChange={v => updatePolicy('zet_additional_gvw_kg', { ...additional, [cls]: v })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
