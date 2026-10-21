import {
  ArrowRight,
  Award,
  Clock,
  Crown,
  Flame,
  LockKeyhole,
  Trophy,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GPT_BANNER_ASSETS } from '@/assets/gptAssets';
import { VenueGameGlyph } from '@/components/home/VenueGameGlyph';
import { Button } from '@/components/ui/button';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { categories } from '@/data/categories';
import { games } from '@/data/games';
import {
  type ArcadeDifficulty,
  arcadeDifficulties,
  difficultyLabelKey,
  normalizeArcadeDifficulty,
} from '@/lib/arcade';
import { formatFamilyFeedItem } from '@/lib/formatFamilyFeed';
import { fetchFamilyFeed, fetchLeaderboard } from '@/lib/household/api';
import { formatMessage } from '@/lib/i18n';
import { getAvatarPresetById } from '@/lib/playerProfile';
import { cn } from '@/lib/utils';
import type {
  FamilyFeedItem,
  LeaderboardResponse,
  LeaderboardScope,
} from '../../shared/contracts/leaderboard';

const ARCADE_GAMES = games.filter((g) => g.categoryId !== 'mahjong');

function formatTimestamp(ms: number, locale: 'zh' | 'en', legacyLabel: string): string {
  if (!ms || ms <= 0) return legacyLabel;
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  }
}

export default function Leaderboard() {
  const { t, locale } = useLocale();
  const household = useOptionalHousehold();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialGameId = useMemo(() => {
    const param = searchParams.get('game') ?? '';
    return ARCADE_GAMES.some((g) => g.id === param) ? param : '2048';
  }, [searchParams]);

  const initialGame =
    ARCADE_GAMES.find((g) => g.id === initialGameId) ?? ARCADE_GAMES[0];

  const [tab, setTab] = useState<'rankings' | 'feed'>(() =>
    searchParams.get('tab') === 'feed' ? 'feed' : 'rankings',
  );
  const [categoryId, setCategoryId] = useState<string>(initialGame.categoryId);
  const [gameId, setGameId] = useState<string>(initialGame.id);
  const [difficulty, setDifficulty] = useState<ArcadeDifficulty>(() =>
    normalizeArcadeDifficulty(
      initialGame.id,
      searchParams.get('difficulty') ?? 'normal',
    ),
  );
  const [scope, setScope] = useState<LeaderboardScope>(() =>
    searchParams.get('scope') === 'week' ? 'week' : 'all-time',
  );

  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [feedItems, setFeedItems] = useState<FamilyFeedItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);

  const memberMode = Boolean(household?.currentMember);
  const isOnline = Boolean(household?.isServerAvailable);
  const canLoadLive = memberMode && isOnline;

  const categoryGames = useMemo(
    () => ARCADE_GAMES.filter((g) => g.categoryId === categoryId),
    [categoryId],
  );
  const currentGame =
    ARCADE_GAMES.find((g) => g.id === gameId) ?? ARCADE_GAMES[0];
  const difficulties = useMemo(
    () => arcadeDifficulties(currentGame.id),
    [currentGame.id],
  );

  const selectCategory = (nextCat: string) => {
    setCategoryId(nextCat);
    const firstInCat = ARCADE_GAMES.find((g) => g.categoryId === nextCat);
    if (firstInCat) {
      const nextDiff = normalizeArcadeDifficulty(firstInCat.id, difficulty);
      setGameId(firstInCat.id);
      setDifficulty(nextDiff);
      setSearchParams(
        { game: firstInCat.id, difficulty: nextDiff, scope, tab },
        { replace: true },
      );
    }
  };

  const selectGame = (nextGameId: string) => {
    const found = ARCADE_GAMES.find((g) => g.id === nextGameId);
    if (!found) return;
    const nextDiff = normalizeArcadeDifficulty(found.id, difficulty);
    setCategoryId(found.categoryId);
    setGameId(found.id);
    setDifficulty(nextDiff);
    setSearchParams(
      { game: found.id, difficulty: nextDiff, scope, tab },
      { replace: true },
    );
  };

  const selectDifficulty = (nextDiff: ArcadeDifficulty) => {
    setDifficulty(nextDiff);
    setSearchParams(
      { game: gameId, difficulty: nextDiff, scope, tab },
      { replace: true },
    );
  };

  const selectScope = (nextScope: LeaderboardScope) => {
    setScope(nextScope);
    setSearchParams(
      { game: gameId, difficulty, scope: nextScope, tab },
      { replace: true },
    );
  };

  const selectTab = (nextTab: 'rankings' | 'feed') => {
    setTab(nextTab);
    setSearchParams(
      { game: gameId, difficulty, scope, tab: nextTab },
      { replace: true },
    );
  };

  useEffect(() => {
    if (!canLoadLive) {
      setBoard(null);
      return;
    }
    let cancelled = false;
    setLoadingBoard(true);
    fetchLeaderboard(currentGame.id, difficulty, scope)
      .then((res) => {
        if (!cancelled) setBoard(res);
      })
      .catch(() => {
        if (!cancelled) setBoard(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingBoard(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canLoadLive, currentGame.id, difficulty, scope]);

  useEffect(() => {
    if (!canLoadLive) {
      setFeedItems([]);
      return;
    }
    let cancelled = false;
    setLoadingFeed(true);
    fetchFamilyFeed(100)
      .then((res) => {
        if (!cancelled) setFeedItems(res.items);
      })
      .catch(() => {
        if (!cancelled) setFeedItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFeed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canLoadLive]);

  const unitLabel = t(
    currentGame.bestMetric === 'wins'
      ? 'arcade.unit.streak'
      : (currentGame.bestUnitKey ?? 'arcade.unit.points'),
  );

  return (
    <div className="venue-leaderboard lobby-page min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <section className="salon-page-banner salon-page-banner--leaderboard">
          {GPT_BANNER_ASSETS.leaderboard && (
            <img
              src={GPT_BANNER_ASSETS.leaderboard}
              alt=""
              aria-hidden="true"
              fetchPriority="high"
              decoding="async"
              className="salon-banner-media"
            />
          )}
          <div className="salon-banner-inner flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="play-eyebrow">
                <Trophy className="mr-1.5 inline size-3.5 text-[#d3af66]" />
                {t('venue.nav.leaderboard')}
              </p>
              <h1 className="mt-1 text-3xl font-semibold sm:text-4xl text-[#f5f2e9]">
                {t('leaderboard.title')}
              </h1>
              <p className="mt-1.5 text-sm text-[#e8e3d5] max-w-2xl">
                {t('leaderboard.subtitle')}
              </p>
            </div>
            {canLoadLive && (
              <div
                role="tablist"
                aria-label={t('leaderboard.title')}
                className="salon-banner-tablist flex rounded-full border border-[#d3af66]/40 bg-[#0f1e2b]/85 p-1 backdrop-blur"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'rankings'}
                  onClick={() => selectTab('rankings')}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-xs font-medium transition',
                    tab === 'rankings'
                      ? 'bg-[#d3af66] text-[#172a3a] font-semibold'
                      : 'text-[#e8e3d5] hover:text-white',
                  )}
                >
                  {t('leaderboard.tab.rankings')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'feed'}
                  onClick={() => selectTab('feed')}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-xs font-medium transition',
                    tab === 'feed'
                      ? 'bg-[#d3af66] text-[#172a3a] font-semibold'
                      : 'text-[#e8e3d5] hover:text-white',
                  )}
                >
                  {t('leaderboard.tab.feed')}
                </button>
              </div>
            )}
          </div>
        </section>

        {!memberMode ? (
          <section
            data-testid="leaderboard-member-only"
            className="paper-texture mt-6 rounded-3xl border border-gold/30 bg-card p-8 text-center shadow-sm"
          >
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-gold/40 bg-gold/15 text-gold">
              <LockKeyhole className="size-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              {t('leaderboard.memberOnly.title')}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              {t('leaderboard.memberOnly.desc')}
            </p>
          </section>
        ) : !isOnline ? (
          <section
            data-testid="leaderboard-offline"
            className="paper-texture mt-6 rounded-3xl border border-border bg-card p-8 text-center shadow-sm"
          >
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
              <WifiOff className="size-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              {t('leaderboard.offline.title')}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              {t('leaderboard.offline.desc')}
            </p>
          </section>
        ) : tab === 'rankings' ? (
          <div className="mt-6 space-y-5">
            <section className="paper-texture rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => selectCategory(cat.id)}
                      className={cn(
                        'rounded-full px-3.5 py-1.5 text-xs font-medium transition',
                        categoryId === cat.id
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-background text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {t(`category.${cat.id}.name`)}
                    </button>
                  ))}
                </div>

                <div className="flex rounded-full border bg-background p-1">
                  {(['all-time', 'week'] as const).map((itemScope) => (
                    <button
                      key={itemScope}
                      type="button"
                      data-testid={`scope-${itemScope}`}
                      onClick={() => selectScope(itemScope)}
                      className={cn(
                        'rounded-full px-3.5 py-1 text-xs font-medium transition',
                        scope === itemScope
                          ? 'bg-gold text-[#24362a]'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t(
                        itemScope === 'all-time'
                          ? 'leaderboard.scope.allTime'
                          : 'leaderboard.scope.week',
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {categoryGames.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    data-testid={`leaderboard-game-${g.id}`}
                    onClick={() => selectGame(g.id)}
                    className={cn(
                      'salon-leaderboard-game-pill flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-medium transition',
                      gameId === g.id
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border bg-background text-foreground hover:border-primary/40',
                    )}
                  >
                    <VenueGameGlyph gameId={g.id} />
                    <span>{t(`game.${g.id}.name`)}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t('leaderboard.filter.difficulty')}：
                  </span>
                  {difficulties.map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      data-testid={`leaderboard-diff-${diff}`}
                      onClick={() => selectDifficulty(diff)}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium transition',
                        difficulty === diff
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-background text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {t(difficultyLabelKey(currentGame.id, diff))}
                    </button>
                  ))}
                </div>

                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <Link to={currentGame.path}>
                    {t('common.startGame')}
                    <ArrowRight className="ml-1 size-3.5" />
                  </Link>
                </Button>
              </div>
            </section>

            <section className="paper-texture rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                  <VenueGameGlyph gameId={currentGame.id} />
                  <div>
                    <h2 className="text-lg font-semibold">
                      {t(`game.${currentGame.id}.name`)} ·{' '}
                      {t(difficultyLabelKey(currentGame.id, difficulty))}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        scope === 'all-time'
                          ? 'leaderboard.scope.allTime'
                          : 'leaderboard.scope.week',
                      )}
                      {scope === 'week' && board?.weekId
                        ? ` · ${formatMessage(locale, 'leaderboard.weekLabel', { weekId: board.weekId })}`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>

              {loadingBoard ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {t('common.loading')}
                </div>
              ) : !board || board.entries.length === 0 ? (
                <div
                  data-testid="leaderboard-empty"
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {t('leaderboard.empty')}
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-border/60" data-testid="leaderboard-list">
                  {board.entries.map((entry) => {
                    const preset = getAvatarPresetById(entry.avatar ?? 'default-1');
                    const isMe = entry.memberId === household?.currentMember?.id;
                    return (
                      <li
                        key={entry.memberId}
                        data-testid={`leaderboard-row-${entry.memberId}`}
                        className={cn(
                          'flex flex-wrap items-center justify-between gap-3 py-3.5 px-3 rounded-2xl transition',
                          isMe && 'bg-primary/5',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                              entry.rank === 1
                                ? 'bg-gold/25 text-gold ring-1 ring-gold/50'
                                : entry.rank === 2
                                  ? 'bg-slate-300/30 text-foreground ring-1 ring-slate-400/40'
                                  : entry.rank === 3
                                    ? 'bg-amber-700/20 text-amber-700 dark:text-amber-400 ring-1 ring-amber-700/30'
                                    : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {entry.rank === 1 ? (
                              <Crown className="size-4" />
                            ) : (
                              `#${entry.rank}`
                            )}
                          </span>
                          <div
                            className={cn(
                              'flex size-10 shrink-0 items-center justify-center rounded-xl border border-border font-semibold text-base',
                              preset.bgClass,
                              preset.fgClass,
                            )}
                            role="img"
                            aria-label={preset.label}
                          >
                            {preset.glyph}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {entry.nickname}
                              {isMe && (
                                <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  {t('household.status.current')}
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="size-3" />
                              {formatTimestamp(
                                entry.achievedAt,
                                locale,
                                t('leaderboard.achievedAt.legacy'),
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-base font-bold tabular-nums text-foreground">
                            {entry.value}{' '}
                            <span className="text-xs font-normal text-muted-foreground">
                              {unitLabel}
                            </span>
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <section
            data-testid="leaderboard-feed-panel"
            className="paper-texture mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold">{t('leaderboard.feed.title')}</h2>
            {loadingFeed ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t('common.loading')}
              </div>
            ) : feedItems.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t('leaderboard.feed.empty')}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border/60">
                {feedItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 py-3 text-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                        {item.kind === 'weekly-champion' ? (
                          <Award className="size-4" />
                        ) : item.kind === 'family-cup' ? (
                          <Crown className="size-4" />
                        ) : (
                          <Flame className="size-4" />
                        )}
                      </span>
                      <span className="leading-6 text-foreground">
                        {formatFamilyFeedItem(item, locale)}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatTimestamp(
                        item.createdAt,
                        locale,
                        t('leaderboard.achievedAt.legacy'),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
