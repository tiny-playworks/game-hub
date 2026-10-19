import { Award, Crown, LockKeyhole, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { games } from '@/data/games';
import { difficultyLabelKey, normalizeArcadeDifficulty } from '@/lib/arcade';
import { fetchMyChampions } from '@/lib/household/api';
import { formatMessage } from '@/lib/i18n';
import type { WeeklyChampionBadge } from '../../../shared/contracts/leaderboard';

export function WeeklyChampionsCard() {
  const { t, locale } = useLocale();
  const household = useOptionalHousehold();
  const isOnlineMember = Boolean(
    household?.currentMember && household?.isServerAvailable,
  );
  const [badges, setBadges] = useState<WeeklyChampionBadge[]>([]);

  useEffect(() => {
    if (!isOnlineMember) {
      setBadges([]);
      return;
    }
    let cancelled = false;
    fetchMyChampions()
      .then((res) => {
        if (!cancelled) setBadges(res.badges);
      })
      .catch(() => {
        if (!cancelled) setBadges([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOnlineMember, household?.snapshot?.revision]);

  return (
    <section
      data-testid="profile-weekly-champions"
      className="paper-texture rounded-3xl border border-border bg-card p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Award className="size-4 text-gold" />
            {t('leaderboard.champions.title')}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t('leaderboard.champions.subtitle')}
          </p>
        </div>
        {isOnlineMember && (
          <Link
            to="/leaderboard"
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            {t('venue.nav.leaderboard')}
          </Link>
        )}
      </div>

      {!isOnlineMember ? (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <LockKeyhole className="size-4 shrink-0 text-gold" />
          <span>{t('leaderboard.memberOnly.title')}</span>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2 rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs">
            <Crown className="size-4 shrink-0 text-gold" />
            <span className="font-semibold text-foreground">
              {badges.length > 0
                ? formatMessage(locale, 'leaderboard.champions.honorTitle', {
                    count: badges.length,
                  })
                : t('leaderboard.champions.noHonorTitle')}
            </span>
          </div>

          {badges.length === 0 ? (
            <p className="text-xs leading-5 text-muted-foreground">
              {t('leaderboard.champions.empty')}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {badges.map((badge) => {
                const game = games.find((g) => g.id === badge.gameId);
                const unitLabel = t(
                  game?.bestMetric === 'wins'
                    ? 'arcade.unit.streak'
                    : (game?.bestUnitKey ?? 'arcade.unit.points'),
                );
                const diff = normalizeArcadeDifficulty(
                  badge.gameId,
                  badge.difficulty,
                );
                return (
                  <li
                    key={`${badge.weekId}:${badge.gameId}:${badge.difficulty}`}
                    data-testid={`champion-badge-${badge.weekId}-${badge.gameId}`}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-background px-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {t(`game.${badge.gameId}.name`)} ·{' '}
                        {t(difficultyLabelKey(badge.gameId, diff))}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        {formatMessage(locale, 'leaderboard.champions.badgeWeek', {
                          weekId: badge.weekId,
                        })}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 font-semibold tabular-nums text-foreground">
                      <Trophy className="size-3 text-gold" />
                      {badge.value} {unitLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
