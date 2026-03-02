import { cn } from '@/lib/utils';
import { SEAT_NAMES, TILE_DISCARD, WIND_NAMES } from '../constants';
import { getSeatWind } from '../helpers';
import type { RiichiGameState } from '../types';
import { getTileColorClass, RiichiTileFace } from './Tile';

type Props = {
  game: RiichiGameState;
};

export function CenterArea({ game }: Props) {
  return (
    <div className="rounded-lg bg-[#1a2e25]/50 flex flex-col p-3 min-h-[100px]">
      <p className="text-center text-2xl font-bold text-[#ffd700] tabular-nums">
        剩余 {game.wall.length}
      </p>
      <div className="flex flex-col gap-1.5 overflow-auto mt-2">
        {([0, 1, 2, 3] as const).map((seat) => (
          <div key={seat} className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] text-[#f1faee]/70 shrink-0">
              {SEAT_NAMES[seat]} (
              {WIND_NAMES[getSeatWind(game.roundWind, seat, game.dealer)]})
            </span>
            {game.discardPiles[seat].slice(-8).map((t, i) => (
              <span
                key={`${seat}-${i}`}
                className={cn(TILE_DISCARD, getTileColorClass(t))}
              >
                <RiichiTileFace tile={t} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
