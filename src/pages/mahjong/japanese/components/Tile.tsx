import { getBaseTile, isAkaFive } from '@/lib/mahjongRiichi';
import { cn } from '@/lib/utils';

export function getTileColorClass(tile: number): string {
  const t = getBaseTile(tile);
  if (t >= 27) {
    if (t === 31) return 'text-slate-400';
    if (t === 32) return 'text-emerald-700';
    if (t === 33) return 'text-red-700';
    return 'text-stone-900';
  }
  if (t < 9) return 'text-red-800';
  if (t < 18) return 'text-emerald-800';
  return 'text-sky-800';
}

export function RiichiTileFace({
  tile,
  className,
}: {
  tile: number;
  className?: string;
}) {
  const base = getBaseTile(tile);
  const isRed = isAkaFive(tile);
  const redClass = isRed ? 'text-red-600' : '';

  if (base >= 27) {
    const chars = ['東', '南', '西', '北', '白', '發', '中'];
    return (
      <span className={cn('font-bold', className, redClass)}>
        {chars[base - 27]}
      </span>
    );
  }

  const numIndex = base % 9;
  const suitIndex = Math.floor(base / 9);

  const MANZU = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  // For Pinzu and Souzu, we use numbers for clarity, combined with character.
  const NUMS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const suits = ['萬', '筒', '索'];

  const topChar = suitIndex === 0 ? MANZU[numIndex] : NUMS[numIndex];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center -space-y-0.5 w-full h-full',
        className,
      )}
    >
      <span className={cn('text-[1em] font-black leading-none', redClass)}>
        {topChar}
      </span>
      <span
        className={cn(
          'text-[0.65em] font-black leading-tight opacity-90',
          redClass,
        )}
      >
        {suits[suitIndex]}
      </span>
    </div>
  );
}

export function TileBack({ className }: { className?: string }) {
  return <span className={cn('riichi-tile-back', className)} title="牌背" />;
}
