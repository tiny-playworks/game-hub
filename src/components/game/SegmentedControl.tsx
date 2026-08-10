import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 分段选择器：用于对手模式、AI 难度等少量互斥选项，比下拉框更快也更适合触屏。
 * 底层是原生 radio，键盘方向键切换和读屏都能直接用。
 */
export const SegmentedControl = <T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
  className,
}: SegmentedControlProps<T>) => {
  const name = useId();

  return (
    <fieldset
      className={cn(
        'inline-flex rounded-full border border-border/70 bg-white/70 p-0.5',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <legend className="sr-only">{ariaLabel}</legend>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              'cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition select-none active:scale-95',
              active
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              'focus-within:ring-2 focus-within:ring-sky-500',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={active}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
};
