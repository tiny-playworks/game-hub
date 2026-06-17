import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QuickAccessPanel } from '@/components/home/QuickAccessPanel';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { RIICHI_THEMES, type RiichiThemeId } from '../constants';
import { formatPoints, toTileKeyedItems } from '../helpers';
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
  const { locale, t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const roundText = formatMessage(locale, 'game.mahjong.roundTextFormat', {
    wind: t(`game.mahjong.winds.${game.roundWind}`),
    round: game.roundNumber,
    honba: game.honba,
    dealer: t(`game.mahjong.seats.${game.dealer}`),
  });

  return (
    <header className="riichi-app-header flex items-center justify-between border-b px-3 py-2 gap-2">
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
          {t('game.mahjong.riichiStick')} {formatPoints(game.riichiPot)}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <QuickAccessPanel compact className="hidden md:flex" />
        <div className="hidden md:flex items-center gap-1">
          <span className="text-[10px] opacity-80">
            {t('game.mahjong.dora')}
          </span>
          {toTileKeyedItems(game.doraIndicators, 'header-dora').map(
            ({ tile, key }) => (
              <span
                key={key}
                className={cn(
                  'w-8 h-11 rounded-[4px] border-2 bg-[#fff9e6] flex items-center justify-center font-black text-xs shrink-0',
                  getTileColorClass(tile),
                )}
              >
                <RiichiTileFace tile={tile} />
              </span>
            ),
          )}
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
          aria-label={t('game.mahjong.openMenu')}
        >
          {t('game.mahjong.menu')}
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => setMenuOpen(false)}
            aria-label={t('game.mahjong.closeMenu')}
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
              <p className="text-sm font-semibold">
                {t('game.mahjong.gameMenu')}
              </p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="text-xs opacity-80 hover:opacity-100"
              >
                {t('game.mahjong.close')}
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
                {t('riichi.modal.matchEnd.playAgain')}
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
                {t('common.beginnerGuide')}
              </button>
            </div>

            <div className="mb-4 border-t pt-2 md:hidden">
              <p className="text-xs opacity-75 mb-2">
                {t('game.mahjong.quickAccess')}
              </p>
              <QuickAccessPanel compact className="w-full" />
            </div>

            <div className="mb-4">
              <p className="text-xs opacity-75 mb-2">
                {t('game.mahjong.theme')}
              </p>
              <div className="flex flex-wrap gap-2">
                {RIICHI_THEMES.map(({ id }) => (
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
                    {t(`game.mahjong.themes.${id}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs opacity-75 mb-2">
                {t('game.mahjong.debug')}
              </p>
              <div className="space-y-2">
                {historyLength > 0 && (
                  <button
                    type="button"
                    onClick={onUndo}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-left hover:opacity-90"
                    style={{ borderColor: 'var(--riichi-border)' }}
                    title={t('game.mahjong.undoTooltip')}
                  >
                    {t('game.mahjong.undo')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleLog}
                  className="w-full rounded-lg border px-3 py-2 text-sm text-left hover:opacity-90"
                  style={{ borderColor: 'var(--riichi-border)' }}
                >
                  {logOpen
                    ? t('game.mahjong.hideLog')
                    : t('game.mahjong.showLog')}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
