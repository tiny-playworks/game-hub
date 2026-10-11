import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { getCharacterById } from '@/lib/playerCharacters';
import type { RankedHistoryEntry } from '@/lib/ranked';
import { MatchReviewButton } from '@/pages/mahjong/japanese/components/MatchReview';
import {
  discardSavedMatch,
  useRiichiStore,
} from '@/pages/mahjong/japanese/store/riichiMatchStore';
import { RankBadge, RankProgress } from './RankBadge';
import { RankedStartButton } from './RankedStartButton';
export function RankedResult({ result }: { result: RankedHistoryEntry }) {
  const { locale, t } = useLocale();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const value = Math.min(1, (now - start) / 900);
      setProgress(value);
      if (value < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);
  const rank =
    progress < 1
      ? {
          ...result.before,
          pt: Math.max(
            0,
            Math.round(
              result.before.pt +
                (result.change === 'up'
                  ? Math.abs(result.ptDelta)
                  : result.ptDelta) *
                  progress,
            ),
          ),
        }
      : result.after;
  const placement = (n: number) =>
    formatMessage(locale, 'ranked.placement', { n });
  return (
    <main className="ranked-result" aria-label={t('ranked.result')}>
      <p className="ranked-eyebrow">{t('ranked.result')}</p>
      <h1>{placement(result.placement)}</h1>
      <div className="ranked-result-players">
        {result.ranking.map((seat, index) => {
          const character = getCharacterById(
            seat === 0 ? result.characterId : result.opponents[seat - 1],
          );
          return (
            <article key={seat} data-player={seat === 0}>
              <span>
                {placement(index + 1)}
                {seat === 0 ? ` · ${t('ranked.you')}` : ''}
              </span>
              <CharacterPortraitSlot
                character={character}
                size="xl"
                expression={
                  index === 0 ? 'happy' : index === 3 ? 'frustrated' : 'normal'
                }
                label={t(character.nameKey)}
              />
              <h2>{t(character.nameKey)}</h2>
              <strong>{result.finalScores[seat].toLocaleString()}</strong>
            </article>
          );
        })}
      </div>
      <section
        className="ranked-result-points"
        data-change={progress === 1 ? result.change : undefined}
      >
        <RankBadge rank={rank} />
        <strong className="ranked-delta">
          {result.ptDelta > 0 ? '+' : ''}
          {Math.round(result.ptDelta * progress)} pt
        </strong>
        <RankProgress rank={rank} />
        {result.change && progress === 1 && (
          <p role="status" className="ranked-change">
            {t(`ranked.${result.change}`)} ·{' '}
            {formatMessage(locale, 'ranked.rankName', {
              band: t(`character.rank.${result.after.band}`),
              level: result.after.level,
            })}
          </p>
        )}
      </section>
      <div className="ranked-rewards">
        <span>
          +{result.coins} {t('wallet.coins')}{' '}
          <small>{t('ranked.coinBonus')}</small>
        </span>
        <span>
          {t('profile.companion.affinityLabel')} +{result.affinityDelta}
        </span>
      </div>
      {result.unlocked.length > 0 && (
        <aside role="status" className="ranked-unlocks">
          <strong>{t('ranked.unlocked')}</strong>
          <span>
            {result.unlocked
              .map((id) => t(getCharacterById(id).nameKey))
              .join(' · ')}
          </span>
        </aside>
      )}
      <div className="ranked-result-actions">
        <MatchReviewButton matchId={result.id} />
        <RankedStartButton matchLength={result.matchLength} again />
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            discardSavedMatch();
            useRiichiStore.getState().setView('rules');
            navigate('/');
          }}
        >
          {t('common.backHome')}
        </Button>
      </div>
    </main>
  );
}
