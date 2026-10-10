import { Info, Sparkles } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { getBaseTile, getTileLabel } from '@/lib/mahjongRiichi';
import type { TrainingAdvice } from '../trainingAdvice';
import type { TenpaiHint } from '../useRiichiViewModel';
import { RiichiTile } from './Tile';

type Props = {
  advice: TrainingAdvice;
  hint: TenpaiHint | null;
  dangerEnabled: boolean;
  onPreview: (base: number | null) => void;
};

export function TrainingPanel({
  advice,
  hint,
  dangerEnabled,
  onPreview,
}: Props) {
  const { t, locale } = useLocale();
  const shantenLabel = (shanten: number) =>
    shanten < 0
      ? t('riichi.training.complete')
      : shanten === 0
        ? t('riichi.training.tenpai')
        : formatMessage(locale, 'riichi.training.shanten', { count: shanten });
  const waits = (tiles: number[]) => (
    <div className="riichi-wait-list">
      {tiles.map((tile) => (
        <div className="riichi-wait-item" key={tile}>
          <RiichiTile tile={tile} variant="indicator" />
          <span>
            {formatMessage(locale, 'riichi.hint.remaining', {
              count: advice?.remaining(tile) ?? 0,
            })}
          </span>
        </div>
      ))}
    </div>
  );

  if (!advice)
    return (
      <div className="riichi-panel-empty">
        <Info aria-hidden="true" size={22} />
        <strong>{t('riichi.training.roundEnded')}</strong>
        <p>{t('riichi.training.nextRound')}</p>
      </div>
    );

  return (
    <div className="riichi-training-panel">
      <div className="riichi-training-summary">
        <div>
          <span>
            {t(
              advice.candidates.length
                ? 'riichi.training.afterDiscard'
                : 'riichi.training.handProgress',
            )}
          </span>
          <strong>{shantenLabel(advice.shanten)}</strong>
        </div>
        <div>
          <span>
            {t(
              advice.shanten === 0
                ? 'riichi.training.waitCount'
                : 'riichi.training.ukeire',
            )}
          </span>
          <strong>
            {advice.ukeire}
            <small>{t('riichi.training.tiles')}</small>
          </strong>
        </div>
      </div>
      {advice.candidates.length > 0 ? (
        <>
          <p className="riichi-training-heading">
            <Sparkles size={14} aria-hidden="true" />
            {t(
              advice.locked
                ? 'riichi.training.locked'
                : 'riichi.training.choices',
            )}
          </p>
          <p className="riichi-training-note">
            {t(
              advice.locked
                ? 'riichi.training.lockedDesc'
                : 'riichi.training.efficiencyNote',
            )}
          </p>
          <div className="riichi-training-choices">
            {advice.candidates.map((candidate, rank) => {
              const ronLine =
                hint?.kind === 'discard'
                  ? hint.options.find(
                      (option) =>
                        getBaseTile(option.discardTile) ===
                        getBaseTile(candidate.tile),
                    )?.line
                  : null;
              const risk =
                candidate.danger === null
                  ? null
                  : candidate.danger < 0.2
                    ? 'low'
                    : candidate.danger < 0.8
                      ? 'medium'
                      : 'high';
              return (
                <article
                  className={`riichi-training-choice${rank === 0 ? ' riichi-training-choice--best' : ''}`}
                  key={candidate.tile}
                >
                  <div className="riichi-training-choice-top">
                    <button
                      type="button"
                      className="riichi-training-preview"
                      onPointerEnter={() =>
                        onPreview(getBaseTile(candidate.tile))
                      }
                      onPointerLeave={() => onPreview(null)}
                      onFocus={() => onPreview(getBaseTile(candidate.tile))}
                      onBlur={() => onPreview(null)}
                      onClick={() => onPreview(getBaseTile(candidate.tile))}
                      aria-label={formatMessage(
                        locale,
                        'riichi.training.locate',
                        { tile: getTileLabel(candidate.tile, locale) },
                      )}
                    >
                      <span>
                        {rank === 0
                          ? t('riichi.training.preferred')
                          : `0${rank + 1}`}
                      </span>
                      <RiichiTile tile={candidate.tile} variant="indicator" />
                    </button>
                    <div className="riichi-training-choice-stats">
                      <strong>{shantenLabel(candidate.shanten)}</strong>
                      <span>
                        {formatMessage(locale, 'riichi.training.ukeireCount', {
                          count: candidate.ukeire,
                        })}
                      </span>
                      {dangerEnabled && risk && (
                        <small
                          className={`riichi-training-risk riichi-training-risk--${risk}`}
                        >
                          {t(`riichi.training.risk.${risk}`)}
                        </small>
                      )}
                    </div>
                  </div>
                  <details className="riichi-training-effective">
                    <summary>
                      {t(
                        candidate.shanten === 0
                          ? 'riichi.hint.currentWaits'
                          : 'riichi.training.effective',
                      )}
                      <span>
                        {formatMessage(locale, 'riichi.training.types', {
                          count: candidate.effectiveTiles.length,
                        })}
                      </span>
                    </summary>
                    {waits(candidate.effectiveTiles)}
                    {ronLine && <p className="riichi-hint-line">{ronLine}</p>}
                  </details>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <section className="riichi-training-current">
          <p className="riichi-training-heading">
            {t(
              hint?.kind === 'current'
                ? 'riichi.hint.currentWaits'
                : 'riichi.training.effective',
            )}
          </p>
          {waits(advice.effectiveTiles)}
          {hint?.kind === 'current' && (
            <p className="riichi-hint-line">{hint.line}</p>
          )}
          <p className="riichi-training-note">
            {t('riichi.training.waitTurn')}
          </p>
        </section>
      )}
      <p className="riichi-training-footnote">
        {t('riichi.training.visibleNote')}
      </p>
    </div>
  );
}
