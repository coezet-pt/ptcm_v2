import { NumberField } from '@/components/ui/number-field';
import { useScenario } from '@/contexts/ScenarioContext';

interface Props {
  label: string;
  /** 'zet' uses policy.interest_rate_zet + policy.loan_tenure_years.
   *  'nonzet' uses fixed.interest_rate_ice + fixed.loan_tenure_years_nonzet. */
  kind: 'zet' | 'nonzet';
}

export default function FundingInput({ label, kind }: Props) {
  const { draftConfig, updatePolicy, updateFixed } = useScenario();

  const rate = kind === 'zet' ? draftConfig.policy.interest_rate_zet : draftConfig.fixed.interest_rate_ice;
  const tenure = kind === 'zet'
    ? draftConfig.policy.loan_tenure_years
    : (draftConfig.fixed.loan_tenure_years_nonzet ?? draftConfig.policy.loan_tenure_years);

  return (
    <div className="flex items-center gap-3 py-2 flex-wrap">
      <div className="text-sm font-medium min-w-[180px]">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Rate</span>
        <NumberField
          step={0.1}
          className="h-8 w-20 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={rate * 100}
          format={n => n.toFixed(1)}
          onValueChange={pct => {
            const v = pct / 100;
            if (kind === 'zet') updatePolicy('interest_rate_zet', v);
            else updateFixed('interest_rate_ice', v);
          }}
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Tenure</span>
        <NumberField
          step={1}
          min={1}
          className="h-8 w-16 text-right font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={tenure}
          onValueChange={v => {
            if (kind === 'zet') updatePolicy('loan_tenure_years', v);
            else updateFixed('loan_tenure_years_nonzet' as any, v);
          }}
        />
        <span className="text-xs text-muted-foreground">yrs</span>
      </div>
    </div>
  );
}