import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, GitBranch, Sparkles, Trophy } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useCharacters } from '@/hooks/useCosmetics';
import { formatMessage } from '@/lib/i18n';
import { fetchReplayList } from '@/lib/riichiReplayArchive';
import { getJourneyProgress } from '@/lib/journeyProgress';
import {
  resolveCuratedRecommendations,
  type ResolvedCuratedItem,
} from '@/lib/curatedRotation';

export function CuratedRotationPanel() {
  const { t, locale } = useLocale();
  const household = useOptionalHousehold();
  const characters = useCharacters();
  const memberMode = Boolean(household?.currentMember);
  const isServerAvailable = household?.isServerAvailable ?? false;

  const [hasEligibleReplay, setHasEligibleReplay] = useState(false);
  const [recommendations, setRecommendations] = useState<ResolvedCuratedItem[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function checkReplays() {
      try {
        const lists = await Promise.all([
          fetchReplayList({ source: 'free', limit: 1 }, memberMode),
          fetchReplayList({ source: 'ai-ranked', limit: 1 }, memberMode),
        ]);
        if (!cancelled) {
          const eligible = lists
            .flatMap((list) => list.items)
            .some(
              (item) => item.source === 'free' || item.source === 'ai-ranked',
            );
          setHasEligibleReplay(eligible);
        }
      } catch {
        if (!cancelled) setHasEligibleReplay(false);
      }
    }

    void checkReplays();
    return () => {
      cancelled = true;
    };
  }, [memberMode]);

  useEffect(() => {
    const progress = memberMode
      ? household?.snapshot?.journey
      : getJourneyProgress();

    const completedJourneyStageIds = progress?.stages
      ? Object.entries(progress.stages)
          .filter(([, s]) => s.completed)
          .map(([id]) => id)
      : [];

    const resolved = resolveCuratedRecommendations({
      memberMode,
      isServerAvailable,
      completedJourneyStageIds,
      completedJourneyVariationIds: Object.entries(progress?.variations ?? {})
        .filter(([, item]) => item.completed)
        .map(([id]) => id),
      companionCharacterId: characters.activeCharacterId,
      hasEligibleReplay,
    });

    setRecommendations(resolved);
  }, [
    memberMode,
    isServerAvailable,
    household?.snapshot?.journey?.updatedAt,
    characters.activeCharacterId,
    hasEligibleReplay,
  ]);

  if (recommendations.length === 0) return null;

  const getIcon = (type: ResolvedCuratedItem['type']) => {
    switch (type) {
      case 'journey':
        return <Compass className="size-5 text-amber-800 dark:text-gold" />;
      case 'replay_branch':
        return (
          <GitBranch className="size-5 text-emerald-700 dark:text-emerald-400" />
        );
      case 'family_cup':
        return <Trophy className="size-5 text-amber-700 dark:text-amber-400" />;
    }
  };

  const getTagBadgeClass = (badge: ResolvedCuratedItem['badge']) => {
    switch (badge) {
      case 'recommend':
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-gold/20 dark:text-gold dark:border-gold/40';
      case 'revisit':
        return 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40';
      case 'practice':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40';
      case 'cup':
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40';
    }
  };

  return (
    <section className="venue-curated mt-6" aria-labelledby="curated-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-gold" />
          <h2
            id="curated-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            {t('curated.sectionTitle')}
          </h2>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            · {t('curated.sectionSubtitle')}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link
            to="/journey"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('journey.title')}
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <Link
            to="/replays"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('riichi.archive.title')}
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <Link
            to="/family"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('family.lobby.title')}
          </Link>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${recommendations.length > 2 ? 'md:grid-cols-3' : ''} gap-3.5`}
      >
        {recommendations.map((item) => {
          const resolvedTitleParams: Record<string, string | number> = {};
          if (item.titleParams) {
            for (const [k, v] of Object.entries(item.titleParams)) {
              resolvedTitleParams[k] =
                typeof v === 'string' && v.includes('.') ? t(v) : v;
            }
          }
          const resolvedDescParams: Record<string, string | number> = {};
          if (item.descParams) {
            for (const [k, v] of Object.entries(item.descParams)) {
              resolvedDescParams[k] =
                typeof v === 'string' && v.includes('.') ? t(v) : v;
            }
          }

          const title = formatMessage(
            locale,
            item.titleKey,
            resolvedTitleParams,
          );
          const desc = formatMessage(locale, item.descKey, resolvedDescParams);

          return (
            <Link
              key={item.id}
              to={item.targetPath}
              className="curated-card group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-all hover:border-gold/60 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl border border-border bg-muted/40">
                    {getIcon(item.type)}
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${getTagBadgeClass(
                      item.badge,
                    )}`}
                  >
                    {t(item.tagKey)}
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-foreground group-hover:text-gold transition-colors line-clamp-1">
                  {title}
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {desc}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs font-medium text-foreground/80 group-hover:text-gold transition-colors">
                <span>{t('curated.browseAll')}</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
