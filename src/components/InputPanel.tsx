import { Card, CardContent } from '@/components/ui/card';
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
import HydrogenSourceMix from './HydrogenSourceMix';
import GvwForZet from './GvwForZet';
import KeyAggregateLifeInput from './KeyAggregateLifeInput';
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
  return (
    <div className="space-y-6">
      {/* Primary trajectories — always visible */}
      <Card>
        <CardContent className="divide-y divide-border/50 pt-4">
          {/* 1 — Fuel/Energy Cost (including Grey Hydrogen Cost) */}
          <CostSection title="Fuel/Energy Cost">
            <ParameterRow paramKey="diesel_price_per_l" labelOverride="Diesel" />
            <ParameterRow paramKey="lng_price_per_kg"   labelOverride="LNG" />
            <ParameterRow paramKey="cng_price_per_kg"   labelOverride="CNG" />
            <ParameterRow paramKey="electricity_incl_caas_per_kwh" labelOverride="Electricity at Charging Point (incl. CAAS)" />
            <ParameterRow paramKey="green_h2_production_per_kg"    labelOverride="Green Hydrogen Production" />
            <ParameterRow paramKey="grey_h2_production_per_kg"     labelOverride="Grey Hydrogen Production" />
            <ParameterRow paramKey="h2_compression_storage_per_kg" labelOverride="Hydrogen Compression, Transport & Dispense" />
          </CostSection>

          {/* 2 — Key Aggregate Cost */}
          <CostSection title="Key Aggregate Cost">
            <ParameterRow paramKey="battery_cost_per_kwh"  labelOverride="Battery" />
            <ParameterRow paramKey="fuel_cell_cost_per_kw" labelOverride="Fuel Cell" />
            <ParameterRow paramKey="h2_tank_cost_per_kg"   labelOverride="Hydrogen Tank" />
            <ParameterRow paramKey="lng_tank_cost_per_kg"  labelOverride="LNG Tank" />
          </CostSection>

          {/* 3 — Key Aggregate Life */}
          <CostSection title="Key Aggregate Life">
            <KeyAggregateLifeInput />
          </CostSection>

          {/* 4 — Hydrogen Source Mix */}
          <CostSection title="Hydrogen Source Mix">
            <HydrogenSourceMix />
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

            <AccordionItem value="policy-support">
              <AccordionTrigger className="text-sm font-medium whitespace-normal text-left items-start py-3">
                Policy support
              </AccordionTrigger>
              <AccordionContent>
                <GvwForZet />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="maintenance">
              <AccordionTrigger className="text-sm font-medium whitespace-normal text-left items-start py-3">
                Maintenance
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
