import { useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const roundText = `${WIND_NAMES[game.roundWind]}${game.roundNumber}局 ${WIND_NAMES[game.roundWind]}${game.honba}场 · 庄 ${SEAT_NAMES[game.dealer]}`;

  return (
    <header
      className="flex items-center justify-between border-b px-3 py-2 md:px-4 md:py-3 gap-3"
      style={{
        backgroundColor: 'var(--riichi-bg)',
        borderColor: 'var(--riichi-table)',
        color: 'var(--riichi-text)',
      }}
    >
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
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
      </div>

      <div className="min-w-0 flex-1 text-center px-2">
        <p className="text-xs md:text-sm truncate">{roundText}</p>
        <p
          className="text-[11px] md:text-xs font-semibold"
          style={{ color: 'var(--riichi-accent)' }}
        >
          立直棒 {formatPoints(game.riichiPot)}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden md:flex items-center gap-1">
          <span className="text-[10px] opacity-80">宝牌</span>
          {game.doraIndicators.map((ind, i) => (
            <span
              key={i}
              className={cn(
                'w-8 h-11 rounded-[4px] border-2 bg-[#fff9e6] flex items-center justify-center font-black text-xs shrink-0',
                getTileColorClass(ind),
              )}
            >
              <RiichiTileFace tile={ind} />
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-lg border px-2.5 py-1 text-xs md:text-sm"
          style={{
            borderColor: 'var(--riichi-border)',
            color: 'var(--riichi-text)',
            backgroundColor: 'transparent',
          }}
          aria-label="打开菜单"
        >
          菜单
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => setMenuOpen(false)}
            aria-label="关闭菜单"
          />
          <aside
            className="absolute right-0 top-0 h-full w-[280px] border-l p-4 overflow-auto"
            style={{
              backgroundColor: 'var(--riichi-bg)',
              borderColor: 'var(--riichi-border)',
              color: 'var(--riichi-text)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">对局菜单</p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="text-xs opacity-80 hover:opacity-100"
              >
                关闭
              </button>
            </div>

            <div className="space-y-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  onStart();
                  setMenuOpen(false);
                }}
                className="w-full rounded-lg border px-3 py-2 text-sm text-left hover:opacity-90"
                style={{ borderColor: 'var(--riichi-border)' }}
              >
                再来一局
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenGuide();
                  setMenuOpen(false);
                }}
                className="w-full rounded-lg border px-3 py-2 text-sm text-left hover:opacity-90"
                style={{ borderColor: 'var(--riichi-border)' }}
              >
                新手引导
              </button>
            </div>

            <div className="mb-4">
              <p className="text-xs opacity-75 mb-2">主题</p>
              <div className="flex flex-wrap gap-2">
                {RIICHI_THEMES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onThemeChange(id)}
                    className={cn(
                      'rounded px-2 py-1 text-xs border',
                      theme === id
                        ? 'font-semibold'
                        : 'opacity-75 hover:opacity-100',
                    )}
                    style={{
                      borderColor:
                        theme === id
                          ? 'var(--riichi-accent)'
                          : 'var(--riichi-border)',
                      color:
                        theme === id
                          ? 'var(--riichi-accent)'
                          : 'var(--riichi-text)',
                      backgroundColor:
                        theme === id
                          ? 'var(--riichi-accent-soft)'
                          : 'transparent',
                    }}
                    aria-pressed={theme === id}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs opacity-75 mb-2">调试</p>
              <div className="space-y-2">
                {historyLength > 0 && (
                  <button
                    type="button"
                    onClick={onUndo}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-left hover:opacity-90"
                    style={{ borderColor: 'var(--riichi-border)' }}
                    title="回退一步（便于排查问题）"
                  >
                    回退一步
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleLog}
                  className="w-full rounded-lg border px-3 py-2 text-sm text-left hover:opacity-90"
                  style={{ borderColor: 'var(--riichi-border)' }}
                >
                  {logOpen ? '收起日志' : '查看日志'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
