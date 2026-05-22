import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { Play, Undo2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import ParameterRow from './ParameterRow';
import PolicyLevers from './PolicyLevers';
import FixedParamGroup from './FixedParamGroup';
import SegmentBasePricesTable from './SegmentBasePricesTable';
import { useScenario } from '@/contexts/ScenarioContext';
import type { ParameterKey } from '@/lib/types';

const PRIMARY_KEYS: ParameterKey[] = [
  'diesel_price_per_l',
  'lng_price_per_kg',
  'cng_price_per_kg',
  'electricity_incl_caas_per_kwh',
  'green_h2_production_per_kg',
  'grey_h2_production_per_kg',
];

const ADV_FUEL_KEYS: ParameterKey[] = [
  'adblue_per_l',
  'green_h2_electricity_per_kg',
  'green_h2_capex_per_kg',
  'green_h2_opex_margin_per_kg',
  'grey_h2_blend_fraction',
  'h2_compression_storage_per_kg',
  'discom_electricity_per_kwh',
  'fixed_demand_charges_per_kwh',
  'charging_infra_per_kwh',
  'electricity_per_kwh',
];

const ADV_COMPONENT_KEYS: ParameterKey[] = [
  'battery_cost_per_kwh',
  'fuel_cell_cost_per_kw',
  'lng_tank_cost_per_kg',
  'lng_valves_piping_per_vehicle',
  'h2_tank_cost_per_kg',
  'diesel_vehicle_growth',
  'engine_trans_growth',
  'e_powertrain_growth',
];

function ParamTable({ keys }: { keys: ParameterKey[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="text-left py-2 px-3 font-medium">Parameter</th>
            <th className="text-left py-2 px-2 font-medium">Unit</th>
            <th className="text-right py-2 px-2 font-medium">Base (2025)</th>
            <th className="text-right py-2 px-2 font-medium">Δ 2026-30</th>
            <th className="text-right py-2 px-2 font-medium">Δ 2031-40</th>
            <th className="text-right py-2 px-2 font-medium">Δ 2041-50</th>
            <th className="text-right py-2 px-2 font-medium">Δ 2051-55</th>
          </tr>
        </thead>
        <tbody>
          {keys.map(k => <ParameterRow key={k} paramKey={k} />)}
        </tbody>
      </table>
    </div>
  );
}

export default function InputPanel() {
  const { isDirty, applyChanges, discardChanges } = useScenario();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Primary fuel/energy parameters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Primary Cost Trajectories</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            The six key fuel and energy costs that drive the model. Edit base value and per-period growth.
          </p>
        </CardHeader>
        <CardContent>
          <ParamTable keys={PRIMARY_KEYS} />
        </CardContent>
      </Card>

      {/* Advanced toggle */}
      <div className="border-t border-border pt-4">
        <Button
          variant="outline"
          className="w-full justify-between gap-2"
          onClick={() => setAdvancedOpen(o => !o)}
        >
          <span className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Advanced Settings
          </span>
          {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {advancedOpen && (
        <Card>
          <CardContent className="pt-4">
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="A">
                <AccordionTrigger className="text-sm font-medium">
                  A. Other Fuel & Energy Costs
                </AccordionTrigger>
                <AccordionContent>
                  <ParamTable keys={ADV_FUEL_KEYS} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="B">
                <AccordionTrigger className="text-sm font-medium">
                  B. Component Costs
                </AccordionTrigger>
                <AccordionContent>
                  <ParamTable keys={ADV_COMPONENT_KEYS} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="C">
                <AccordionTrigger className="text-sm font-medium">
                  C. Vehicle-Segment Base Prices (2025)
                </AccordionTrigger>
                <AccordionContent>
                  <SegmentBasePricesTable />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="D">
                <AccordionTrigger className="text-sm font-medium">
                  D. Fixed Parameters (no year deltas)
                </AccordionTrigger>
                <AccordionContent>
                  <FixedParamGroup />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="E">
                <AccordionTrigger className="text-sm font-medium">
                  E. Policy Levers
                </AccordionTrigger>
                <AccordionContent>
                  <PolicyLevers />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Sticky Apply / Discard bar */}
      <div className="sticky bottom-0 z-20 -mx-4 px-4 py-3 bg-card/90 backdrop-blur-md border-t border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isDirty ? (
            <Badge variant="outline" className="text-warning border-warning">
              Unapplied changes
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Charts are up to date</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!isDirty}
            onClick={discardChanges}
            className="gap-1.5"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Discard
          </Button>
          <Button
            size="sm"
            disabled={!isDirty}
            onClick={applyChanges}
            className="gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            Apply Changes (Go)
          </Button>
        </div>
      </div>
    </div>
  );
}
