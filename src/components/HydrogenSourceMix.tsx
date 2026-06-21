import { useScenario } from '@/contexts/ScenarioContext';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { H2SourceMix } from '@/lib/types';

export default function HydrogenSourceMix() {
  const { draftConfig, updatePolicy } = useScenario();
  const p = draftConfig.policy;

  return (
    <div className="space-y-2 px-1 py-2">
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
          <Label htmlFor="h2-blend" className="text-sm cursor-pointer">Grey/green blend till 2046</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="cheapest" id="h2-cheap" />
          <Label htmlFor="h2-cheap" className="text-sm cursor-pointer">Lowest cost option</Label>
        </div>
      </RadioGroup>
    </div>
  );
}
