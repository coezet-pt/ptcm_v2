import { useScenario } from '@/contexts/ScenarioContext';

import { NumberField } from '@/components/ui/number-field';

import { Label } from '@/components/ui/label';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import type { H2SourceMix } from '@/lib/types';



export default function PolicyLevers() {

  const { draftConfig, updatePolicy } = useScenario();

  const p = draftConfig.policy;



  return (

    <div className="space-y-5">

      {/* Electricity subsidy */}

      <div className="space-y-1.5">

        <Label className="text-sm">Electricity subsidy (₹/kWh)</Label>

        <NumberField

          className="h-8 w-32 font-mono text-sm"

          value={p.electricity_subsidy_per_kwh}

          onValueChange={v => updatePolicy('electricity_subsidy_per_kwh', v)}

        />

      </div>



      {/* H2 source mix */}

      <div className="space-y-2">

        <Label className="text-sm">Hydrogen source mix</Label>

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



      {/* ZET GVW payload compensation */}

      <div className="space-y-1.5">

        <Label className="text-sm">ZET GVW payload compensation (tonnes)</Label>

        <NumberField

          className="h-8 w-32 font-mono text-sm"

          min={0} step={0.5}

          value={p.gvw_payload_compensation_t}

          onValueChange={v => updatePolicy('gvw_payload_compensation_t', v)}

        />

        <p className="text-xs text-muted-foreground">Extra GVW allowed for BET/FCET; raises their rated payload.</p>

      </div>

    </div>

  );

}

