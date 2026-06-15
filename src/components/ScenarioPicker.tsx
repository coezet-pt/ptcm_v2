import { useScenario } from '@/contexts/ScenarioContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ScenarioName } from '@/lib/constants/extracted';
import { RotateCcw } from 'lucide-react';

const SCENARIOS: (ScenarioName | 'Custom')[] = ['BAU', 'BWS-1', 'BWS-2', 'BEST', 'Custom'];

const SCENARIO_LABELS: Record<ScenarioName | 'Custom', string> = {
  BAU: 'Basic',
  'BWS-1': 'BWS-1',
  'BWS-2': 'BWS-2',
  BEST: 'BEST',
  Custom: 'Custom',
};

const SCENARIO_DIFFS: Record<ScenarioName | 'Custom', string[]> = {
  BAU: [],
  'BWS-1': ['BET ₹5k/kWh till 2035', 'FCET ₹15k/kWh till 2035', 'Hydrogen blending allowed'],
  'BWS-2': ['BWS-1 + cheaper Hydrogen', '₹2/kWh elec subsidy', '50% toll 10yr', 'GVW relief'],
  BEST: ['₹10k→5k BET', '₹30k→15k FCET', '10% interest', '100% toll 5yr', 'Range concern gone'],
  Custom: [],
};

export default function ScenarioPicker() {
  const { activeScenario, setActiveScenario, resetToBAU } = useScenario();
  const diffs = SCENARIO_DIFFS[activeScenario] ?? [];

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-3">
        <Select value={activeScenario} onValueChange={(v) => setActiveScenario(v as ScenarioName | 'Custom')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue>{SCENARIO_LABELS[activeScenario]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SCENARIOS.map(s => (
              <SelectItem key={s} value={s} disabled={s === 'Custom'}>
                {SCENARIO_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeScenario === 'Custom' && (
          <Badge variant="outline" className="text-warning border-warning">
            Custom
          </Badge>
        )}

        <Button variant="ghost" size="sm" onClick={resetToBAU} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to Basic
        </Button>
      </div>

      {diffs.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1 max-w-[420px]">
          {diffs.map(d => (
            <Badge key={d} variant="secondary" className="text-[10px] font-normal">
              {d}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
