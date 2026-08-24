import { useEffect, useRef, useState } from 'react';
import { parseNumericInput, stripLeadingZeros } from '../lib/numeric-input';

export function NumericInput({
  value,
  onChange,
  allowDecimal = false,
  className,
  min,
  max,
}: {
  value: number;
  onChange: (value: number) => void;
  allowDecimal?: boolean;
  className?: string;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(() => stripLeadingZeros(String(value ?? 0), allowDecimal) || '0');
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setText(stripLeadingZeros(String(value ?? 0), allowDecimal) || '0');
  }, [allowDecimal, value]);

  const emit = (nextText: string) => {
    setText(nextText);
    let nextValue = parseNumericInput(nextText);
    if (max !== undefined) nextValue = Math.min(nextValue, max);
    lastEmitted.current = nextValue;
    onChange(nextValue);
  };

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={text}
      onFocus={event => event.currentTarget.select()}
      onChange={event => emit(stripLeadingZeros(event.target.value, allowDecimal))}
      onBlur={() => {
        let nextValue = parseNumericInput(text);
        if (min !== undefined) nextValue = Math.max(nextValue, min);
        if (max !== undefined) nextValue = Math.min(nextValue, max);
        lastEmitted.current = nextValue;
        const nextText = stripLeadingZeros(String(nextValue), allowDecimal) || '0';
        setText(nextText);
        onChange(nextValue);
      }}
      className={className}
    />
  );
}
