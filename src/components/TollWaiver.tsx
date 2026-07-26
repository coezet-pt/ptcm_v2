import { NumberField } from '@/components/ui/number-field';
import { useScenario } from '@/contexts/ScenarioContext';

/**
 * Policy support → "Toll waiver for ZETs". A single flat percentage of toll
 * waived for ZETs (BET/H2-ICE/FCET), applied to all years — mirrors the Excel
 * 'Changing with year' cell $AL$276 (ZET toll = diesel toll × (1 − waiver)).
 * Stored in config as a 0–1 fraction; shown here as a percentage.
 */
export default function TollWaiver() {
  const { draftConfig, updatePolicy } = useScenario();
  const pct = draftConfig.policy.toll_waiver_pct ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Toll waiver for ZETs</span>
        <div className="flex items-center gap-1">
          <NumberField
            step={5}
            min={0}
            max={100}
            className="h-8 w-20 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={Math.round(pct * 100)}
            onValueChange={v => updatePolicy('toll_waiver_pct', Math.max(0, Math.min(1, v / 100)))}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Share of toll waived for BET/H₂-ICE/FCET, all years (Excel $AL$276).
      </p>
    </div>
  );
}
