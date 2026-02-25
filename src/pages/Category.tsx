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
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground"
            >
              ← {t('common.backHome')}
            </Link>
            <LocaleSwitcher />
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-12 text-center">
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
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-start justify-between">
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
            <p className="mt-1 text-sm text-muted-foreground">
              {t(`category.${category.id}.description`)}
            </p>
          </div>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {categoryGames.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
            <p className="text-muted-foreground">{t('common.noGames')}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categoryGames.map((game) => (
              <div
                key={game.id}
                className={cn(
                  'rounded-lg border border-border bg-card p-4 shadow-sm',
                  game.comingSoon && 'opacity-80',
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">{game.name}</h2>
                  {!game.comingSoon && (
                    <span
                      className={cn(
                        'rounded px-2 py-0.5 text-xs',
                        game.difficulty >= 4 &&
                          'bg-destructive/20 text-destructive',
                        game.difficulty === 3 &&
                          'bg-amber-500/20 text-amber-700',
                        game.difficulty === 2 && 'bg-blue-500/20 text-blue-700',
                        game.difficulty === 1 &&
                          'bg-green-500/20 text-green-700',
                      )}
                    >
                      {difficultyLabel(game.difficulty)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {game.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {game.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {game.comingSoon ? (
                  <Button
                    className="mt-4 w-full"
                    variant="outline"
                    size="sm"
                    disabled
                  >
                    {t('common.comingSoon')}
                  </Button>
                ) : (
                  <Link to={game.path} className="mt-4 block">
                    <Button className="w-full" variant="secondary" size="sm">
                      {t('common.startGame')}
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Category;
