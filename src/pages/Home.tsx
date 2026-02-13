import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { categories } from '@/data/categories';

const Home = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-bold text-foreground">游戏合集</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            选择分类，进入对应游戏列表
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={cat.path}
              className="group block rounded-lg border border-border bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">
                {cat.name}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {cat.description}
              </p>
              <Button className="mt-4 w-full" variant="secondary" size="sm">
                进入
              </Button>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Home;
