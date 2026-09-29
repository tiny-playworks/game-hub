import {
  BookOpen,
  ChevronLeft,
  Menu,
  Palette,
  RotateCcw,
  ScrollText,
  Undo2,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { RIICHI_THEMES, type RiichiThemeId } from '../constants';
import { formatPoints, toTileKeyedItems } from '../helpers';
import type { RiichiGameState } from '../types';
import { RiichiSettingsPanel } from './RiichiSettingsPanel';
import { RiichiTile } from './Tile';

type Props = {
  game: RiichiGameState;
  historyLength: number;
  onStart: () => void;
  onUndo: () => void;
  onOpenLog: () => void;
  onBackToRules: () => void;
  returnRulesLabel: string;
  theme: RiichiThemeId;
  onThemeChange: (theme: RiichiThemeId) => void;
  onOpenGuide: () => void;
  onOpenReplay: () => void;
};

export function GameHeader({
  game,
  historyLength,
  onStart,
  onUndo,
  onOpenLog,
  onBackToRules,
  returnRulesLabel,
  theme,
  onThemeChange,
  onOpenGuide,
  onOpenReplay,
}: Props) {
  const { locale, t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const themeContainer =
    typeof document === 'undefined'
      ? undefined
      : document.querySelector<HTMLElement>('[data-riichi-theme]');
  const roundText = formatMessage(locale, 'game.mahjong.roundTextFormat', {
    wind: t(`game.mahjong.winds.${game.roundWind}`),
    round: game.roundNumber,
    honba: game.honba,
    dealer: t(`game.mahjong.seats.${game.dealer}`),
  });

  const closeAnd = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  return (
    <header className="riichi-app-header">
      <button
        type="button"
        onClick={onBackToRules}
        className="riichi-header-back"
      >
        <ChevronLeft aria-hidden="true" size={20} />
        {returnRulesLabel}
      </button>

      <div className="riichi-header-round">
        <strong>{roundText}</strong>
        <span>
          {t('game.mahjong.riichiStick')} {formatPoints(game.riichiPot, locale)}
        </span>
      </div>

      <div className="riichi-header-actions">
        <div className="riichi-header-dora">
          <span>{t('game.mahjong.dora')}</span>
          <div>
            {toTileKeyedItems(game.doraIndicators, 'header-dora').map(
              ({ tile, key }) => (
                <RiichiTile key={key} tile={tile} variant="indicator" />
              ),
            )}
          </div>
        </div>
        <button
          ref={menuTriggerRef}
          type="button"
          onClick={() => setMenuOpen(true)}
          className="riichi-header-menu"
          aria-label={t('game.mahjong.openMenu')}
        >
          <Menu aria-hidden="true" size={19} />
          {t('game.mahjong.menu')}
        </button>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogContent
            container={themeContainer}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              menuTriggerRef.current?.focus();
            }}
            showCloseButton={false}
            className="riichi-menu-drawer !max-w-none"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              left: 'auto',
              height: '100vh',
              transform: 'none',
              margin: 0,
            }}
            aria-describedby={undefined}
          >
            <header>
              <div>
                <p>{t('riichi.menu.kicker')}</p>
                <DialogTitle asChild>
                  <h2>{t('game.mahjong.gameMenu')}</h2>
                </DialogTitle>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t('game.mahjong.close')}
              >
                <X aria-hidden="true" size={21} />
              </button>
            </header>

            <div className="riichi-menu-list">
              <button type="button" onClick={() => closeAnd(onStart)}>
                <RotateCcw aria-hidden="true" size={18} />
                <span>
                  <strong>{t('riichi.modal.matchEnd.playAgain')}</strong>
                  <small>{t('riichi.menu.restartDetail')}</small>
                </span>
              </button>
              <button type="button" onClick={() => closeAnd(onOpenGuide)}>
                <BookOpen aria-hidden="true" size={18} />
                <span>
                  <strong>{t('riichi.guide.title')}</strong>
                  <small>{t('riichi.menu.guideDetail')}</small>
                </span>
              </button>
              <button type="button" onClick={() => closeAnd(onBackToRules)}>
                <ChevronLeft aria-hidden="true" size={18} />
                <span>
                  <strong>{returnRulesLabel}</strong>
                  <small>{t('riichi.menu.rulesDetail')}</small>
                </span>
              </button>
              {historyLength > 0 && (
                <button type="button" onClick={() => closeAnd(onUndo)}>
                  <Undo2 aria-hidden="true" size={18} />
                  <span>
                    <strong>{t('game.mahjong.undo')}</strong>
                    <small>{t('game.mahjong.undoTooltip')}</small>
                  </span>
                </button>
              )}
              <button type="button" onClick={() => closeAnd(onOpenLog)}>
                <ScrollText aria-hidden="true" size={18} />
                <span>
                  <strong>{t('riichi.rail.log')}</strong>
                  <small>{t('riichi.menu.logDetail')}</small>
                </span>
              </button>
              <button type="button" onClick={() => closeAnd(onOpenReplay)}>
                <ScrollText aria-hidden="true" size={18} />
                <span>
                  <strong>{t('riichi.replay.open')}</strong>
                  <small>{t('riichi.replay.export')}</small>
                </span>
              </button>
            </div>

            <RiichiSettingsPanel />

            <section className="riichi-menu-theme">
              <div className="riichi-menu-section-title">
                <Palette aria-hidden="true" size={17} />
                <span>{t('game.mahjong.theme')}</span>
              </div>
              <div className="riichi-theme-options">
                {RIICHI_THEMES.map(({ id }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onThemeChange(id)}
                    className={cn(theme === id && 'is-active')}
                    aria-pressed={theme === id}
                  >
                    <span className={`riichi-theme-swatch is-${id}`} />
                    {t(`game.mahjong.themes.${id}`)}
                  </button>
                ))}
              </div>
            </section>
          </DialogContent>
      </Dialog>
    </header>
  );
}
