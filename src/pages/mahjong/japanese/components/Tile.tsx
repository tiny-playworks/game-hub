import {
  getBaseTile,
  isAkaFive,
  TILE_LABELS_RIICHI,
} from '@/lib/mahjongRiichi';
import { cn } from '@/lib/utils';

export function getTileColorClass(tile: number): string {
  const t = getBaseTile(tile);
  if (t >= 27) {
    if (t === 31) return 'text-red-700 bg-red-50 border-red-400';
    if (t === 32) return 'text-green-800 bg-emerald-50 border-emerald-500';
    if (t === 33) return 'text-stone-700 bg-stone-200 border-stone-500';
    return 'text-stone-900 bg-stone-100 border-stone-600';
  }
  if (t < 9) return 'text-red-800 bg-red-50 border-red-400';
  if (t < 18) return 'text-green-800 bg-green-50 border-green-500';
  return 'text-amber-800 bg-amber-50 border-amber-500';
}

/** 牌面：日麻 0-36；红宝牌仅数字/花色用红色，不写「赤」 */
export function RiichiTileFace({
  tile,
  className,
}: {
  tile: number;
  className?: string;
}) {
  const base = getBaseTile(tile);
  const isRed = isAkaFive(tile);
  if (base >= 27) {
    return (
      <span className={cn(className, isRed && 'text-red-600')}>
        {TILE_LABELS_RIICHI[base]}
      </span>
    );
  }
  const num = (base % 9) + 1;
  const suit = base < 9 ? '万' : base < 18 ? '条' : '筒';
  return (
    <span className={className}>
      <span className={isRed ? 'text-red-600' : undefined}>{num}</span>
      <span className={cn('text-[0.65em] opacity-90', isRed && 'text-red-600')}>
        {suit}
      </span>
    </span>
  );
}

/** 牌背：用于展示电脑手牌张数，不露牌面 */
export function TileBack({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'rounded-[4px] border-2 border-amber-800/60 bg-gradient-to-br from-amber-900/90 to-amber-800/70 flex items-center justify-center',
        className,
      )}
      title="牌背"
    >
      <span className="text-[8px] text-amber-200/40 font-bold">🀄</span>
    </span>
  );
}
