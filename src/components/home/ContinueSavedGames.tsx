import { ArrowRight, History } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { difficultyLabelKey } from '@/lib/arcade';
import { arcadeResumeSlot, isArcadeResume } from '@/lib/arcadeResume';
import { formatMessage } from '@/lib/i18n';
import {
  isJourneyResume,
  journeyResumeSlot,
  listLocalResumes,
  LOCAL_RESUME_CHANGED,
  resumeOwner,
} from '@/lib/localResume';

export function ContinueSavedGames() {
  const household = useOptionalHousehold();
  const owner = resumeOwner(household?.currentMember?.id);
  if (household?.isLoading) return null;
  return <SavedGames key={owner} owner={owner} />;
}

function SavedGames({ owner }: { owner: string }) {
  const { t, locale } = useLocale();
  const [saves, setSaves] = useState(() => listLocalResumes(owner));
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const refresh = () => setSaves(listLocalResumes(owner));
    window.addEventListener(LOCAL_RESUME_CHANGED, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(LOCAL_RESUME_CHANGED, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [owner]);
  const entries = saves.flatMap((save) => {
    const value = save.data;
    if (
      isArcadeResume(value) &&
      save.slot === arcadeResumeSlot(value.gameId, value.mode) &&
      (!value.receipt.finished ||
        value.pendingFinish ||
        value.gameId === 'shengji')
    ) {
      return [
        {
          slot: save.slot,
          updatedAt: save.updatedAt,
          title: t(`game.${value.gameId}.name`),
          detail: `${t(difficultyLabelKey(value.gameId, value.difficulty))} · ${t(value.mode === 'challenge' ? 'play.trial' : 'play.classic')}`,
          to: `/game/${value.gameId}?difficulty=${value.difficulty}&mode=${value.mode}`,
        },
      ];
    }
    if (
      isJourneyResume(value) &&
      save.slot ===
        journeyResumeSlot(value.input.stageId, value.input.variation)
    ) {
      return [
        {
          slot: save.slot,
          updatedAt: save.updatedAt,
          title: t(`journey.stage.${value.input.stageId.split('-')[0]}.title`),
          detail: value.input.variation
            ? formatMessage(locale, 'play.variation', {
                number: value.input.variation,
              })
            : t('play.mainStage'),
          to: `/journey?stage=${value.input.stageId}${value.input.variation ? `&variation=${value.input.variation}` : ''}`,
        },
      ];
    }
    return [];
  });
  if (!entries.length) return null;
  return (
    <section
      aria-labelledby="continue-saved-title"
      className="my-6 rounded-2xl border border-primary/20 bg-card/80 p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2
            id="continue-saved-title"
            className="flex items-center gap-2 text-base font-semibold"
          >
            <History className="size-4 text-primary" />
            {t('resume.title')}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t('resume.deviceHint')}
          </p>
        </div>
        {entries.length > 3 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
          >
            {t(expanded ? 'resume.less' : 'resume.more')}
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {(expanded ? entries : entries.slice(0, 3)).map((entry) => (
          <Link
            key={entry.slot}
            to={entry.to}
            className="group flex min-w-0 items-center gap-3 rounded-xl border bg-background/70 px-4 py-3 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{entry.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.detail}
              </p>
              <time
                className="mt-1 block text-xs text-muted-foreground"
                dateTime={new Date(entry.updatedAt).toISOString()}
              >
                {formatMessage(locale, 'resume.savedAt', {
                  time: new Intl.DateTimeFormat(
                    locale === 'zh' ? 'zh-CN' : 'en-US',
                    {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    },
                  ).format(entry.updatedAt),
                })}
              </time>
            </div>
            <ArrowRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}
