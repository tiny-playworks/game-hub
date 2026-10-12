import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '@/contexts/LocaleContext';
import { useRankedState } from '@/hooks/useRankedState';
import type { MatchLength } from '@/lib/ranked';
import { RankBadge, RankProgress } from './RankBadge';
import { RankedStartButton } from './RankedStartButton';

export function RankedLobbyCard() {
  const { t } = useLocale();
  const rank = useRankedState();
  const [length, setLength] = useState<MatchLength>('east');
  return (
    <article className="ranked-lobby venue-ranked">
      <div className="venue-mode-heading">
        <span className="venue-mode-tile" aria-hidden="true">
          東
        </span>
        <div>
          <h2>{t('lobby.rankedLabel')}</h2>
          <p>{t('ranked.description')}</p>
        </div>
      </div>
      <div className="venue-rank-summary">
        <RankBadge rank={rank} large />
        <RankProgress rank={rank} />
      </div>
      <fieldset
        className="ranked-length"
        aria-label={t('riichi.lobby.matchLength')}
      >
        {(['east', 'south'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={length === value}
            onClick={() => setLength(value)}
          >
            {t(`ranked.length.${value}`)}
          </button>
        ))}
      </fieldset>
      <RankedStartButton matchLength={length} />
      {rank.activeMatchId && (
        <Link
          className="venue-ranked-resume"
          to="/game/mahjong-japanese?resume=1"
        >
          {t('ranked.resume')}
        </Link>
      )}
    </article>
  );
}
