import { useScenario } from '@/contexts/ScenarioContext';
import { NumberField } from '@/components/ui/number-field';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { H2SourceMix } from '@/lib/types';

export default function PolicyLevers() {
  const { draftConfig, updatePolicy } = useScenario();
  const p = draftConfig.policy;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Policy Levers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* BET demand incentive */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">BET demand incentive (₹/kWh)</Label>
            <NumberField
              className="h-8 font-mono text-sm"
              value={p.bet_demand_incentive_per_kwh}
              onValueChange={v => updatePolicy('bet_demand_incentive_per_kwh', v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">FCET demand incentive (₹/kWh)</Label>
            <NumberField
              className="h-8 font-mono text-sm"
              value={p.fcet_demand_incentive_per_kwh}
              onValueChange={v => updatePolicy('fcet_demand_incentive_per_kwh', v)}
            />
          </div>
        </div>

        {/* ZET interest rate slider */}
        <div className="space-y-2">
          <Label className="text-sm">
            ZET interest rate: <span className="font-mono font-semibold">{(p.interest_rate_zet * 100).toFixed(1)}%</span>
          </Label>
          <Slider
            min={8}
            max={15}
            step={0.5}
            value={[p.interest_rate_zet * 100]}
            onValueChange={([v]) => updatePolicy('interest_rate_zet', v / 100)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>8%</span><span>15%</span>
          </div>
        </div>

        {/* Electricity subsidy */}
        <div className="space-y-1.5">
          <Label className="text-sm">Electricity subsidy (₹/kWh)</Label>
          <NumberField
            className="h-8 w-32 font-mono text-sm"
            value={p.electricity_subsidy_per_kwh}
            onValueChange={v => updatePolicy('electricity_subsidy_per_kwh', v)}
          />
        </div>

        {/* Toll waiver */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Toll waiver — first 5 years (%)</Label>
            <NumberField
              className="h-8 font-mono text-sm"
              min={0} max={100} step={5}
              value={p.toll_waiver_pct_first_5y * 100}
              onValueChange={pct => updatePolicy('toll_waiver_pct_first_5y', pct / 100)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Toll waiver — next 5 years (%)</Label>
            <NumberField
              className="h-8 font-mono text-sm"
              min={0} max={100} step={5}
              value={p.toll_waiver_pct_next_5y * 100}
              onValueChange={pct => updatePolicy('toll_waiver_pct_next_5y', pct / 100)}
            />
          </div>
        </div>

        {/* H2 source mix */}
        <div className="space-y-2">
          <Label className="text-sm">Hydrogen source mix</Label>
          <RadioGroup
            value={p.h2_source_mix}
            onValueChange={(v) => updatePolicy('h2_source_mix', v as H2SourceMix)}
            className="flex gap-4"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="green_only" id="h2-green" />
              <Label htmlFor="h2-green" className="text-sm cursor-pointer">Green only</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="blend_2046_green" id="h2-blend" />
              <Label htmlFor="h2-blend" className="text-sm cursor-pointer">Blend → green by 2046</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="cheapest" id="h2-cheap" />
              <Label htmlFor="h2-cheap" className="text-sm cursor-pointer">Cheapest available</Label>
            </div>
          </RadioGroup>
        </div>

        {/* BET inflection year slider */}
        <div className="space-y-2">
          <Label className="text-sm">
            BET inflection year: <span className="font-mono font-semibold">{p.bet_inflection_year}</span>
          </Label>
          <Slider
            min={2030}
            max={2042}
            step={1}
            value={[p.bet_inflection_year]}
            onValueChange={([v]) => updatePolicy('bet_inflection_year', v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>2030</span><span>2042</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
