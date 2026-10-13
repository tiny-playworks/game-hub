import { Check, HelpCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { getTileLabel } from '@/lib/mahjongRiichi';
import { subscribeRiichiEffects } from '../store/riichiMatchStore';
import type { RiichiSound } from '../engine';
import '../table-feedback.css';

const NOVICE_GUIDE_STORAGE_KEY = 'game-hub-riichi-novice-guide-dismissed';

export type SelectedTileBarProps = {
  selectedTile: number | null;
  canDiscard: boolean;
  riichiSelecting: boolean;
  onConfirmDiscard: () => void;
  onCancelSelection: () => void;
};

export function SelectedTileBar({
  selectedTile,
  canDiscard,
  riichiSelecting,
  onConfirmDiscard,
  onCancelSelection,
}: SelectedTileBarProps) {
  const { t, locale } = useLocale();

  if (selectedTile === null || !canDiscard) return null;

  const tileName = getTileLabel(selectedTile, locale);

  return (
    <div
      className="riichi-selected-action-bar"
      role="region"
      aria-label={t('riichi.action.available')}
    >
      <div className="riichi-selected-info">
        <span>{formatMessage(locale, 'riichi.action.selectedTile', { tile: tileName })}</span>
      </div>
      <div className="riichi-selected-actions">
        <button
          type="button"
          className="riichi-confirm-discard-btn"
          onClick={onConfirmDiscard}
          aria-label={t(
            riichiSelecting
              ? 'riichi.action.riichiConfirm'
              : 'riichi.action.discardConfirm',
          )}
        >
          <Check size={16} aria-hidden="true" />
          <span>
            {t(
              riichiSelecting
                ? 'riichi.action.riichiConfirm'
                : 'riichi.action.discardConfirm',
            )}
          </span>
          <span className="riichi-confirm-shortcut-hint">
            (Enter)
          </span>
        </button>
        <button
          type="button"
          className="riichi-cancel-select-btn"
          onClick={onCancelSelection}
          aria-label={t('riichi.action.cancelSelection')}
        >
          <X size={15} aria-hidden="true" />
          <span>{t('riichi.action.cancelSelection')}</span>
          <span className="riichi-confirm-shortcut-hint">
            (Esc)
          </span>
        </button>
      </div>
    </div>
  );
}

export function TableActionToast() {
  const { t } = useLocale();
  const [activeToast, setActiveToast] = useState<{
    id: number;
    label: string;
    kind: string;
  } | null>(null);

  useEffect(() => {
    let timer: number | null = null;
    const soundToLabel: Partial<Record<RiichiSound, { key: string; kind: string }>> = {
      riichi: { key: 'riichi.state.riichi', kind: 'is-riichi' },
      chi: { key: 'riichi.chi', kind: 'is-chi' },
      pon: { key: 'riichi.peng', kind: 'is-pon' },
      kan: { key: 'riichi.mingang', kind: 'is-kan' },
      tsumo: { key: 'riichi.tsumo', kind: 'is-tsumo' },
      ron: { key: 'riichi.ron', kind: 'is-ron' },
      ryuukyoku: { key: 'riichi.state.roundFinished', kind: 'is-draw' },
    };

    return subscribeRiichiEffects((effects) => {
      for (const effect of effects) {
        if (effect.type === 'sound') {
          const config = soundToLabel[effect.sound];
          if (config) {
            if (timer) window.clearTimeout(timer);
            setActiveToast({
              id: Date.now(),
              label: t(config.key),
              kind: config.kind,
            });
            timer = window.setTimeout(() => {
              setActiveToast(null);
            }, 1100);
            break;
          }
        }
      }
    });
  }, [t]);

  if (!activeToast) return null;

  return (
    <div className="riichi-action-toast-overlay" role="status" aria-live="polite">
      <div className={`riichi-action-toast-badge ${activeToast.kind}`}>
        {activeToast.label}
      </div>
    </div>
  );
}

export function NoviceControlsGuide() {
  const { t } = useLocale();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NOVICE_GUIDE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(NOVICE_GUIDE_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div
      className="riichi-novice-guide-card"
      role="region"
      aria-label={t('riichi.noviceHint.title')}
    >
      <div className="riichi-novice-guide-header">
        <div className="riichi-novice-guide-title">
          <HelpCircle size={16} aria-hidden="true" />
          <strong>{t('riichi.noviceHint.title')}</strong>
        </div>
      </div>
      <div className="riichi-novice-guide-body">
        <p>{t('riichi.noviceHint.content')}</p>
        <p className="mt-1 opacity-80">{t('riichi.noviceHint.danger')}</p>
      </div>
      <div className="riichi-novice-guide-footer">
        <button
          type="button"
          className="riichi-novice-guide-dismiss"
          onClick={handleDismiss}
        >
          {t('riichi.noviceHint.dismiss')}
        </button>
      </div>
    </div>
  );
}
