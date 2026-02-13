import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { games } from '@/data/games';
import { cn } from '@/lib/utils';

const difficultyLabel = (d: number) => {
  const labels = ['', '简单', '中等', '困难', '挑战'];
  return labels[d] ?? '';
};

const Home = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-bold text-foreground">小游戏合集</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            选一个游戏开始玩吧
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <Link
              key={game.id}
              to={game.path}
              className="group block rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary/50 hover:shadow-md"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold text-foreground group-hover:text-primary">
                  {game.name}
                </h2>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-xs',
                    game.difficulty >= 4 && 'bg-destructive/20 text-destructive',
                    game.difficulty === 3 && 'bg-amber-500/20 text-amber-700',
                    game.difficulty === 2 && 'bg-blue-500/20 text-blue-700',
                    game.difficulty === 1 && 'bg-green-500/20 text-green-700',
                  )}
                >
                  {difficultyLabel(game.difficulty)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{game.description}</p>
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
              <Button className="mt-4 w-full" variant="secondary" size="sm">
                开始游戏
              </Button>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Home;
