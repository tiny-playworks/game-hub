import { cn } from '@/lib/utils';
import { SEAT_NAMES, TILE_DISCARD, WIND_NAMES } from '../constants';
import { getSeatWind } from '../helpers';
import type { RiichiGameState } from '../types';
import { getTileColorClass, RiichiTileFace } from './Tile';

/** 舍牌区位置：0=下(自家) 1=右(下家) 2=上(对家) 3=左(上家)；牌面旋转面向中心 */
const DISCARD_ROTATION: Record<0 | 1 | 2 | 3, number> = {
  0: 0, // 下：正放
  1: -90, // 右：逆时针 90°
  2: 180, // 上：180°
  3: 90, // 左：顺时针 90°
};

/** 舍牌区在 grid 中的 area 与 flex 方向 */
const DISCARD_LAYOUT: Record<
  0 | 1 | 2 | 3,
  { gridArea: string; flexDir: 'row' | 'column'; justify: string }
> = {
  0: { gridArea: 'bottom', flexDir: 'row', justify: 'center' },
  1: { gridArea: 'right', flexDir: 'column', justify: 'center' },
  2: { gridArea: 'top', flexDir: 'row', justify: 'center' },
  3: { gridArea: 'left', flexDir: 'column', justify: 'center' },
};

const DISCARD_SLICE = 8;

type Props = {
  game: RiichiGameState;
};

/** 雀姬式牌桌中央：中心牌山+宝牌，四边各一家舍牌矩形、牌面向中心 */
export function CenterArea({ game }: Props) {
  return (
    <div
      className="rounded-2xl border shadow-inner overflow-hidden min-h-0 grid gap-0.5 p-1.5"
      style={{
        gridTemplateAreas: `
          "top    top    top"
          "left   center right"
          "bottom bottom bottom"
        `,
        gridTemplateRows: 'minmax(0,1fr) auto minmax(0,1fr)',
        gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
        borderColor:
          'color-mix(in srgb, var(--riichi-border) 40%, transparent)',
        backgroundColor: 'var(--riichi-table-inner)',
      }}
    >
      {/* 中心：牌山 + 宝牌 */}
      <div
        className="rounded-xl border flex flex-col items-center justify-center gap-1 p-2 min-w-[80px] min-h-[64px]"
        style={{
          gridArea: 'center',
          backgroundColor:
            'color-mix(in srgb, var(--riichi-bg-to) 90%, transparent)',
          borderColor:
            'color-mix(in srgb, var(--riichi-border) 20%, transparent)',
        }}
      >
        <p
          className="text-sm font-bold tabular-nums whitespace-nowrap"
          style={{ color: 'var(--riichi-accent)' }}
        >
          牌山 · {game.wall.length}
        </p>
        {game.doraIndicators.length > 0 && (
          <div className="flex flex-wrap justify-center gap-0.5">
            {game.doraIndicators.map((ind, i) => (
              <span
                key={i}
                className={cn(
                  TILE_DISCARD,
                  'w-[36px] h-[48px] text-[10px]',
                  getTileColorClass(ind),
                )}
                title="宝牌"
              >
                <RiichiTileFace tile={ind} />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 四边舍牌区：各自矩形、牌面向中心 */}
      {([2, 1, 0, 3] as const).map((seat) => {
        const rot = DISCARD_ROTATION[seat];
        const { gridArea, flexDir, justify } = DISCARD_LAYOUT[seat];
        const tiles = game.discardPiles[seat].slice(-DISCARD_SLICE);
        const isSelf = seat === 0;
        return (
          <div
            key={seat}
            className="rounded-lg border min-h-0 overflow-hidden flex flex-wrap gap-0.5 p-1"
            style={{
              gridArea,
              flexDirection: flexDir,
              justifyContent: justify as 'center',
              alignContent: 'center',
              borderColor: isSelf
                ? 'color-mix(in srgb, var(--riichi-text-muted) 30%, transparent)'
                : 'color-mix(in srgb, var(--riichi-border) 20%, transparent)',
              backgroundColor: isSelf
                ? 'color-mix(in srgb, var(--riichi-table) 25%, transparent)'
                : 'color-mix(in srgb, var(--riichi-table-inner) 60%, transparent)',
            }}
          >
            <span
              className="text-[10px] font-medium shrink-0"
              style={{
                color: 'var(--riichi-text)',
                ...(flexDir === 'column'
                  ? { writingMode: 'vertical-rl' as const }
                  : {}),
              }}
            >
              {SEAT_NAMES[seat]}{' '}
              <span style={{ color: 'var(--riichi-text-muted)', opacity: 0.8 }}>
                {WIND_NAMES[getSeatWind(game.roundWind, seat, game.dealer)]}
              </span>
            </span>
            <div
              className="flex gap-0.5 flex-wrap min-w-0 min-h-0"
              style={{
                flexDirection: flexDir,
                justifyContent: 'flex-end',
              }}
            >
              {tiles.map((t, i) => (
                <span
                  key={`${seat}-${i}`}
                  className={cn(
                    TILE_DISCARD,
                    'w-[38px] h-[52px]',
                    getTileColorClass(t),
                  )}
                  style={{ transform: `rotate(${rot}deg)` }}
                >
                  <RiichiTileFace tile={t} />
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
