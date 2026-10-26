import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { LOCAL_RESUME_CHANGED } from '@/lib/localResume';
import {
  practiceNotePath,
  readTrainingNotebook,
  STARTER_LESSONS,
  starterQuestion,
  updatePracticeNote,
} from '@/lib/trainingNotebook';
import { createUuid } from '@/lib/uuid';

export function TrainingNotebook({ owner }: { owner: string }) {
  const { t, locale } = useLocale();
  const [book, setBook] = useState(() => readTrainingNotebook(owner));
  const [filter, setFilter] = useState('due');
  useEffect(() => {
    const refresh = () => setBook(readTrainingNotebook(owner));
    refresh();
    window.addEventListener(LOCAL_RESUME_CHANGED, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(LOCAL_RESUME_CHANGED, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [owner]);
  const repeated = book.notes.filter((n) => n.attempts.length > 1);
  const matched = (latest: boolean) =>
    repeated.length
      ? Math.round(
          (100 *
            repeated.filter(
              (n) => n.attempts[latest ? n.attempts.length - 1 : 0].matched,
            ).length) /
            repeated.length,
        )
      : 0;
  const shown = book.notes.filter((n) =>
    filter === 'favorite'
      ? n.favorite
      : filter === 'due'
        ? n.dueAt > 0 && n.dueAt <= Date.now()
        : n.attempts.length > 0,
  );
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('notebook.title')}</h2>
        <Button asChild>
          <Link to="/replays/training?practice=starter">
            {t('notebook.start')}
          </Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t('notebook.scope')}</p>
      {repeated.length > 0 && (
        <p className="rounded-xl bg-muted p-3 text-sm">
          {formatMessage(locale, 'notebook.compare', {
            count: repeated.length,
            first: matched(false),
            last: matched(true),
          })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {['due', 'favorite', 'history'].map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? 'default' : 'outline'}
            onClick={() => setFilter(value)}
          >
            {t(`notebook.${value}`)}
          </Button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('notebook.empty')}</p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-auto">
          {shown.map((note) => (
            <li key={note.id} className="rounded-xl border p-3">
              <Link
                to={practiceNotePath(note)}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {note.source === 'starter'
                  ? t(`lesson.${note.sourceId}.title`)
                  : `${t('notebook.replay')} · ${t(`riichi.review.kind.${note.category}`)}`}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {note.attempts.length
                  ? `${new Date(note.attempts.at(-1)!.at).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')} · ${t(note.attempts.at(-1)!.matched ? 'notebook.matched' : 'notebook.different')}`
                  : t('notebook.unanswered')}
                {note.dueAt > 0 &&
                  ` · ${t('notebook.next')} ${new Date(note.dueAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t('notebook.method')}</p>
    </section>
  );
}

export function StarterPractice({
  owner,
  lessonId,
}: {
  owner: string;
  lessonId?: string | null;
}) {
  const { t } = useLocale();
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      STARTER_LESSONS.findIndex((l) => l.id === lessonId),
    ),
  );
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [attemptId, setAttemptId] = useState(createUuid);
  const [failed, setFailed] = useState(false);
  const [favorite, setFavorite] = useState(() =>
    Boolean(
      readTrainingNotebook(owner).notes.find(
        (n) => n.id === starterQuestion(STARTER_LESSONS[index]).id,
      )?.favorite,
    ),
  );
  const lesson = STARTER_LESSONS[index];
  const question = starterQuestion(lesson);
  const save = () => {
    if (choice === null) return;
    setFailed(
      !updatePracticeNote(owner, question, {
        attemptId,
        matched: choice === lesson.correct,
      }),
    );
    setSubmitted(true);
  };
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <Link to="/replays/training" className="text-sm text-primary">
        ← {t('riichi.training.center.title')}
      </Link>
      <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-8">
        <p className="text-xs text-muted-foreground">
          {t('notebook.start')} · {index + 1} / {STARTER_LESSONS.length}
        </p>
        <h1 className="text-2xl font-semibold">
          {t(`lesson.${lesson.id}.title`)}
        </h1>
        <p className="whitespace-pre-line leading-7">
          {t(`lesson.${lesson.id}.prompt`)}
        </p>
        <div className="grid gap-3">
          {[0, 1, 2].map((option) => (
            <Button
              key={option}
              variant={choice === option ? 'default' : 'outline'}
              disabled={submitted}
              className="h-auto justify-start whitespace-normal py-3 text-left"
              onClick={() => setChoice(option)}
            >
              {t(`lesson.${lesson.id}.${option}`)}
            </Button>
          ))}
        </div>
        {submitted && (
          <div className="space-y-2 rounded-xl bg-muted p-4" role="status">
            <p className="font-semibold">
              {t(
                choice === lesson.correct
                  ? 'notebook.matched'
                  : 'notebook.different',
              )}
            </p>
            <p className="text-sm leading-6">{t(`lesson.${lesson.id}.why`)}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {!submitted ? (
            <Button disabled={choice === null} onClick={save}>
              {t('riichi.training.submit')}
            </Button>
          ) : (
            <Button
              disabled={failed}
              onClick={() => {
                if (index === STARTER_LESSONS.length - 1 || lessonId) {
                  return;
                }
                const next = index + 1;
                setIndex(next);
                setChoice(null);
                setSubmitted(false);
                setFailed(false);
                setAttemptId(createUuid());
                setFavorite(
                  Boolean(
                    readTrainingNotebook(owner).notes.find(
                      (n) => n.id === starterQuestion(STARTER_LESSONS[next]).id,
                    )?.favorite,
                  ),
                );
              }}
              asChild={
                index === STARTER_LESSONS.length - 1 || Boolean(lessonId)
              }
            >
              {index === STARTER_LESSONS.length - 1 || lessonId ? (
                <Link to="/replays/training">
                  {t('riichi.training.finish')}
                </Link>
              ) : (
                t('riichi.training.next')
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              const ok = updatePracticeNote(owner, question, {
                favorite: !favorite,
              });
              setFailed(!ok);
              if (ok) setFavorite(!favorite);
            }}
          >
            {t(favorite ? 'notebook.unfavorite' : 'notebook.save')}
          </Button>
        </div>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {t('notebook.failed')}{' '}
            {submitted && (
              <button className="underline" onClick={save}>
                {t('recovery.retry')}
              </button>
            )}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t('notebook.scope')}</p>
      </section>
    </div>
  );
}
