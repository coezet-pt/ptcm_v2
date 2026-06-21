import { useScenario } from '@/contexts/ScenarioContext';

import { NumberField } from '@/components/ui/number-field';

import { Label } from '@/components/ui/label';



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

