import { cn } from '@/lib/utils';
import { SEAT_NAMES, WIND_NAMES } from '../constants';
import { formatPoints, getSeatWind } from '../helpers';
import type { RiichiGameState } from '../types';
import { getTileColorClass, RiichiTileFace } from './Tile';

type Props = {
  game: RiichiGameState;
  logOpen: boolean;
  historyLength: number;
  onStart: () => void;
  onUndo: () => void;
  onToggleLog: () => void;
  onBackToRules: () => void;
  returnRulesLabel: string;
};

export function GameHeader({
  game,
  logOpen,
  historyLength,
  onStart,
  onUndo,
  onToggleLog,
  onBackToRules,
  returnRulesLabel,
}: Props) {
  return (
    <header className="flex items-center justify-between border-b border-[#2d4a3c] bg-[#1a2e25] px-4 py-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBackToRules}
          className="text-[#f1faee]/80 hover:text-[#f1faee] text-sm"
        >
          ← {returnRulesLabel}
        </button>
        <span className="text-sm text-[#f1faee]">
          {`${WIND_NAMES[game.roundWind]}${game.roundNumber}局 ${WIND_NAMES[game.roundWind]}${game.honba}场 · 庄 ${SEAT_NAMES[game.dealer]} (${WIND_NAMES[getSeatWind(game.roundWind, game.dealer, game.dealer)]})`}
        </span>
        <span className="text-xs text-[#ffd700]">
          立直棒池 {formatPoints(game.riichiPot)}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStart}
            className="rounded-lg border border-[#d4b886] px-3 py-1.5 text-sm text-[#f1faee] hover:bg-[#2d4a3c]"
          >
            新一局
          </button>
          {historyLength > 0 && (
            <button
              type="button"
              onClick={onUndo}
              className="rounded-lg border border-amber-600/70 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-900/30"
              title="回退一步（便于排查问题）"
            >
              回退
            </button>
          )}
          <button
            type="button"
            onClick={onToggleLog}
            className="rounded-lg border border-slate-500/60 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700/30"
          >
            {logOpen ? '收起日志' : '日志'}
          </button>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-[#f1faee]/80">宝牌表示</span>
        <div className="flex flex-wrap justify-center gap-1">
          {game.doraIndicators.map((ind, i) => (
            <span
              key={i}
              className={cn(
                'w-[52px] h-[72px] rounded-[6px] border-2 bg-[#fff9e6] flex items-center justify-center font-black text-lg shrink-0 tile-dora-glow',
                getTileColorClass(ind),
              )}
            >
              <RiichiTileFace tile={ind} />
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
