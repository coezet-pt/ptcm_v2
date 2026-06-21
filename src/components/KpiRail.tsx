import { Button } from '@/components/ui/button';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

export interface KpiItem {
  label: string;
  value: string | number;
  context?: string;
}

interface Props {
  items: KpiItem[];
  open: boolean;
  onToggle: () => void;
}

/** Slim right rail of headline metrics, collapsible to a thin strip. */
export default function KpiRail({ items, open, onToggle }: Props) {
  if (!open) {
    return (
      <div className="sticky top-14 h-[calc(100vh-3.5rem)] flex flex-col items-center gap-3 border-l border-border pt-3 px-1">
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={onToggle}
          title="Show impact panel"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        <span className="[writing-mode:vertical-rl] text-[10px] uppercase tracking-[0.22em] text-muted-foreground select-none">
          Key Insights
        </span>
      </div>
    );
  }

  return (
    <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-l border-border px-4 py-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Key Insights</p>
        <Button
          variant="ghost" size="icon" className="h-6 w-6 -mr-1"
          onClick={onToggle}
          title="Hide impact panel"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="divide-y divide-border/70">
        {items.map(it => (
          <div key={it.label} className="py-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{it.label}</p>
            <p
              className="mt-1.5 font-serif text-[1.75rem] leading-none tracking-tight"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {it.value}
            </p>
            {it.context && (
              <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{it.context}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
