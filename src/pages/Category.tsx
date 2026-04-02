import { ArrowRight, Sparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { categories } from '@/data/categories';
import { getGamesByCategory } from '@/data/games';
import { cn } from '@/lib/utils';

function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex gap-1 text-sm">
      <button
        type="button"
        onClick={() => setLocale('zh')}
        className={
          locale === 'zh'
            ? 'font-semibold text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }
      >
        中
      </button>
      <span className="text-muted-foreground">|</span>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={
          locale === 'en'
            ? 'font-semibold text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }
      >
        En
      </button>
    </div>
  );
}

const mahjongPriority: Record<string, number> = {
  'mahjong-japanese': 0,
};

const Category = () => {
  const { t } = useLocale();
  const { categoryId } = useParams<{ categoryId: string }>();
  const category = categories.find((c) => c.id === categoryId);
  const isMahjongCategory = category?.id === 'mahjong';

  const categoryGames = categoryId
    ? getGamesByCategory(categoryId).sort((a, b) => {
        if (categoryId === 'mahjong') {
          return (
            (mahjongPriority[a.id] ?? Number.MAX_SAFE_INTEGER) -
            (mahjongPriority[b.id] ?? Number.MAX_SAFE_INTEGER)
          );
        }
        return a.difficulty - b.difficulty;
      })
    : [];

  const difficultyLabel = (d: number) => t(`difficulty.${d}`) || '';
  const focusPreviewGames = categoryGames.slice(0, 3);
  const mahjongActions = [
    { label: t('common.quickStart'), to: '/game/mahjong-japanese?start=1' },
    { label: t('common.viewRules'), to: '/game/mahjong-japanese' },
    {
      label: t('common.beginnerGuide'),
      to: '/game/mahjong-japanese?start=1&guide=1',
    },
  ];

  if (!category) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground"
            >
              ← {t('common.backHome')}
            </Link>
            <LocaleSwitcher />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-12 text-center">
          <p className="text-muted-foreground">
            {t('common.categoryNotFound')}
          </p>
          <Link to="/">
            <Button className="mt-4" variant="outline">
              {t('common.backHome')}
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← {t('common.backHome')}
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-foreground">
              {t(`category.${category.id}.name`)}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t(`category.${category.id}.description`)}
            </p>
          </div>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:py-10">
        <section
          className={cn(
            'overflow-hidden rounded-[32px]',
            isMahjongCategory
              ? 'premium-surface premium-grid'
              : 'premium-panel-soft',
          )}
        >
          <div className="relative grid gap-6 px-6 py-6 md:px-8 lg:grid-cols-[1.16fr_0.84fr] lg:items-end lg:gap-8 lg:py-8">
            <div className="relative z-10 space-y-4">
              <div
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
                  isMahjongCategory
                    ? 'border border-white/12 bg-white/8 text-amber-100'
                    : 'bg-secondary text-secondary-foreground',
                )}
              >
                <Sparkles className="size-3.5" />
                {isMahjongCategory
                  ? t('category.mahjong.focusBadge')
                  : t('category.other.supportBadge')}
              </div>

              <div className="space-y-3">
                <h2
                  className={cn(
                    'text-3xl font-semibold tracking-tight md:text-4xl',
                    isMahjongCategory ? 'text-white' : 'text-foreground',
                  )}
                >
                  {t(`category.${category.id}.name`)}
                </h2>
                <p
                  className={cn(
                    'max-w-3xl text-sm leading-7',
                    isMahjongCategory
                      ? 'text-slate-300'
                      : 'text-muted-foreground',
                  )}
                >
                  {isMahjongCategory
                    ? t('category.mahjong.focusNote')
                    : t('category.other.supportNote')}
                </p>
              </div>

              {isMahjongCategory && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="shadow-lg shadow-black/20">
                    <Link to="/game/mahjong-japanese">
                      {t('home.hero.primary')}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="border-white/12 bg-white/8 text-white hover:bg-white/12 hover:text-white"
                  >
                    <Link to="/game/mahjong-japanese?start=1&guide=1">
                      {t('common.beginnerGuide')}
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            <div className="relative z-10 grid gap-3">
              {isMahjongCategory ? (
                focusPreviewGames.map((game, index) => (
                  <Link
                    key={game.id}
                    to={game.path}
                    className={cn(
                      'premium-panel group flex items-center justify-between rounded-[22px] px-4 py-4 transition hover:border-white/16 hover:bg-white/10',
                      index === 0 && 'border-amber-300/18 bg-amber-300/10',
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-semibold text-white/90">
                        0{index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {t(`game.${game.id}.name`) || game.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {t('home.mahjong.primaryTag')}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-white" />
                  </Link>
                ))
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="premium-panel-soft rounded-[22px] p-4">
                    <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
                      Mode
                    </p>
                    <p className="mt-3 text-lg font-semibold text-foreground">
                      Side Content
                    </p>
                  </div>
                  <div className="premium-panel-soft rounded-[22px] p-4">
                    <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
                      Games
                    </p>
                    <p className="mt-3 text-lg font-semibold text-foreground">
                      {String(categoryGames.length).padStart(2, '0')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8">
          {categoryGames.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
              <p className="text-muted-foreground">{t('common.noGames')}</p>
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-4',
                isMahjongCategory
                  ? 'lg:grid-cols-3'
                  : 'sm:grid-cols-2 lg:grid-cols-3',
              )}
            >
              {categoryGames.map((game, index) => (
                <article
                  key={game.id}
                  className={cn(
                    'rounded-[26px] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl',
                    isMahjongCategory ? 'premium-panel' : 'premium-panel-soft',
                    isMahjongCategory && game.id === 'mahjong-japanese'
                      ? 'border-amber-300/18 bg-[linear-gradient(135deg,rgba(245,158,11,0.22),rgba(15,23,42,0.82)_34%,rgba(15,23,42,0.94))] lg:col-span-2'
                      : '',
                    game.comingSoon && 'opacity-80',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-3 py-1 text-xs font-medium',
                          isMahjongCategory
                            ? 'border border-white/10 bg-white/8 text-slate-200'
                            : 'border border-border/70 bg-background text-muted-foreground',
                        )}
                      >
                        0{index + 1}
                      </span>
                      <h2
                        className={cn(
                          'text-xl font-semibold',
                          isMahjongCategory ? 'text-white' : 'text-foreground',
                          isMahjongCategory &&
                            game.id === 'mahjong-japanese' &&
                            'md:text-3xl',
                        )}
                      >
                        {t(`game.${game.id}.name`) || game.name}
                      </h2>
                    </div>

                    {!game.comingSoon && (
                      <span
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-medium',
                          isMahjongCategory &&
                            index === 0 &&
                            'border border-white/10 bg-white/8 text-amber-100',
                          !(isMahjongCategory && index === 0) &&
                            game.difficulty >= 4 &&
                            'bg-destructive/20 text-destructive',
                          !(isMahjongCategory && index === 0) &&
                            game.difficulty === 3 &&
                            'bg-amber-500/20 text-amber-700',
                          !(isMahjongCategory && index === 0) &&
                            game.difficulty === 2 &&
                            'bg-blue-500/20 text-blue-700',
                          !(isMahjongCategory && index === 0) &&
                            game.difficulty === 1 &&
                            'bg-green-500/20 text-green-700',
                        )}
                      >
                        {isMahjongCategory && index === 0
                          ? t('home.mahjong.primaryTag')
                          : difficultyLabel(game.difficulty)}
                      </span>
                    )}
                  </div>

                  <p
                    className={cn(
                      'mt-4 text-sm leading-7',
                      isMahjongCategory
                        ? 'text-slate-300'
                        : 'text-muted-foreground',
                    )}
                  >
                    {t(`game.${game.id}.description`) || game.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {game.tags.map((tag) => (
                      <span
                        key={tag}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs',
                          isMahjongCategory
                            ? 'border border-white/8 bg-white/6 text-slate-300'
                            : 'border border-border bg-background text-muted-foreground',
                        )}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {isMahjongCategory && !game.comingSoon && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {mahjongActions.map((action) => (
                        <Link
                          key={action.to}
                          to={action.to}
                          className={cn(
                            'rounded-full px-3 py-2 text-xs font-medium transition',
                            isMahjongCategory
                              ? 'border border-white/10 bg-black/15 text-slate-100 hover:border-white/20 hover:bg-white/10'
                              : 'border border-border bg-background text-foreground',
                          )}
                        >
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  )}

                  {game.comingSoon ? (
                    <Button
                      className="mt-6 w-full"
                      variant="outline"
                      size="sm"
                      disabled
                    >
                      {t('common.comingSoon')}
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="mt-6"
                      variant="secondary"
                      size="lg"
                    >
                      <Link to={game.path}>
                        {t('common.startGame')}
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Category;
