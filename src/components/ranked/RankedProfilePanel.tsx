import { useLocale } from '@/contexts/LocaleContext';
import { useRankedState } from '@/hooks/useRankedState';
import { formatMessage } from '@/lib/i18n';
import { getCharacterById } from '@/lib/playerCharacters';
import { MatchReviewButton } from '@/pages/mahjong/japanese/components/MatchReview';
import { RankBadge, RankProgress } from './RankBadge';
export function RankedProfilePanel() {
  const { locale, t } = useLocale();
  const state = useRankedState();
  const history = state.history;
  const count = history.length;
  const distribution = [1, 2, 3, 4].map(
    (place) => history.filter((entry) => entry.placement === place).length,
  );
  const stats = [
    [
      'ranked.average',
      count
        ? (
            history.reduce((sum, entry) => sum + entry.placement, 0) / count
          ).toFixed(2)
        : '—',
    ],
    [
      'ranked.firstRate',
      count ? `${((distribution[0] / count) * 100).toFixed(1)}%` : '—',
    ],
    [
      'ranked.flyRate',
      count
        ? `${((history.filter((entry) => entry.finalScore < 0).length / count) * 100).toFixed(1)}%`
        : '—',
    ],
  ];
  return (
    <section className="ranked-profile paper-texture rounded-3xl border bg-card p-5 text-foreground">
      <h2 className="text-lg font-semibold">{t('ranked.profile')}</h2>
      <div className="ranked-profile-ranks">
        <div>
          <small>{t('ranked.current')}</small>
          <RankBadge rank={state} />
        </div>
        <div>
          <small>{t('ranked.peak')}</small>
          <RankBadge rank={state.peak} />
        </div>
      </div>
      <RankProgress rank={state} />
      <p className="mt-4 text-xs text-muted-foreground">
        {t('ranked.statsWindow')} · {count}
      </p>
      <div className="ranked-stats">
        {stats.map(([key, value]) => (
          <div key={key}>
            <small>{t(key)}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="ranked-distribution">
        {distribution.map((value, index) => (
          <div key={index + 1}>
            <span>
              {formatMessage(locale, 'ranked.placement', { n: index + 1 })}
            </span>
            <i style={{ width: `${count ? (value / count) * 100 : 0}%` }} />
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <h3 className="mt-5 font-medium">{t('ranked.recent')}</h3>
      {count === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('ranked.empty')}
        </p>
      ) : (
        <ol className="ranked-history">
          {history
            .slice(-20)
            .reverse()
            .map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>
                    {formatMessage(locale, 'ranked.placement', {
                      n: entry.placement,
                    })}
                  </strong>
                  <time>
                    {new Date(entry.at).toLocaleDateString(
                      locale === 'zh' ? 'zh-CN' : 'en-US',
                    )}
                  </time>
                  <span>{t(`ranked.length.${entry.matchLength}`)}</span>
                  <b data-positive={entry.ptDelta >= 0}>
                    {entry.ptDelta > 0 ? '+' : ''}
                    {entry.ptDelta} pt
                  </b>
                </div>
                <small>
                  {entry.finalScore.toLocaleString()} ·{' '}
                  {entry.opponents
                    .map((id) => t(getCharacterById(id).nameKey))
                    .join(' / ')}
                  {entry.forfeit ? ` · ${t('ranked.forfeit')}` : ''}
                </small>
                {!entry.forfeit && <MatchReviewButton matchId={entry.id} />}
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}
