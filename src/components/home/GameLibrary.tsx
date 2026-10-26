import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { games } from '@/data/games';
import {
  LOCAL_RESUME_CHANGED,
  readLocalResume,
  resumeOwner,
  writeLocalResume,
} from '@/lib/localResume';
import { VenueGameGlyph } from './VenueGameGlyph';

const SLOT = 'game-library';
type Library = { schema: 1; favorites: string[]; recent: string[] };
function readLibrary(owner: string): Library {
  const raw = readLocalResume<Library>(owner, SLOT)?.data;
  const ids = (value: unknown) =>
    Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is string =>
                typeof id === 'string' && games.some((g) => g.id === id),
            ),
          ),
        ].slice(0, games.length)
      : [];
  return {
    schema: 1,
    favorites: ids(raw?.favorites),
    recent: ids(raw?.recent),
  };
}
const minutes: Record<string, number> = {
  'guess-number': 3,
  tictactoe: 3,
  memory: 3,
  '2048': 10,
  snake: 5,
  tetris: 10,
  tank: 5,
  shooter: 5,
  breakout: 5,
  rubiks: 15,
  gomoku: 10,
  go: 20,
  chess: 20,
  xiangqi: 20,
  doudizhu: 10,
  shengji: 20,
  'mahjong-japanese': 30,
};

export function PlayHistoryTracker() {
  const { pathname } = useLocation();
  const { currentMember, isLoading } = useHousehold();
  const owner = resumeOwner(currentMember?.id);
  useEffect(() => {
    if (isLoading) return;
    const game = games.find((g) => g.path === pathname && !g.comingSoon);
    if (!game) return;
    const library = readLibrary(owner);
    if (library.recent[0] === game.id) return;
    writeLocalResume(owner, SLOT, {
      ...library,
      recent: [game.id, ...library.recent.filter((id) => id !== game.id)],
    });
  }, [pathname, owner, isLoading]);
  return null;
}

export function GameLibrary() {
  const { currentMember } = useHousehold();
  const owner = resumeOwner(currentMember?.id);
  return <LibraryPanel key={owner} owner={owner} />;
}
function LibraryPanel({ owner }: { owner: string }) {
  const { t } = useLocale();
  const [library, setLibrary] = useState(() => readLibrary(owner));
  const [filter, setFilter] = useState('recent');
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const refresh = () => setLibrary(readLibrary(owner));
    window.addEventListener(LOCAL_RESUME_CHANGED, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(LOCAL_RESUME_CHANGED, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [owner]);
  const selected = games.filter(
    (g) =>
      !g.comingSoon &&
      (filter === 'all' ||
        (filter === 'recent' ? library.recent : library.favorites).includes(
          g.id,
        )) &&
      (!duration || (minutes[g.id] ?? 15) <= duration),
  );
  if (filter === 'recent')
    selected.sort(
      (a, b) => library.recent.indexOf(a.id) - library.recent.indexOf(b.id),
    );
  return (
    <section className="my-5 space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('library.title')}</h2>
        <Link className="text-sm text-primary" to="/short-challenges">
          {t('short.title')} →
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {['recent', 'favorite', 'all'].map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? 'default' : 'outline'}
            onClick={() => setFilter(value)}
          >
            {t(`library.${value}`)}
          </Button>
        ))}
        <label className="ml-auto text-xs text-muted-foreground">
          {t('library.time')}{' '}
          <select
            className="rounded-md border bg-background p-2 text-foreground"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {[0, 5, 10, 30].map((value) => (
              <option key={value} value={value}>
                {value
                  ? `≤ ${value} ${t('library.minutes')}`
                  : t('library.any')}
              </option>
            ))}
          </select>
        </label>
      </div>
      {selected.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {t('library.empty')}{' '}
          <button
            className="text-primary underline"
            onClick={() => {
              setFilter('all');
              setDuration(0);
            }}
          >
            {t('library.all')}
          </button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {selected.map((game) => (
            <article
              key={game.id}
              className="flex min-w-0 items-center gap-2 rounded-xl border p-2"
            >
              <Link
                to={game.path}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <VenueGameGlyph
                  gameId={game.id}
                  className="h-12! w-12! shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">
                    {t(`game.${game.id}.name`)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t('library.about')} {minutes[game.id] ?? 15}{' '}
                    {t('library.minutes')}
                  </p>
                </div>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`${t(library.favorites.includes(game.id) ? 'library.unfavorite' : 'library.save')} ${t(`game.${game.id}.name`)}`}
                aria-pressed={library.favorites.includes(game.id)}
                onClick={() => {
                  const latest = readLibrary(owner);
                  const favorites = latest.favorites.includes(game.id)
                    ? latest.favorites.filter((id) => id !== game.id)
                    : [...latest.favorites, game.id];
                  const next = { ...latest, favorites };
                  const ok = writeLocalResume(owner, SLOT, next);
                  setFailed(!ok);
                  if (ok) setLibrary(next);
                }}
              >
                <Star
                  className={
                    library.favorites.includes(game.id)
                      ? 'fill-primary text-primary'
                      : ''
                  }
                />
              </Button>
            </article>
          ))}
        </div>
      )}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('notebook.failed')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('library.scope')}</p>
    </section>
  );
}
