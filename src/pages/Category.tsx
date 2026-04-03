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

const Category = () => {
  const { t } = useLocale();
  const { categoryId } = useParams<{ categoryId: string }>();
  const category = categories.find((c) => c.id === categoryId);

  const categoryGames = categoryId
    ? getGamesByCategory(categoryId).sort((a, b) => a.difficulty - b.difficulty)
    : [];

  const difficultyLabel = (d: number) => t(`difficulty.${d}`) || '';

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
        <section className="overflow-hidden rounded-[32px] premium-panel-soft">
          <div className="relative grid gap-6 px-6 py-6 md:px-8 lg:grid-cols-[1.16fr_0.84fr] lg:items-end lg:gap-8 lg:py-8">
            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                <Sparkles className="size-3.5" />
                {t('category.other.supportBadge')}
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  {t(`category.${category.id}.name`)}
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                  {t('category.other.supportNote')}
                </p>
              </div>
            </div>

            <div className="relative z-10 grid gap-3">
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
            </div>
          </div>
        </section>

        <section className="mt-8">
          {categoryGames.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
              <p className="text-muted-foreground">{t('common.noGames')}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryGames.map((game, index) => (
                <article
                  key={game.id}
                  className={cn(
                    'rounded-[26px] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl premium-panel-soft',
                    game.comingSoon && 'opacity-80',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <span className="inline-flex rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                        0{index + 1}
                      </span>
                      <h2 className="text-xl font-semibold text-foreground">
                        {t(`game.${game.id}.name`) || game.name}
                      </h2>
                    </div>

                    {!game.comingSoon && (
                      <span
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-medium',
                          game.difficulty >= 4 && 'bg-destructive/20 text-destructive',
                          game.difficulty === 3 && 'bg-amber-500/20 text-amber-700',
                          game.difficulty === 2 && 'bg-blue-500/20 text-blue-700',
                          game.difficulty === 1 && 'bg-green-500/20 text-green-700',
                        )}
                      >
                        {difficultyLabel(game.difficulty)}
                      </span>
                    )}
                  </div>

                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    {t(`game.${game.id}.description`) || game.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {game.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

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
