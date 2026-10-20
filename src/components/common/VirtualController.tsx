import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { type PointerEvent, useEffect, useRef } from 'react';
import { useOptionalArcade } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type ActionType = 'A' | 'B';
export type ControllerTone = 'light' | 'dark';
interface VirtualControllerProps {
  onDirection?: (dir: Direction) => void;
  onDirectionEnd?: (dir: Direction) => void;
  onAction?: (action: ActionType) => void;
  onActionEnd?: (action: ActionType) => void;
  className?: string;
  showActions?: boolean;
  tone?: ControllerTone;
  horizontalOnly?: boolean;
  actions?: ActionType[];
  actionLabels?: Partial<Record<ActionType, string>>;
}
const directions = [
  { value: 'UP', Icon: ArrowUp, column: 2, row: 1, zh: '向上', en: 'Up' },
  { value: 'LEFT', Icon: ArrowLeft, column: 1, row: 2, zh: '向左', en: 'Left' },
  {
    value: 'RIGHT',
    Icon: ArrowRight,
    column: 3,
    row: 2,
    zh: '向右',
    en: 'Right',
  },
  { value: 'DOWN', Icon: ArrowDown, column: 2, row: 3, zh: '向下', en: 'Down' },
] as const;

type Press =
  | { type: 'direction'; value: Direction }
  | { type: 'action'; value: ActionType };
export function VirtualController(props: VirtualControllerProps) {
  const {
    className,
    showActions = true,
    tone = 'light',
    horizontalOnly = false,
    actions = ['B', 'A'],
    actionLabels,
  } = props;
  const arcade = useOptionalArcade();
  const { locale } = useLocale();
  const disabled = Boolean(arcade?.paused || arcade?.result);
  const callbacks = useRef(props);
  callbacks.current = props;
  const held = useRef(new Map<number, Press>());
  const release = (id: number) => {
    const press = held.current.get(id);
    if (!press) return;
    held.current.delete(id);
    if (press.type === 'direction')
      callbacks.current.onDirectionEnd?.(press.value);
    else callbacks.current.onActionEnd?.(press.value);
  };
  const releaseAll = () => {
    for (const id of held.current.keys()) release(id);
  };
  const releaseRef = useRef(releaseAll);
  releaseRef.current = releaseAll;
  useEffect(() => {
    const clear = () => releaseRef.current();
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('blur', clear);
      clear();
    };
  }, []);
  useEffect(() => {
    if (disabled) releaseRef.current();
  }, [disabled]);
  const press = (id: number, input: Press) => {
    if (disabled || held.current.has(id)) return;
    held.current.set(id, input);
    if (input.type === 'direction')
      callbacks.current.onDirection?.(input.value);
    else callbacks.current.onAction?.(input.value);
  };
  const bind = (input: Press) => ({
    disabled,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      press(event.pointerId, input);
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      release(event.pointerId);
    },
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) =>
      release(event.pointerId),
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) =>
      release(event.pointerId),
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      press(-1, input);
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      release(-1);
    },
    onBlur: () => release(-1),
  });
  return (
    <div
      className={cn('virtual-controller', className)}
      data-tone={tone}
      data-direction-only={!showActions}
      aria-label={locale === 'zh' ? '触屏操作' : 'Touch controls'}
    >
      <div className="virtual-dpad" data-horizontal={horizontalOnly}>
        {directions
          .filter(
            ({ value }) =>
              !horizontalOnly || value === 'LEFT' || value === 'RIGHT',
          )
          .map(({ value, Icon, column, row, zh, en }, index) => (
            <button
              key={value}
              type="button"
              aria-label={locale === 'zh' ? zh : en}
              style={{
                gridColumn: horizontalOnly ? index + 1 : column,
                gridRow: horizontalOnly ? 1 : row,
              }}
              {...bind({ type: 'direction', value })}
            >
              <Icon />
            </button>
          ))}
      </div>
      {showActions && (
        <div className="virtual-actions">
          {actions.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={actionLabels?.[value] ?? value}
              {...bind({ type: 'action', value })}
            >
              {actionLabels?.[value] ?? value}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
