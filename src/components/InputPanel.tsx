import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { Play, Undo2, RotateCcw, ChevronRight, ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import ParameterRow from './ParameterRow';
import BucketMaintenanceInput from './BucketMaintenanceInput';
import FundingInput from './FundingInput';
import { RatingMatrix } from './RatingMatrix';
import PolicyLevers from './PolicyLevers';
import SegmentBasePricesTable from './SegmentBasePricesTable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useScenario } from '@/contexts/ScenarioContext';



/**
 * Collapsed cost section — a single clickable row that expands its parameter
 * rows inline within the sidebar.
 */
function CostSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 rounded px-1 py-2.5 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

export default function InputPanel() {
  const { draftConfig, updateFixed } = useScenario();
  const f = draftConfig.fixed;

  return (
    <div className="space-y-6">
      {/* Primary trajectories — always visible */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.14em]">Primary Cost Trajectories</CardTitle>
          <p className="text-xs text-muted-foreground">
            2025 base value + CAGR % for each of the six year-range buckets (max ±20%).
          </p>
        </CardHeader>
        <CardContent className="divide-y divide-border/50">
          <CostSection title="Fuel Costs">
            <ParameterRow paramKey="diesel_price_per_l" />
            <ParameterRow paramKey="lng_price_per_kg"   />
            <ParameterRow paramKey="cng_price_per_kg"   />
          </CostSection>
          <CostSection title="Energy Costs">
            <ParameterRow paramKey="electricity_incl_caas_per_kwh" labelOverride="Electricity Cost at Charging Point (incl. CAAS)" />
            <ParameterRow paramKey="green_h2_production_per_kg"    labelOverride="Green Hydrogen Production Cost" />
            <ParameterRow paramKey="h2_compression_storage_per_kg" labelOverride="Hydrogen Compression, Transport & Dispense" />
            <ParameterRow paramKey="battery_cost_per_kwh"          labelOverride="Battery Cost" />
            <ParameterRow paramKey="fuel_cell_cost_per_kw"         labelOverride="Fuel Cell Cost" />
          </CostSection>
        </CardContent>
      </Card>

      {/* Advanced — collapsed by default */}
      <Card>
        <CardContent className="pt-4">
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="financing">
              <AccordionTrigger className="text-sm font-medium whitespace-normal text-left items-start py-3">
                Funding
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <FundingInput label="Funding (non-ZETs)" kind="nonzet" />
                  <FundingInput label="Funding (ZETs)"     kind="zet" />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ratings">
              <AccordionTrigger className="text-sm font-medium whitespace-normal text-left items-start py-3">
                Powertrain ratings (TAT, range)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Relative to Diesel = 1.0; feeds the powertrain choice model.</p>
                  <RatingMatrix
                    label="TAT / gradeability / productivity"
                    values={f.tat_gradeability}
                    onChange={(pt, v) => updateFixed('tat_gradeability', { ...f.tat_gradeability, [pt]: v })}
                  />
                  <RatingMatrix
                    label="Range & filling time"
                    values={f.range_filling_time}
                    onChange={(pt, v) => updateFixed('range_filling_time', { ...f.range_filling_time, [pt]: v })}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="segment-prices">
              <AccordionTrigger className="text-sm font-medium whitespace-normal text-left items-start py-3">
                Segment base costs (2025)
              </AccordionTrigger>
              <AccordionContent>
                <SegmentBasePricesTable />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="weights">
              <AccordionTrigger className="text-sm font-medium whitespace-normal text-left items-start py-3">
                Component weights (battery &amp; fuel cell)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Used to compute BET/FCET rated payload (battery and fuel-cell weight).</p>
                  <div className="flex items-center justify-between gap-3 p-2 rounded border border-border/50">
                    <Label className="text-sm flex-1">Battery energy density <span className="text-xs text-muted-foreground">(kg/kWh)</span></Label>
                    <Input
                      type="number" step={0.5}
                      className="h-8 w-28 text-right font-mono text-sm"
                      value={f.battery_energy_density_kg_per_kwh}
                      onChange={e => updateFixed('battery_energy_density_kg_per_kwh', Number(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 p-2 rounded border border-border/50">
                    <Label className="text-sm flex-1">Fuel cell power density <span className="text-xs text-muted-foreground">(kg/kW)</span></Label>
                    <Input
                      type="number" step={0.5}
                      className="h-8 w-28 text-right font-mono text-sm"
                      value={f.fuel_cell_power_density_kg_per_kw}
                      onChange={e => updateFixed('fuel_cell_power_density_kg_per_kw', Number(e.target.value))}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="policy">
              <AccordionTrigger className="text-sm font-medium whitespace-normal text-left items-start py-3">
                Policy levers
              </AccordionTrigger>
              <AccordionContent>
                <PolicyLevers />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="maint">
              <AccordionTrigger className="text-sm font-medium whitespace-normal text-left items-start py-3">
                Maintenance including tyres
              </AccordionTrigger>
              <AccordionContent>
                <BucketMaintenanceInput />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

    </div>
  );
}

/**
 * Apply / Discard / Reset bar — rendered outside the sidebar's scroll area
 * so it stays pinned at the bottom. Two stacked rows to fit a narrow column.
 */
export function InputActionBar() {
  const { isDirty, applyChanges, discardChanges, resetToDefaults } = useScenario();

  return (
    <div className="sticky bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur-md px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        {isDirty ? (
          <Badge variant="outline" className="text-warning border-warning">Unapplied changes</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Charts are up to date</span>
        )}
        <Button variant="ghost" size="sm" onClick={resetToDefaults} className="gap-1.5 shrink-0">
          <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!isDirty} onClick={discardChanges} className="gap-1.5 flex-1">
          <Undo2 className="h-3.5 w-3.5" /> Discard
        </Button>
        <Button size="sm" disabled={!isDirty} onClick={applyChanges} className="gap-1.5 flex-1">
          <Play className="h-3.5 w-3.5" /> Apply Changes
        </Button>
      </div>
    </div>
  );
}
