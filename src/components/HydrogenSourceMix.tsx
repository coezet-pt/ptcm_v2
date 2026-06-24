import { useScenario } from '@/contexts/ScenarioContext';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { NumberField } from '@/components/ui/number-field';
import { DELTA_LABELS, DELTA_KEYS } from '@/components/ParameterRow';
import type { H2SourceMix, H2BlendMode } from '@/lib/types';

export default function HydrogenSourceMix() {
  const { draftConfig, updatePolicy } = useScenario();
  const p = draftConfig.policy;
  const bands = p.grey_h2_blend_bands ?? {};
  const blendMode = p.grey_h2_blend_mode ?? 'uniform';

  const toPct = (v: number) => Math.max(0, Math.min(1, (Number.isFinite(v) ? v : 0) / 100));

  const setBand = (key: string, pct: number) => {
    updatePolicy('grey_h2_blend_bands', { ...bands, [key]: toPct(pct) });
  };

  const setUniform = (pct: number) => {
    updatePolicy('grey_h2_blend_uniform', toPct(pct));
  };

  return (
    <div className="space-y-3 px-1 py-2">
      <RadioGroup
        value={p.h2_source_mix}
        onValueChange={(v) => updatePolicy('h2_source_mix', v as H2SourceMix)}
        className="flex flex-wrap gap-x-4 gap-y-2"
      >
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="green_only" id="h2-green" />
          <Label htmlFor="h2-green" className="text-sm cursor-pointer">Green only</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="blend_2046_green" id="h2-blend" />
          <Label htmlFor="h2-blend" className="text-sm cursor-pointer">Grey/green blend</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="cheapest" id="h2-cheap" />
          <Label htmlFor="h2-cheap" className="text-sm cursor-pointer">Lowest cost option</Label>
        </div>
      </RadioGroup>

      {/* Grey share input — only relevant for the blend option */}
      {p.h2_source_mix === 'blend_2046_green' && (
        <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-2">
          {/* Choose how to enter the grey share: a single % or per-5-year-band */}
          <RadioGroup
            value={blendMode}
            onValueChange={(v) => updatePolicy('grey_h2_blend_mode', v as H2BlendMode)}
            className="flex flex-wrap gap-x-4 gap-y-1"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="uniform" id="h2-blend-uniform" />
              <Label htmlFor="h2-blend-uniform" className="text-xs cursor-pointer">Single %</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="bands" id="h2-blend-bands" />
              <Label htmlFor="h2-blend-bands" className="text-xs cursor-pointer">By 5-year block</Label>
            </div>
          </RadioGroup>

          {blendMode === 'uniform' ? (
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">
                Grey hydrogen share (2026–2045)
              </span>
              <div className="flex items-center gap-1">
                <NumberField
                  step={5}
                  className="h-8 w-16 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={Math.round((p.grey_h2_blend_uniform ?? 0) * 100)}
                  onValueChange={setUniform}
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Grey hydrogen share by 5-year block (2026–2045)
              </span>
              <div className="flex flex-wrap items-end gap-2">
                {DELTA_KEYS.slice(0, 4).map((key, i) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground mb-0.5">{DELTA_LABELS[i]}</span>
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
          )}

          <p className="text-[10px] text-muted-foreground">
            Share of grey hydrogen in the supply blend (0% = fully green). The rest is green;
            production cost is blended pro-rata. Grey is discontinued from 2046 (green-only thereafter).
          </p>
        </div>
      )}
    </div>
  );
}
