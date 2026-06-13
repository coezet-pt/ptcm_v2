import * as React from 'react';
import { Input } from '@/components/ui/input';

type InputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'>;

interface NumberFieldProps extends InputProps {
  /** Current value in display scale (callers handle any *100 / /100 themselves). */
  value: number;
  /** Called with the parsed number on every valid keystroke. */
  onValueChange: (value: number) => void;
  /** Formatter used while the field is NOT focused. Defaults to String(value). */
  format?: (value: number) => string;
  /** Forces a displayed string even when blurred (e.g. a staged/pending value). */
  displayOverride?: string;
}

/** Remove trailing zeros (and a dangling dot) from a formatted decimal string. */
function trimZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

/**
 * Controlled number input that keeps a raw draft string while focused, so typing
 * is never reformatted mid-edit (no forced ".00", no caret jumping). The canonical
 * formatted value is shown only when the field is blurred.
 */
const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ value, onValueChange, format, displayOverride, onFocus, onBlur, ...rest }, ref) => {
    const [draft, setDraft] = React.useState<string | null>(null);

    const formatted = format ? format(value) : String(value);
    const display = draft ?? displayOverride ?? formatted;

    return (
      <Input
        ref={ref}
        type="number"
        inputMode="decimal"
        value={display}
        onFocus={e => {
          setDraft(trimZeros(formatted));
          e.currentTarget.select();
          onFocus?.(e);
        }}
        onChange={e => {
          const raw = e.target.value;
          setDraft(raw);
          if (raw.trim() !== '') {
            const n = Number(raw);
            if (Number.isFinite(n)) onValueChange(n);
          }
        }}
        onBlur={e => {
          setDraft(null);
          onBlur?.(e);
        }}
        {...rest}
      />
    );
  },
);
NumberField.displayName = 'NumberField';

export { NumberField };
