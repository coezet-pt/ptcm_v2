import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { Play, Undo2, RotateCcw } from 'lucide-react';
import ParameterRow from './ParameterRow';
import BucketMaintenanceInput from './BucketMaintenanceInput';
import FundingInput from './FundingInput';
import PolicyLevers from './PolicyLevers';
import { useScenario } from '@/contexts/ScenarioContext';



export default function InputPanel() {
  const { isDirty, applyChanges, discardChanges, resetToDefaults, draftConfig, updateFixed } = useScenario();

  const batteryLife = draftConfig.fixed.battery_life_cycles;
  const fcLife = draftConfig.fixed.fuel_cell_life_hours;
  const batteryLifeBad = !/^\d{1,4}$/.test(String(batteryLife));
  const fcLifeBad = !/^\d{1,5}$/.test(String(fcLife));

  return (
    <div className="space-y-6">
      {/* Primary trajectories — always visible */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.14em]">Primary Cost Trajectories</CardTitle>
          <p className="text-xs text-muted-foreground">
            2025 base value + CAGR % for each of the six year-range buckets (max ±10%).
          </p>
        </CardHeader>
        <CardContent className="divide-y divide-border/50">
          <div className="pb-2">
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Fuel Prices</h4>
            <ParameterRow paramKey="diesel_price_per_l" />
            <ParameterRow paramKey="lng_price_per_kg"   />
            <ParameterRow paramKey="cng_price_per_kg"   />
          </div>
          <div className="pt-2">
            <ParameterRow paramKey="electricity_incl_caas_per_kwh" labelOverride="Energy Price (incl. CAAS)" />
            <ParameterRow paramKey="green_h2_production_per_kg"    labelOverride="Green H₂ Production Cost" />
            <ParameterRow paramKey="h2_compression_storage_per_kg" labelOverride="H₂ Compression, Transport & Dispense" />
            <ParameterRow paramKey="battery_cost_per_kwh"          labelOverride="Battery Price" />
            <ParameterRow paramKey="fuel_cell_cost_per_kw"         labelOverride="Fuel Cell Price" />
          </div>
        </CardContent>
      </Card>

      {/* Advanced — collapsed by default */}
      <Card>
        <CardContent className="pt-4">
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="maint">
              <AccordionTrigger className="text-sm font-medium">
                Maintenance (per bucket)
              </AccordionTrigger>
              <AccordionContent>
                <BucketMaintenanceInput />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="constants">
              <AccordionTrigger className="text-sm font-medium">
                Constants (battery / fuel-cell life, funding)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 py-2 flex-wrap">
                    <div className="text-sm font-medium min-w-[180px]">Battery Life</div>
                    <Input
                      type="number"
                      step={1}
                      className={`h-8 w-28 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${batteryLifeBad ? 'border-destructive ring-1 ring-destructive' : ''}`}
                      value={batteryLife}
                      onChange={e => updateFixed('battery_life_cycles', Number(e.target.value))}
                    />
                    <span className="text-xs text-muted-foreground">cycles (max 4 digits)</span>
                    {batteryLifeBad && <span className="text-[11px] text-destructive">Must be a 4-digit number</span>}
                  </div>
                  <div className="flex items-center gap-3 py-2 flex-wrap">
                    <div className="text-sm font-medium min-w-[180px]">Fuel Cell Life</div>
                    <Input
                      type="number"
                      step={1}
                      className={`h-8 w-28 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${fcLifeBad ? 'border-destructive ring-1 ring-destructive' : ''}`}
                      value={fcLife}
                      onChange={e => updateFixed('fuel_cell_life_hours', Number(e.target.value))}
                    />
                    <span className="text-xs text-muted-foreground">hours (max 5 digits)</span>
                    {fcLifeBad && <span className="text-[11px] text-destructive">Must be a 5-digit number</span>}
                  </div>
                  <FundingInput label="Funding (non-ZETs)" kind="nonzet" />
                  <FundingInput label="Funding (ZETs)"     kind="zet" />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="policy">
              <AccordionTrigger className="text-sm font-medium">
                Policy Levers (incentives, toll waivers, inflection years)
              </AccordionTrigger>
              <AccordionContent>
                <PolicyLevers />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Sticky Apply / Discard / Reset bar */}
      <div className="sticky bottom-0 z-20 -mx-4 px-4 py-3 bg-card/90 backdrop-blur-md border-t border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isDirty ? (
            <Badge variant="outline" className="text-warning border-warning">Unapplied changes</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Charts are up to date</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={resetToDefaults} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
          </Button>
          <Button variant="outline" size="sm" disabled={!isDirty} onClick={discardChanges} className="gap-1.5">
            <Undo2 className="h-3.5 w-3.5" /> Discard
          </Button>
          <Button size="sm" disabled={!isDirty} onClick={applyChanges} className="gap-1.5">
            <Play className="h-3.5 w-3.5" /> Apply Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
