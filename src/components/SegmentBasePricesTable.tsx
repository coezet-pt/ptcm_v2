import { Input } from '@/components/ui/input';
import { useScenario } from '@/contexts/ScenarioContext';
import type { VehicleSize } from '@/lib/constants/extracted';

const SIZES: VehicleSize[] = [
  '15T Rigid', '19T Rigid', '28T Rigid', '35T Rigid', '48T Rigid',
  '28T Tipper', '35T Tipper', '40T Tractor', '55T Tractor',
];

export default function SegmentBasePricesTable() {
  const { draftConfig, updateSegmentPrice } = useScenario();
  const sbp = draftConfig.segmentBasePrices;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        2025 base costs per vehicle segment. Engine+Trans and E-Powertrain feed BET/FCET vehicle cost build-up;
        Diesel Total is the on-road diesel reference. Per-segment battery, fuel cell, and tank costs are derived
        from the component trajectories in section B (battery cost/kWh, fuel cell cost/kW, etc.).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left py-2 px-3 font-medium">Segment</th>
              <th className="text-right py-2 px-2 font-medium">Engine+Trans (₹)</th>
              <th className="text-right py-2 px-2 font-medium">E-Powertrain (₹)</th>
              <th className="text-right py-2 px-2 font-medium">Diesel Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {SIZES.map(size => {
              const row = sbp[size];
              return (
                <tr key={size} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-3 font-medium whitespace-nowrap">{size}</td>
                  <td className="py-2 px-2">
                    <Input
                      type="number" step={10000}
                      className="h-8 w-28 ml-auto text-right font-mono text-sm"
                      value={row.engine_trans}
                      onChange={e => updateSegmentPrice(size, 'engine_trans', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <Input
                      type="number" step={10000}
                      className="h-8 w-28 ml-auto text-right font-mono text-sm"
                      value={row.e_powertrain}
                      onChange={e => updateSegmentPrice(size, 'e_powertrain', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <Input
                      type="number" step={50000}
                      className="h-8 w-32 ml-auto text-right font-mono text-sm"
                      value={row.diesel_total}
                      onChange={e => updateSegmentPrice(size, 'diesel_total', Number(e.target.value))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
