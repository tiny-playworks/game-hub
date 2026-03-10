import { cn } from '@/lib/utils';
import { SEAT_NAMES, WIND_NAMES, TILE_DISCARD } from '../constants';
import { formatPoints, getSeatWind } from '../helpers';
import type { RiichiGameState } from '../types';
import { getTileColorClass, RiichiTileFace, TileBack } from './Tile';

/** 对家与自家一致（横排）；上下两家宽高互换、牌竖排成一条（红框） */
const HAND_TILE_W = 28;
const HAND_TILE_H = 38;
const MELD_TILE_W = 32;
const MELD_TILE_H = 42;

function slotSize(
  seat: 1 | 2 | 3,
  w: number,
  h: number,
): { width: number; height: number } {
  if (seat === 2) return { width: w, height: h };
  return { width: h, height: w }; // 下家、上家：宽高互换
}

function tileRotation(seat: 1 | 2 | 3): number {
  if (seat === 2) return 0;
  return seat === 1 ? -90 : 90; // 下家 -90°，上家 90°
}

type Props = {
  seat: 1 | 2 | 3;
  game: RiichiGameState;
  timerLabel: string;
  timerClassName: string;
  isCurrentTurn: boolean;
};

export function OpponentSeat({
  seat,
  game,
  timerLabel,
  timerClassName,
  isCurrentTurn,
}: Props) {
  const rot = tileRotation(seat);
  const tileStyle = { transform: `rotate(${rot}deg)` };
  const handSlot = slotSize(seat, HAND_TILE_W, HAND_TILE_H);
  const meldSlot = slotSize(seat, MELD_TILE_W, MELD_TILE_H);
  const isVertical = seat !== 2;
  return (
    <div
      className={cn(
        'rounded-lg px-2 py-1.5 flex flex-col items-center justify-center min-h-0',
        isCurrentTurn && 'bg-[#ffc107]/10 border border-[#ffc107]/40',
      )}
    >
      <p className="text-[10px] font-semibold text-[#f1faee] leading-tight">
        {SEAT_NAMES[seat]} (
        {WIND_NAMES[getSeatWind(game.roundWind, seat, game.dealer)]})
      </p>
      <p className="text-[10px] text-[#ffd700]">{game.hands[seat].length} 张</p>
      <p className="text-[10px] text-amber-200">
        {formatPoints(game.scores[seat])}
      </p>
      <p className="text-[10px] text-[#a8dadc]">
        <span className={timerClassName}>{timerLabel}</span>
      </p>
      {game.hands[seat].length > 0 && (
        <div
          className={cn(
            'flex justify-center gap-0.5 mt-0.5',
            isVertical ? 'flex-col items-center' : 'flex-wrap',
          )}
        >
          {game.hands[seat].map((_, i) => (
            <span
              key={i}
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{ width: handSlot.width, height: handSlot.height }}
            >
              <span style={tileStyle} className="inline-flex">
                <TileBack className="w-[28px] h-[38px] text-[6px]" />
              </span>
            </span>
          ))}
        </div>
      )}
      {game.melds[seat].length > 0 && (
        <div
          className={cn(
            'flex justify-center gap-0.5 mt-0.5',
            isVertical ? 'flex-col items-center' : 'flex-wrap',
          )}
        >
          {game.melds[seat].map((m, i) => (
            <span
              key={i}
              className={cn(
                'flex gap-0.5',
                isVertical && 'flex-col items-center',
              )}
            >
              {m.tiles.map((t, j) => (
                <span
                  key={j}
                  className="inline-flex items-center justify-center rounded font-bold text-[10px] flex-shrink-0"
                  style={{ width: meldSlot.width, height: meldSlot.height }}
                >
                  <span
                    style={tileStyle}
                    className={cn(
                      TILE_DISCARD,
                      'w-[32px] h-[42px]',
                      getTileColorClass(t),
                    )}
                  >
                    <RiichiTileFace tile={t} />
                  </span>
                </span>
              ))}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
