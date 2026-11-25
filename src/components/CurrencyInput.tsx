import React, { useEffect, useState } from 'react';
import { formatNumberAsBRMask, parseCurrencyMaskInput } from '../utils/format';

interface CurrencyInputProps {
  id?: string;
  value: number;
  onChange: (nextValue: number) => void;
  onEnter?: () => void;
  ariaLabel?: string;
  placeholder?: string;
  allowNegative?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  id,
  value,
  onChange,
  onEnter,
  ariaLabel,
  placeholder = 'R$ 0,00',
  allowNegative = false,
  className = '',
  autoFocus = false,
}) => {
  const [display, setDisplay] = useState<string>(() =>
    value === 0 ? 'R$ 0,00' : `R$ ${formatNumberAsBRMask(value)}`,
  );

  useEffect(() => {
    const formatted =
      value < 0
        ? `-R$ ${formatNumberAsBRMask(Math.abs(value))}`
        : `R$ ${formatNumberAsBRMask(value)}`;
    setDisplay(formatted);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const numeric = parseCurrencyMaskInput(raw, allowNegative);
    const formatted =
      numeric < 0
        ? `-R$ ${formatNumberAsBRMask(Math.abs(numeric))}`
        : `R$ ${formatNumberAsBRMask(numeric)}`;
    setDisplay(formatted);
    onChange(numeric);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) {
      e.preventDefault();
      onEnter();
    } else if (allowNegative && e.key === '-') {
      e.preventDefault();
      onChange(value === 0 ? 0 : -value);
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={display}
      autoFocus={autoFocus}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={(e) => e.currentTarget.select()}
      className={`font-mono-nums bg-[var(--bg-input)] border-[1.5px] border-[var(--border-strong)] rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-underline)] focus:ring-1 focus:ring-[var(--accent-underline)]/35 transition-colors ${className}`}
    />
  );
};
