import { Card } from '@/components/ui/card';

interface Props {
  label: string;
  value: string | number;
  context?: string;
}

export default function KpiCard({ label, value, context }: Props) {
  return (
    <Card className="p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 font-serif text-2xl leading-tight tracking-tight"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </p>
      {context && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{context}</p>
      )}
    </Card>
  );
}
