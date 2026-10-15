import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { RiichiPracticeTable } from '@/components/riichi/RiichiPracticeTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { getCharacterById } from '@/lib/playerCharacters';
import { JOURNEY_CONTENT_VERSION } from '../../shared/contracts/journey';
import { createUuid } from '@/lib/uuid';
import {
  getJourneyProgress,
  JOURNEY_PROGRESS_CHANGED_EVENT,
  recordLocalJourneyAttempt,
  type JourneyAttemptInput,
} from '@/lib/journeyProgress';
import {
  createJourneyMatch,
  getJourneyStage,
  JOURNEY_STAGES,
} from '@/lib/riichiJourney';
import { preloadRiichiRules } from '@/lib/riichiRules';
import { toReplayFile, type RiichiMatchState } from '@/pages/mahjong/japanese/engine/match';
import { cn } from '@/lib/utils';

export default function Journey() {
  const { t, locale } = useLocale();
  const household = useHousehold();
  const [searchParams, setSearchParams] = useSearchParams();
  const stageParam = searchParams.get('stage');
  const selectedStage = getJourneyStage(stageParam);
  const [rulesReady, setRulesReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [guestProgress, setGuestProgress] = useState(getJourneyProgress);
  const [attemptKey, setAttemptKey] = useState(0);
  const [game, setGame] = useState<{
    stageId: string;
    attemptKey: number;
    match: RiichiMatchState;
  } | null>(null);
  const [evaluation, setEvaluation] = useState<{
    completed: boolean;
    pointsDelta: number;
    playerDiscards: number;
    openMelds: number;
    reachedTenpai: boolean;
    survivedThreat: boolean;
  } | null>(null);
  const [pendingInput, setPendingInput] = useState<JourneyAttemptInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const memberProgress = household.snapshot?.journey;
  const progress = household.mode !== 'guest-local'
    ? memberProgress
    : guestProgress;
  const isMember = household.mode !== 'guest-local';

  useEffect(() => {
    let active = true;
    void preloadRiichiRules()
      .then(() => { if (active) setRulesReady(true); })
      .catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const refresh = () => setGuestProgress(getJourneyProgress());
    window.addEventListener(JOURNEY_PROGRESS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(JOURNEY_PROGRESS_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!selectedStage || !rulesReady) {
      setGame(null);
      return;
    }
    try {
      setGame({
        stageId: selectedStage.id,
        attemptKey,
        match: createJourneyMatch(selectedStage.id),
      });
      setEvaluation(null);
      setPendingInput(null);
      setSubmitError(false);
    } catch {
      setGame(null);
      setLoadFailed(true);
    }
  }, [selectedStage, attemptKey, rulesReady]);

  const openStage = useCallback((stageId: string | null) => {
    setEvaluation(null);
    setPendingInput(null);
    setSubmitError(false);
    setAttemptKey(0);
    if (stageId) setSearchParams({ stage: stageId });
    else setSearchParams({});
  }, [setSearchParams]);

  const saveAttempt = useCallback(async (input: JourneyAttemptInput) => {
    setSubmitting(true);
    setSubmitError(false);
    try {
      if (isMember) {
        const result = await household.submitJourneyAttempt(input);
        setEvaluation(result.evaluation);
      } else {
        const result = recordLocalJourneyAttempt(input);
        setGuestProgress(result.state);
        setEvaluation(result.evaluation);
      }
      setPendingInput(null);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }, [household, isMember]);

  const handleRoundEnd = useCallback((match: RiichiMatchState) => {
    if (!selectedStage || pendingInput || evaluation || submitting) return;
    const input: JourneyAttemptInput = {
      attemptId: createUuid(),
      stageId: selectedStage.id,
      contentVersion: JOURNEY_CONTENT_VERSION,
      replay: toReplayFile(match),
    };
    setPendingInput(input);
    void saveAttempt(input);
  }, [selectedStage, pendingInput, evaluation, submitting, saveAttempt]);

  const retryRound = useCallback(() => {
    setEvaluation(null);
    setPendingInput(null);
    setSubmitError(false);
    setAttemptKey((key) => key + 1);
  }, []);

  const selectedStageProgress = selectedStage ? progress?.stages[selectedStage.id] : null;
  const gameReady = !!selectedStage && game?.stageId === selectedStage.id &&
    game.attemptKey === attemptKey;
  if (household.isLoading) {
    return <main className="container flex min-h-[60vh] items-center justify-center px-4 text-muted-foreground">{t('journey.loading')}</main>;
  }

  return (
    <main className="venue-home min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-8 sm:py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-3 -ml-3">
              <Link to="/"><ArrowLeft className="mr-1.5 size-4" />{t('journey.back')}</Link>
            </Button>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t('journey.choose')}</p>
            <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{t('journey.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t('journey.subtitle')}</p>
          </div>
          <p className="rounded-full border bg-card px-3 py-2 text-xs text-muted-foreground">{t('journey.noReward')}</p>
        </header>

        {loadFailed ? (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-center gap-3 py-8 text-sm text-destructive">
              <span>{t('journey.loadError')}</span>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>{t('journey.retryPrepare')}</Button>
            </CardContent>
          </Card>
        ) : null}

        {!selectedStage ? (
          <section className="grid gap-4 md:grid-cols-3" aria-label={t('journey.choose')}>
            {JOURNEY_STAGES.map((stage, index) => {
              const item = progress?.stages[stage.id];
              const character = getCharacterById(stage.characterId);
              return (
                <Card className="flex min-h-64 flex-col overflow-hidden border-gold/25" key={stage.id}>
                  <CardHeader className="bg-[linear-gradient(130deg,hsl(var(--primary)/.12),transparent_70%)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t(stage.venueKey)}</p>
                    <CardTitle className="mt-1 flex items-center gap-2 text-xl">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm tabular-nums text-primary">0{index + 1}</span>
                      {t(stage.titleKey)}
                    </CardTitle>
                    <p className="text-sm font-medium">{t(character.nameKey)}</p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-5 pt-4">
                    <div className="space-y-3">
                      <p className="text-sm leading-6 text-muted-foreground">{t(stage.goalKey)}</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t('journey.opponents')} · {stage.opponents.map((id) => t(getCharacterById(id).nameKey)).join(locale === 'zh' ? '、' : ', ')}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('journey.difficulty')} · {t('journey.difficulty.standard')}</p>
                      {item ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatMessage(locale, 'journey.attempts', { count: item.attempts })}</span>
                          {item.bestPointsDelta !== null ? <span>{t('journey.best')}: {item.bestPointsDelta > 0 ? '+' : ''}{item.bestPointsDelta}</span> : null}
                        </div>
                      ) : null}
                    </div>
                    <Button onClick={() => openStage(stage.id)} className="w-full rounded-xl">
                      {t('journey.start')}<ArrowRight className="ml-1.5 size-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ) : (
          <>
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/25 bg-card/70 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t(selectedStage.venueKey)}</p>
                <h2 className="mt-1 text-xl font-semibold">{t(selectedStage.titleKey)}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{t(selectedStage.goalKey)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => openStage(null)}>{t('journey.chooseAnother')}</Button>
            </section>

            {gameReady && !evaluation ? (
              <RiichiPracticeTable
                key={`${selectedStage.id}-${attemptKey}`}
                initialMatch={game.match}
                title={t(selectedStage.titleKey)}
                objective={t(selectedStage.goalKey)}
                onRoundEnd={handleRoundEnd}
                onExit={() => openStage(null)}
              />
            ) : null}

            {selectedStage && !gameReady && !loadFailed ? (
              <Card><CardContent className="flex min-h-72 items-center justify-center gap-3 text-sm text-muted-foreground"><RotateCcw className="size-4 animate-spin" />{t('journey.loading')}</CardContent></Card>
            ) : null}

            {submitting ? <p role="status" className="text-center text-sm text-muted-foreground">{t('journey.submitting')}</p> : null}

            {submitError && pendingInput ? (
              <Card className="border-destructive/30">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <p role="alert" className="text-sm text-destructive">{t('journey.submitError')}</p>
                  <Button variant="outline" size="sm" disabled={submitting} onClick={() => void saveAttempt(pendingInput)}>{t('storage.retry')}</Button>
                </CardContent>
              </Card>
            ) : null}

            {evaluation ? (
              <Card className="journey-result-card overflow-hidden border-gold/30">
                <CardHeader className={cn('border-b', evaluation.completed ? 'bg-emerald-500/8' : 'bg-muted/40')}>
                  <div className="flex items-center gap-3">
                    <div className={cn('flex size-11 items-center justify-center rounded-full', evaluation.completed ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                      {evaluation.completed ? <CheckCircle2 className="size-6" /> : <Sparkles className="size-5" />}
                    </div>
                    <div>
                      <CardTitle>{t(evaluation.completed ? 'journey.completed' : 'journey.incomplete')}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{t(evaluation.completed ? 'journey.successMessage' : 'journey.keepTrying')}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metric label={t('journey.best')} value={`${(selectedStageProgress?.bestPointsDelta ?? evaluation.pointsDelta) > 0 ? '+' : ''}${selectedStageProgress?.bestPointsDelta ?? evaluation.pointsDelta}`} />
                    <Metric label={t('journey.roundDelta')} value={`${evaluation.pointsDelta > 0 ? '+' : ''}${evaluation.pointsDelta}`} />
                    <Metric label={t('journey.playerDiscards')} value={evaluation.playerDiscards} />
                    <Metric label={t('journey.openMelds')} value={evaluation.openMelds} />
                    <Metric label={t('journey.tenpai')} value={t(evaluation.reachedTenpai ? 'journey.tenpai.yes' : 'journey.tenpai.no')} />
                    {selectedStage.id === 'mio-defense' ? <Metric label={t('journey.survivedThreat')} value={t(evaluation.survivedThreat ? 'journey.survivedThreat.yes' : 'journey.survivedThreat.no')} /> : null}
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={retryRound}><RotateCcw className="mr-1.5 size-4" />{t('journey.retry')}</Button>
                    <Button variant="outline" onClick={() => openStage(null)}>{t('journey.chooseAnother')}</Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {selectedStageProgress?.completed && !evaluation ? (
              <p className="text-center text-xs text-muted-foreground">{t('journey.completed')} · {selectedStageProgress.attempts}</p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border bg-muted/20 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd></div>;
}
