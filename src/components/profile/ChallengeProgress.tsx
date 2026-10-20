import { Link } from 'react-router-dom';
import { ArrowRight, Target } from 'lucide-react';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { games } from '@/data/games';
import { formatMessage } from '@/lib/i18n';
import { gameStorage } from '@/lib/storage';
import {
  normalizeArcadeChallenges,
  ARCADE_CHALLENGE_STORAGE_KEY,
} from '../../../shared/contracts/arcadeChallenge';

export function ChallengeProgress() {
  const household = useOptionalHousehold();
  const { t, locale } = useLocale();
  let raw: unknown = household?.snapshot?.arcadeChallenges;
  if (!household?.currentMember) {
    try {
      raw = JSON.parse(
        gameStorage.getItem(ARCADE_CHALLENGE_STORAGE_KEY) ?? 'null',
      );
    } catch {
      /* No prior challenges. */
    }
  }
  const entries = Object.entries(normalizeArcadeChallenges(raw).records)
    .filter(([, record]) => record.attempts > 0)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  return (
    <section className="play-mastery rounded-2xl border bg-card p-5 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Target className="size-5 text-primary" />
          {t('play.challengeHistory')}
        </h2>
        <Link className="text-xs text-primary" to="/journey">
          {t('journey.title')}
          <ArrowRight className="ml-1 inline size-3" />
        </Link>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('play.practiceOnly')}
      </p>
      {entries.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([key, record]) => {
            const [gameId, difficulty] = key.split(':');
            const game = games.find((item) => item.id === gameId);
            if (!game) return null;
            return (
              <Link
                key={key}
                to={`${game.path}?mode=challenge&difficulty=${difficulty}`}
                className="rounded-xl border p-4 transition hover:border-primary"
              >
                <strong>
                  {t(`game.${gameId}.name`)} ·{' '}
                  {t(`arcade.difficulty.${gameId}.${difficulty}`)}
                </strong>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatMessage(locale, 'play.trialAttempts', {
                    attempts: record.attempts,
                    clears: record.clears,
                  })}
                </p>
                {record.bestDurationMs !== null ? (
                  <p className="mt-1 text-xs text-primary">
                    {formatMessage(locale, 'play.bestDuration', {
                      seconds: (record.bestDurationMs / 1000).toFixed(1),
                    })}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {t('play.challengeEmpty')}
        </p>
      )}
    </section>
  );
}
