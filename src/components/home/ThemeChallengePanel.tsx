import { Check, LockKeyhole, ScrollText, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '@/contexts/LocaleContext';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { formatMessage } from '@/lib/i18n';
import {
  getThemeChallengeState,
  THEME_CHALLENGES_CHANGED_EVENT,
  THEME_CHALLENGE_TARGETS,
  type ThemeChallengeId,
  type ThemeChallengeState,
} from '@/lib/themeChallenges';

const CHALLENGE_IDS: ThemeChallengeId[] = [
  'menzen-win',
  'safe-south',
  'three-matches',
];

export function ThemeChallengePanel() {
  const { t, locale } = useLocale();
  const household = useOptionalHousehold();
  const [state, setState] = useState<ThemeChallengeState>(getThemeChallengeState);
  const refresh = useCallback(() => setState(getThemeChallengeState()), []);
  useEffect(() => {
    refresh();
    window.addEventListener(THEME_CHALLENGES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(THEME_CHALLENGES_CHANGED_EVENT, refresh);
  }, [refresh, household?.snapshot?.revision]);

  const completedCount = state.completedIds.length;
  const storySetUnlocked = completedCount === CHALLENGE_IDS.length;

  return (
    <section className="venue-task-panel" aria-labelledby="theme-challenge-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="theme-challenge-title" className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="size-4 text-primary" />
          {t('challenge.title')}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {completedCount}/{CHALLENGE_IDS.length}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {t('challenge.scope')}
      </p>
      <ul className="mt-2 divide-y">
        {CHALLENGE_IDS.map((id) => {
          const target = THEME_CHALLENGE_TARGETS[id];
          const progress = Math.min(state.progress[id], target);
          const completed = state.completedIds.includes(id);
          return (
            <li key={id} className="py-2.5">
              <div className="flex items-center gap-2">
                {completed ? (
                  <Check className="size-4 shrink-0 text-primary" aria-label={t('challenge.completed')} />
                ) : (
                  <span className="size-4 shrink-0 rounded-full border border-border" aria-hidden="true" />
                )}
                <p className="min-w-0 flex-1 text-sm font-medium">{t(`challenge.${id}.title`)}</p>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {progress}/{target}
                </span>
              </div>
              <div
                className="ml-6 mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={t(`challenge.${id}.title`)}
                aria-valuemin={0}
                aria-valuemax={target}
                aria-valuenow={progress}
              >
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(progress / target) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {storySetUnlocked ? <ScrollText className="size-3.5 text-primary" /> : <LockKeyhole className="size-3.5" />}
          {formatMessage(locale, storySetUnlocked ? 'challenge.storyUnlocked' : 'challenge.storyProgress', {
            completed: completedCount,
            total: CHALLENGE_IDS.length,
          })}
        </span>
        <Link to={storySetUnlocked ? '/characters' : '/game/mahjong-japanese'} className="text-xs font-medium text-primary hover:underline">
          {t(storySetUnlocked ? 'challenge.readStories' : 'challenge.startMatch')}
        </Link>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {t('challenge.reward')}
      </p>
    </section>
  );
}
