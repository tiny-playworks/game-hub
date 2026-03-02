import { cn } from '@/lib/utils';
import { SEAT_NAMES, WIND_NAMES } from '../constants';
import { formatPoints, getSeatWind } from '../helpers';
import type { RiichiGameState } from '../types';
import { getTileColorClass, RiichiTileFace, TileBack } from './Tile';

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
  return (
    <div
      className={cn(
        'rounded-lg px-3 py-2 flex flex-col items-center justify-center min-h-[64px]',
        isCurrentTurn && 'bg-[#ffc107]/10 border border-[#ffc107]/40',
      )}
    >
      <p className="text-xs font-semibold text-[#f1faee]">
        {SEAT_NAMES[seat]} (
        {WIND_NAMES[getSeatWind(game.roundWind, seat, game.dealer)]})
      </p>
      <p className="text-xs text-[#ffd700]">{game.hands[seat].length} 张</p>
      <p className="text-[11px] text-amber-200">
        {formatPoints(game.scores[seat])}
      </p>
      <p className="text-[11px] text-[#a8dadc]">
        <span className={timerClassName}>{timerLabel}</span>
      </p>
      {game.hands[seat].length > 0 && (
        <div className="flex flex-wrap justify-center gap-0.5 mt-1">
          {game.hands[seat].map((_, i) => (
            <TileBack key={i} className="w-[28px] h-[38px] text-[6px]" />
          ))}
        </div>
      )}
      {game.melds[seat].length > 0 && (
        <div className="flex flex-wrap justify-center gap-0.5 mt-1">
          {game.melds[seat].map((m, i) => (
            <span key={i} className="flex gap-0.5">
              {m.tiles.map((t, j) => (
                <span
                  key={j}
                  className={cn(
                    'w-[32px] h-[42px] rounded flex items-center justify-center font-bold text-[10px]',
                    getTileColorClass(t),
                  )}
                >
                  <RiichiTileFace tile={t} />
                </span>
              ))}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
