import { SEAT_NAMES } from '../constants';
import { formatPoints } from '../helpers';
import type { RiichiGameState } from '../types';

type Props = {
  game: RiichiGameState;
};

export function GameInfoBar({ game }: Props) {
  return (
    <>
      <div className="mb-3 rounded-lg border border-[#d4b886]/30 bg-[#1a2e25]/70 px-3 py-2 text-xs text-[#f1faee]/90">
        {SEAT_NAMES.map((name, i) => (
          <span key={name}>
            {i > 0 && ' · '}
            {name}{' '}
            <span className="font-semibold text-[#ffd700]">
              {formatPoints(game.scores[i])}
            </span>
          </span>
        ))}
      </div>
      {game.lastSettlement && (
        <div className="mb-3 rounded-lg border border-[#457b9d]/40 bg-[#1d3557]/35 px-3 py-2">
          <p className="text-xs font-medium text-[#a8dadc]">上一局结算</p>
          {game.lastSettlement.tenpaiSeats && (
            <p className="mt-1 text-[11px] text-[#f1faee]/80">
              听牌：
              {game.lastSettlement.tenpaiSeats.length === 0
                ? ' 无'
                : ` ${game.lastSettlement.tenpaiSeats.map((i) => SEAT_NAMES[i]).join('、')}`}
            </p>
          )}
          <p className="mt-1 text-[11px] text-[#f1faee]/80">
            分差：{' '}
            {game.lastSettlement.deltas
              .map((d, i) => `${SEAT_NAMES[i]} ${d >= 0 ? '+' : ''}${d}`)
              .join(' · ')}
          </p>
          {game.lastSettlement.timeoutEvents &&
            game.lastSettlement.timeoutEvents.length > 0 && (
              <p className="mt-1 text-[11px] text-[#f1faee]/80">
                超时：{game.lastSettlement.timeoutEvents.join('；')}
              </p>
            )}
        </div>
      )}
    </>
  );
}
