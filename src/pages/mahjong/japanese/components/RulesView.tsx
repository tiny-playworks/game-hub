import { BookOpen, Check, ChevronLeft, Play, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';
import { RIICHI_THEMES, type RiichiThemeId } from '../constants';
import { GuidePanel } from './GuidePanel';
import { RiichiSettingsPanel } from './RiichiSettingsPanel';

type MatchLength = 'east' | 'south';

type Props = {
  matchLength: MatchLength;
  onMatchLengthChange: (value: MatchLength) => void;
  theme: RiichiThemeId;
  onThemeChange: (theme: RiichiThemeId) => void;
  onStart: () => void;
  loadError: boolean;
  hasSaved: boolean;
  hasReplay: boolean;
  onResume: () => void;
  onOpenReplay: () => void;
  onImportReplay: (file: File) => Promise<boolean>;
};

export function RulesView({
  matchLength,
  onMatchLengthChange,
  theme,
  onThemeChange,
  onStart,
  loadError,
  hasSaved,
  hasReplay,
  onResume,
  onOpenReplay,
  onImportReplay,
}: Props) {
  const { t } = useLocale();
  const [guideOpen, setGuideOpen] = useState(false);
  const guideTriggerRef = useRef<HTMLButtonElement>(null);
  const [importError, setImportError] = useState(false);
  const themeContainer =
    typeof document === 'undefined'
      ? undefined
      : document.querySelector<HTMLElement>('[data-riichi-theme]');

  return (
    <div className="riichi-lobby">
      <header className="riichi-lobby-header">
        <Link to="/">
          <ChevronLeft aria-hidden="true" size={20} />
          {t('common.backHome')}
        </Link>
        <span>TINY GAME HUB · RIICHI</span>
      </header>

      <main className="riichi-lobby-main">
        <section className="riichi-lobby-intro">
          <div className="riichi-lobby-badge">
            <span>DESKTOP BETA</span>
            <i />
            {t('riichi.lobby.badge')}
          </div>
          <p className="riichi-lobby-kicker">RIICHI PRACTICE TABLE</p>
          <h1>{t('riichi.lobby.title')}</h1>
          <p className="riichi-lobby-lead">{t('riichi.lobby.lead')}</p>

          <div className="riichi-lobby-capabilities">
            <span>
              <Check aria-hidden="true" size={16} />
              {t('riichi.lobby.fourPlayers')}
            </span>
            <span>
              <Check aria-hidden="true" size={16} />
              {t('riichi.lobby.rules')}
            </span>
            <span>
              <Check aria-hidden="true" size={16} />
              {t('riichi.lobby.hints')}
            </span>
            <span>
              <Check aria-hidden="true" size={16} />
              {t('riichi.lobby.offline')}
            </span>
          </div>

          <button
            ref={guideTriggerRef}
            type="button"
            className="riichi-lobby-guide-button"
            onClick={() => setGuideOpen(true)}
          >
            <BookOpen aria-hidden="true" size={18} />
            {t('riichi.guide.title')}
          </button>
        </section>

        <section
          className="riichi-lobby-setup"
          aria-label={t('riichi.lobby.setup')}
        >
          <div className="riichi-lobby-setup-heading">
            <span>TABLE SETUP</span>
            <h2>{t('riichi.lobby.ready')}</h2>
            <p>{t('riichi.lobby.localSettings')}</p>
          </div>

          <fieldset>
            <legend>{t('riichi.lobby.matchLength')}</legend>
            <div className="riichi-match-options">
              {(['east', 'south'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn(matchLength === value && 'is-active')}
                  onClick={() => onMatchLengthChange(value)}
                  aria-pressed={matchLength === value}
                >
                  <strong>{t(`riichi.lobby.${value}`)}</strong>
                  <span>{t(`riichi.lobby.${value}Range`)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <RiichiSettingsPanel />

          {(hasSaved || hasReplay) && (
            <div className="riichi-lobby-secondary-actions">
              {hasSaved && (
                <button type="button" onClick={onResume}>
                  {t('riichi.resume')}
                </button>
              )}
              {hasReplay && (
                <button type="button" onClick={onOpenReplay}>
                  {t('riichi.replay.open')}
                </button>
              )}
            </div>
          )}
          <label className="riichi-lobby-import">
            {t('riichi.replay.import')}
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) setImportError(!(await onImportReplay(file)));
                event.target.value = '';
              }}
            />
          </label>
          {importError && <p role="alert">{t('riichi.replay.invalid')}</p>}

          <fieldset>
            <legend>{t('riichi.lobby.theme')}</legend>
            <div className="riichi-lobby-themes">
              {RIICHI_THEMES.map(({ id }) => (
                <button
                  key={id}
                  type="button"
                  className={cn(theme === id && 'is-active')}
                  onClick={() => onThemeChange(id)}
                  aria-pressed={theme === id}
                >
                  <span className={`riichi-theme-preview is-${id}`}>
                    <i />
                  </span>
                  <strong>{t(`game.mahjong.themes.${id}`)}</strong>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="riichi-lobby-assurance">
            <ShieldCheck aria-hidden="true" size={19} />
            <span>{t('riichi.lobby.privacy')}</span>
          </div>
          {loadError && <p role="alert">{t('riichi.loadError')}</p>}

          <button
            type="button"
            className="riichi-lobby-start"
            onClick={onStart}
          >
            <span>
              <strong>{t('common.startGame')}</strong>
              <small>
                {t(`riichi.lobby.${matchLength}`)} ·{' '}
                {t('riichi.lobby.fourPlayers')}
              </small>
            </span>
            <Play aria-hidden="true" size={20} fill="currentColor" />
          </button>
        </section>
      </main>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent
          container={themeContainer}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            guideTriggerRef.current?.focus();
          }}
          className="riichi-guide-dialog-content !w-[min(1120px,calc(100vw-40px))] !max-w-none"
          showCloseButton={false}
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            {t('riichi.guide.title')}
          </DialogTitle>
          <GuidePanel onClose={() => setGuideOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
