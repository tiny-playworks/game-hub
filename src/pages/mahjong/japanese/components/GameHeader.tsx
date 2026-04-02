import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  RIICHI_THEMES,
  type RiichiThemeId,
  SEAT_NAMES,
  WIND_NAMES,
} from '../constants';
import { formatPoints } from '../helpers';
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
  homeLabel: string;
  theme: RiichiThemeId;
  onThemeChange: (theme: RiichiThemeId) => void;
  onOpenGuide: () => void;
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
  homeLabel,
  theme,
  onThemeChange,
  onOpenGuide,
}: Props) {
  const roundText = `${WIND_NAMES[game.roundWind]}${game.roundNumber}局 ${WIND_NAMES[game.roundWind]}${game.honba}场 · 庄 ${SEAT_NAMES[game.dealer]}`;
  return (
    <header
      className="flex flex-col md:flex-row md:items-center md:justify-between border-b px-3 py-2 md:px-4 md:py-3 gap-2"
      style={{
        backgroundColor: 'var(--riichi-bg)',
        borderColor: 'var(--riichi-table)',
        color: 'var(--riichi-text)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2 md:gap-4">
        <Link to="/" className="opacity-80 hover:opacity-100 text-sm shrink-0">
          ← {homeLabel}
        </Link>
        <button
          type="button"
          onClick={onBackToRules}
          className="opacity-80 hover:opacity-100 text-sm shrink-0"
        >
          ← {returnRulesLabel}
        </button>
        <span className="text-xs md:text-sm shrink-0">{roundText}</span>
        <span
          className="text-[11px] md:text-xs shrink-0 font-semibold"
          style={{ color: 'var(--riichi-accent)' }}
        >
          立直棒 {formatPoints(game.riichiPot)}
        </span>
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          <button
            type="button"
            onClick={onStart}
            className="rounded-lg border px-2.5 py-1 md:px-3 md:py-1.5 text-xs md:text-sm hover:opacity-90"
            style={{
              borderColor: 'var(--riichi-border)',
              color: 'var(--riichi-text)',
              backgroundColor: 'transparent',
            }}
          >
            再来一局
          </button>
          {historyLength > 0 && (
            <button
              type="button"
              onClick={onUndo}
              className="rounded-lg border border-amber-600/70 px-2.5 py-1 md:px-3 md:py-1.5 text-xs md:text-sm text-amber-200 hover:bg-amber-900/30"
              title="回退一步（便于排查问题）"
            >
              回退
            </button>
          )}
          <button
            type="button"
            onClick={onOpenGuide}
            className="rounded-lg border border-[#457b9d]/60 px-2.5 py-1 md:px-3 md:py-1.5 text-xs md:text-sm text-[#a8dadc] hover:bg-[#457b9d]/20"
            aria-label="新手引导"
          >
            新手引导
          </button>
          <button
            type="button"
            onClick={onToggleLog}
            className="rounded-lg border border-slate-500/60 px-2.5 py-1 md:px-3 md:py-1.5 text-xs md:text-sm text-slate-300 hover:bg-slate-700/30"
          >
            {logOpen ? '收起日志' : '日志'}
          </button>
          <span className="text-[10px] opacity-70 mx-0.5">主题</span>
          {RIICHI_THEMES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onThemeChange(id)}
              className={cn(
                'rounded px-2 py-0.5 text-[11px] border',
                theme === id ? 'font-semibold' : 'opacity-70 hover:opacity-100',
              )}
              style={{
                borderColor:
                  theme === id
                    ? 'var(--riichi-accent)'
                    : 'var(--riichi-border)',
                color:
                  theme === id ? 'var(--riichi-accent)' : 'var(--riichi-text)',
                backgroundColor:
                  theme === id ? 'var(--riichi-accent-soft)' : 'transparent',
              }}
              aria-pressed={theme === id}
              aria-label={`主题 ${label}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* 小屏：宝牌折叠，点击展开 */}
      <details className="md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-center gap-1 text-[10px] opacity-80 [&::-webkit-details-marker]:hidden">
          <span>宝牌</span>
          <span
            className="font-semibold"
            style={{ color: 'var(--riichi-accent)' }}
          >
            ×{game.doraIndicators.length}
          </span>
          <span aria-hidden>▼</span>
        </summary>
        <div className="flex flex-wrap justify-center gap-0.5 mt-1">
          {game.doraIndicators.map((ind, i) => (
            <span
              key={i}
              className={cn(
                'w-9 h-12 rounded-[4px] border-2 bg-[#fff9e6] flex items-center justify-center font-black text-xs shrink-0',
                getTileColorClass(ind),
              )}
            >
              <RiichiTileFace tile={ind} />
            </span>
          ))}
        </div>
      </details>
      {/* 大屏：宝牌直接显示 */}
      <div className="hidden md:flex flex-col items-center gap-1">
        <span className="text-[10px] opacity-80">宝牌表示</span>
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
