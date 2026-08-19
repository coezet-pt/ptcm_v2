import { NumberField } from '@/components/ui/number-field';
import { useScenario } from '@/contexts/ScenarioContext';
import { TOLL_WAIVER_KEYS, TOLL_WAIVER_LABELS } from '@/lib/constants/extracted';

/**
 * Policy support → "Toll waiver for ZETs". The share of toll waived for ZETs
 * (BET/H2-ICE/FCET) — Excel 'Changing with year' ZET toll = diesel toll ×
 * (1 − waiver). Stored as 0–1 fractions; shown as %.
 *
 * One input per model decision point (2045 / 2050 / 2055) rather than per
 * 5-year block: the choice model only prices TCO at those three years, so a
 * waiver set for an earlier block could never reach a result. See
 * TOLL_WAIVER_KEYS.
 */
export default function TollWaiver() {
  const { draftConfig, updatePolicy } = useScenario();
  const bands = draftConfig.policy.toll_waiver_bands ?? {};

  const toPct = (v: number) => Math.max(0, Math.min(1, (Number.isFinite(v) ? v : 0) / 100));
  const setBand = (key: string, pct: number) =>
    updatePolicy('toll_waiver_bands', { ...bands, [key]: toPct(pct) });

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Toll waiver for ZETs</div>
      <p className="text-xs text-muted-foreground">
        Share of toll waived for ZETs (BET, FCET, H₂ ICE). The model prices
        ownership cost at its 2045 / 2050 / 2055 decision points, so the waiver
        is set for each of those.
      </p>
      <div className="flex flex-wrap items-end gap-2 pt-1">
        {TOLL_WAIVER_KEYS.map((key, i) => (
          <div key={key} className="flex flex-col">
            <span className="text-[10px] text-muted-foreground mb-0.5">{TOLL_WAIVER_LABELS[i]}</span>
            <div className="flex items-center gap-1">
              <NumberField
                step={5}
                className="h-8 w-16 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={Math.round((bands[key] ?? 0) * 100)}
                onValueChange={(pct) => setBand(key, pct)}
              />
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
