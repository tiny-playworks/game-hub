import { getBaseTile, isAkaFive } from '@/lib/mahjongRiichi';
import { cn } from '@/lib/utils';

/** 数牌三色：万 / 条 / 筒 用底色与边框区分，避免「全白底看花」 */
export function getTileColorClass(tile: number): string {
  const t = getBaseTile(tile);
  if (t >= 27) {
    if (t === 31) return 'text-red-700 border-rose-400/60 !bg-rose-50/95';
    if (t === 32)
      return 'text-emerald-700 border-emerald-400/60 !bg-emerald-50/95';
    if (t === 33) return 'text-slate-400 border-slate-300/70 !bg-slate-50';
    return 'text-stone-900 border-stone-300/70 !bg-stone-50/95';
  }
  if (t < 9) {
    return 'text-red-900 border-rose-400/75 !bg-gradient-to-br from-rose-50 to-amber-50/90';
  }
  if (t < 18) {
    return 'text-emerald-950 border-emerald-500/55 !bg-gradient-to-br from-emerald-50 to-teal-50/85';
  }
  return 'text-sky-950 border-sky-500/55 !bg-gradient-to-br from-sky-50 to-cyan-50/85';
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
    const chars = ['東', '南', '西', '北', '中', '發', '白'];
    return (
      <span className={cn('font-bold', className, redClass)}>
        {chars[base - 27]}
      </span>
    );
  }

  const numIndex = base % 9;
  const suitIndex = Math.floor(base / 9);

  const MANZU = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  // 条、筒用数字 + 花色字；花色顺序须与 mahjongRiichi 一致：0–8 万、9–17 条、18–26 筒
  const NUMS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const suits = ['万', '条', '筒'];

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
