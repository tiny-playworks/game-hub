import type { CSSProperties } from 'react';
import tileAtlasUrl from '@/assets/riichi/tiles/riichi-tile-atlas.png';
import { getBaseTile, getTileLabel, isAkaFive } from '@/lib/mahjongRiichi';
import { cn } from '@/lib/utils';

export type RiichiTileVariant = 'hand' | 'river' | 'meld' | 'indicator';
export type RiichiTileState = 'normal' | 'drawn' | 'last-discard' | 'disabled';

export type RiichiTileProps = {
  tile: number;
  variant: RiichiTileVariant;
  rotation?: 0 | 90 | 180 | -90;
  state?: RiichiTileState;
  onClick?: () => void;
};

type AtlasCell = {
  column: number;
  row: number;
};

export const RIICHI_TILE_ATLAS = Array.from({ length: 37 }, (_, id) => ({
  id,
  base: getBaseTile(id),
  aka: isAkaFive(id),
})) as readonly { id: number; base: number; aka: boolean }[];

const ATLAS_WIDTH = 1620;
const ATLAS_HEIGHT = 971;
const ATLAS_TILE_WIDTH = 143;
const ATLAS_COLUMN_LEFT = [22, 182, 340, 499, 659, 818, 977, 1137, 1297, 1456];
const ATLAS_ROWS = [
  { top: 23, height: 175 },
  { top: 212, height: 175 },
  { top: 401, height: 177 },
  { top: 592, height: 168 },
  { top: 776, height: 172 },
] as const;

function getAtlasCell(tile: number): AtlasCell {
  const base = getBaseTile(tile);
  if (isAkaFive(tile)) {
    if (base < 9) return { column: 9, row: 0 };
    if (base < 18) return { column: 9, row: 1 };
    return { column: 9, row: 2 };
  }
  if (base < 9) return { column: base, row: 0 };
  if (base < 18) return { column: base - 9, row: 1 };
  if (base < 27) return { column: base - 18, row: 2 };
  return { column: Math.max(0, Math.min(6, base - 27)), row: 3 };
}

function getAtlasStyle({ column, row }: AtlasCell): CSSProperties {
  const left = ATLAS_COLUMN_LEFT[column];
  const rowRect = ATLAS_ROWS[row];
  return {
    backgroundImage: `url("${tileAtlasUrl}")`,
    backgroundPosition: `${(left / (ATLAS_WIDTH - ATLAS_TILE_WIDTH)) * 100}% ${(rowRect.top / (ATLAS_HEIGHT - rowRect.height)) * 100}%`,
    backgroundSize: `${(ATLAS_WIDTH / ATLAS_TILE_WIDTH) * 100}% ${(ATLAS_HEIGHT / rowRect.height) * 100}%`,
  };
}

function TileArtwork({ tile }: { tile: number }) {
  return (
    <span
      className="riichi-tile-art"
      style={getAtlasStyle(getAtlasCell(tile))}
      aria-hidden="true"
    />
  );
}

/** Compatibility helper retained for narrow callers outside the game table. */
export function getTileColorClass(tile: number): string {
  const base = getBaseTile(tile);
  if (base >= 27) {
    if (base === 31) return 'text-red-700 border-rose-400/60 bg-rose-50';
    if (base === 32)
      return 'text-emerald-700 border-emerald-400/60 bg-emerald-50';
    if (base === 33) return 'text-slate-400 border-slate-300/70 bg-slate-50';
    return 'text-stone-900 border-stone-300/70 bg-stone-50';
  }
  if (base < 9 || isAkaFive(tile)) return 'text-red-900 border-rose-400/75';
  if (base < 18) return 'text-emerald-950 border-emerald-500/55';
  return 'text-sky-950 border-sky-500/55';
}

export function RiichiTileFace({
  tile,
  className,
}: {
  tile: number;
  className?: string;
}) {
  const base = getBaseTile(tile);
  const honorLabel =
    base >= 27 ? ['東', '南', '西', '北', '中', '發', '白'][base - 27] : null;
  return (
    <span className={cn('riichi-tile-face-compat', className)}>
      <TileArtwork tile={tile} />
      {honorLabel && <span className="sr-only">{honorLabel}</span>}
    </span>
  );
}

export function RiichiTile({
  tile,
  variant,
  rotation = 0,
  state = 'normal',
  onClick,
}: RiichiTileProps) {
  const className = cn(
    'riichi-tile',
    `riichi-tile--${variant}`,
    `riichi-tile--${state}`,
    onClick && 'riichi-tile--interactive',
  );
  const face = (
    <span className="riichi-tile-rotator">
      <TileArtwork tile={tile} />
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        data-rotation={rotation}
        onClick={onClick}
        disabled={state === 'disabled'}
        aria-label={getTileLabel(tile)}
      >
        {face}
      </button>
    );
  }

  return (
    <span
      className={className}
      data-rotation={rotation}
      aria-label={getTileLabel(tile)}
    >
      {face}
    </span>
  );
}

export function TileBack({
  className,
  rotation = 0,
}: {
  className?: string;
  rotation?: 0 | 90 | 180 | -90;
}) {
  return (
    <span
      className={cn('riichi-tile-back', className)}
      data-rotation={rotation}
      title="牌背"
    >
      <span className="riichi-tile-back-rotator">
        <span
          className="riichi-tile-art"
          style={getAtlasStyle({ column: 0, row: 4 })}
          aria-hidden="true"
        />
      </span>
    </span>
  );
}
