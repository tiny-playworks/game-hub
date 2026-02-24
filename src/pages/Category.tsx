import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { categories } from '@/data/categories';
import { getGamesByCategory } from '@/data/games';
import { cn } from '@/lib/utils';

const difficultyLabel = (d: number) => {
  const labels = ['', '简单', '中等', '困难', '挑战'];
  return labels[d] ?? '';
};

const Category = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const category = categories.find((c) => c.id === categoryId);
  const categoryGames = categoryId
    ? getGamesByCategory(categoryId).sort((a, b) => a.difficulty - b.difficulty)
    : [];

  if (!category) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card px-4 py-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            ← 返回首页
          </Link>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-12 text-center">
          <p className="text-muted-foreground">分类不存在</p>
          <Link to="/">
            <Button className="mt-4" variant="outline">
              返回首页
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← 返回首页
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            {category.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {category.description}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {categoryGames.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
            <p className="text-muted-foreground">暂无游戏，敬请期待</p>
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
                    开发中
                  </Button>
                ) : (
                  <Link to={game.path} className="mt-4 block">
                    <Button className="w-full" variant="secondary" size="sm">
                      开始游戏
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
