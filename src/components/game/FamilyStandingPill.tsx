import { Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { games } from '@/data/games';
import { type ArcadeDifficulty, normalizeArcadeDifficulty } from '@/lib/arcade';
import { fetchLeaderboard } from '@/lib/household/api';
import { formatMessage } from '@/lib/i18n';
import type {
  LeaderboardEntry,
  LeaderboardStanding,
} from '../../../shared/contracts/leaderboard';

function deriveRankAndGap(
  entries: LeaderboardEntry[],
  memberId: string,
): { rank: number | null; gap: number | null } {
  const index = entries.findIndex((entry) => entry.memberId === memberId);
  if (index < 0) return { rank: null, gap: null };
  const current = entries[index];
  if (index === 0) return { rank: current.rank, gap: null };
  const prev = entries[index - 1];
  return {
    rank: current.rank,
    gap: Math.abs(prev.value - current.value),
  };
}

export function FamilyStandingPill({
  gameId,
  difficulty = 'normal',
  standing,
}: {
  gameId: string;
  difficulty?: ArcadeDifficulty;
  standing?: LeaderboardStanding;
}) {
  const { t, locale } = useLocale();
  const household = useOptionalHousehold();
  const memberId = household?.currentMember?.id ?? null;
  const isOnlineMember = Boolean(
    memberId && household?.isServerAvailable,
  );
  const normalizedDiff = normalizeArcadeDifficulty(gameId, difficulty);
  const [fetched, setFetched] = useState<LeaderboardStanding | null>(null);

  useEffect(() => {
    if (!isOnlineMember || !memberId || gameId === 'mahjong-japanese') {
      setFetched(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchLeaderboard(gameId, normalizedDiff, 'all-time'),
      fetchLeaderboard(gameId, normalizedDiff, 'week'),
    ])
      .then(([allTime, week]) => {
        if (cancelled) return;
        const allTimeRes = deriveRankAndGap(allTime.entries, memberId);
        const weekRes = deriveRankAndGap(week.entries, memberId);
        setFetched({
          allTimeRank: allTimeRes.rank,
          weekRank: weekRes.rank,
          allTimeGapToPrevious: allTimeRes.gap,
          weekGapToPrevious: weekRes.gap,
          isFamilyRecord: false,
        });
      })
      .catch(() => {
        if (!cancelled) setFetched(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOnlineMember, memberId, gameId, normalizedDiff]);

  const game = games.find((item) => item.id === gameId);
  if (!isOnlineMember || !game || game.categoryId === 'mahjong') return null;

  const active = standing ?? fetched;
  const allTimeRank = active?.allTimeRank ?? null;
  const weekRank = active?.weekRank ?? null;
  const gap = active?.weekGapToPrevious ?? active?.allTimeGapToPrevious ?? null;
  const unitLabel = t(
    game.bestMetric === 'wins'
      ? 'arcade.unit.streak'
      : (game.bestUnitKey ?? 'arcade.unit.points'),
  );

  return (
    <Link
      to={`/leaderboard?game=${encodeURIComponent(gameId)}&difficulty=${encodeURIComponent(normalizedDiff)}`}
      data-family-standing={gameId}
      className="game-pill border-primary/35 bg-primary/10 text-xs transition hover:bg-primary/20"
      title={
        gap !== null && gap > 0
          ? formatMessage(locale, 'leaderboard.overlay.gapToPrev', {
              gap,
              unit: unitLabel,
            })
          : t('leaderboard.overlay.viewBoard')
      }
    >
      <Trophy className="size-3.5 text-gold" />
      {allTimeRank !== null || weekRank !== null ? (
        <span className="font-semibold text-foreground">
          {allTimeRank !== null
            ? formatMessage(locale, 'leaderboard.shell.allTimeRank', {
                rank: allTimeRank,
              })
            : null}
          {allTimeRank !== null && weekRank !== null ? ' · ' : null}
          {weekRank !== null
            ? formatMessage(locale, 'leaderboard.shell.weekRank', {
                rank: weekRank,
              })
            : null}
          {gap !== null && gap > 0 ? (
            <span className="ml-1 hidden text-muted-foreground md:inline">
              (
              {formatMessage(locale, 'leaderboard.overlay.gapToPrev', {
                gap,
                unit: unitLabel,
              })}
              )
            </span>
          ) : null}
        </span>
      ) : (
        <span className="font-medium text-foreground">
          {t('venue.nav.leaderboard')}
        </span>
      )}
    </Link>
  );
}
