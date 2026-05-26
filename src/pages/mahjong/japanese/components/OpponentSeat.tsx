import { cn } from '@/lib/utils';
import { SEAT_NAMES, TILE_DISCARD, WIND_NAMES } from '../constants';
import { formatPoints, getSeatWind } from '../helpers';
import type { RiichiGameState } from '../types';
import { getTileColorClass, RiichiTileFace, TileBack } from './Tile';

const TOP_HAND_SLOT = { width: 22, height: 31 };
const SIDE_HAND_SLOT = { width: 26, height: 18 };
const TOP_TILE_BACK_CLASS = 'w-[22px] h-[31px]';
const SIDE_TILE_BACK_CLASS = 'w-[18px] h-[26px]';
const SIDE_VISIBLE_BACKS = 7;

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
  const isVertical = seat !== 2;
  const handSlot = isVertical ? SIDE_HAND_SLOT : TOP_HAND_SLOT;
  const tileBackClassName = isVertical
    ? SIDE_TILE_BACK_CLASS
    : TOP_TILE_BACK_CLASS;
  const visibleBacks = isVertical
    ? Math.min(game.hands[seat].length, SIDE_VISIBLE_BACKS)
    : game.hands[seat].length;
  return (
    <button
      type="button"
      className={cn(
        'riichi-opponent-seat rounded-lg px-2 py-1.5 flex flex-col items-center justify-center min-h-0 overflow-visible',
        isVertical && 'px-1.5 md:px-2',
        isCurrentTurn && 'riichi-opponent-seat-active border',
      )}
      aria-label={`${SEAT_NAMES[seat]} ${WIND_NAMES[getSeatWind(game.roundWind, seat, game.dealer)]} ${game.hands[seat].length}张 ${formatPoints(game.scores[seat])} ${timerLabel}`}
    >
      <div className="riichi-opponent-chip">
        <span className="font-semibold">{SEAT_NAMES[seat]}</span>
        <span className="opacity-70">
          {WIND_NAMES[getSeatWind(game.roundWind, seat, game.dealer)]}
        </span>
      </div>
      <div className="riichi-opponent-float" role="tooltip">
        <p className="font-semibold">
          {SEAT_NAMES[seat]} ·{' '}
          {WIND_NAMES[getSeatWind(game.roundWind, seat, game.dealer)]}
        </p>
        <p>{game.hands[seat].length} 张</p>
        <p>{formatPoints(game.scores[seat])}</p>
        <p>
          <span className={timerClassName}>{timerLabel}</span>
        </p>
      </div>
      {game.hands[seat].length > 0 && (
        <div
          className={cn(
            'flex justify-center gap-0.5 mt-0.5 overflow-visible',
            isVertical ? 'flex-col items-center' : 'flex-wrap',
          )}
        >
          {Array.from({ length: visibleBacks }, (_, i) => (
            <span
              key={i}
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{ width: handSlot.width, height: handSlot.height }}
            >
              <span style={tileStyle} className="inline-flex">
                <TileBack className={tileBackClassName} />
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
                  style={{ width: handSlot.width, height: handSlot.height }}
                >
                  <span
                    style={tileStyle}
                    className={cn(TILE_DISCARD, getTileColorClass(t))}
                  >
                    <RiichiTileFace tile={t} />
                  </span>
                </span>
              ))}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
