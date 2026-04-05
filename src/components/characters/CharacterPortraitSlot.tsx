import type { CharacterDef } from '@/lib/playerCharacters';
import { cn } from '@/lib/utils';

const sizeClass: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-12 w-12 min-h-12 min-w-12 text-sm',
  md: 'h-16 w-16 min-h-16 min-w-16 text-lg',
  lg: 'h-24 w-24 min-h-24 min-w-24 text-2xl',
};

export interface CharacterPortraitSlotProps {
  character: CharacterDef;
  size?: keyof typeof sizeClass;
  /** 当 portraitKey 有值时由资源层解析；当前仅占位 */
  label: string;
  className?: string;
}

/**
 * 立绘挂载位：无资源时用角色 accent 渐变 + 首字占位，后续可接 portraitKey → 静态资源。
 */
export function CharacterPortraitSlot({
  character,
  size = 'md',
  label,
  className,
}: CharacterPortraitSlotProps) {
  const initial = character.name.slice(0, 1);
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-gradient-to-br font-semibold shadow-inner',
        character.accent,
        sizeClass[size],
        className,
        // 占位为浅色渐变，文字必须深色；放在最后以免被外层 text-white 等覆盖
        'text-slate-900',
      )}
    >
      {initial}
    </div>
  );
}
