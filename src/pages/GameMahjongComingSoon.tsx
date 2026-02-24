import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const PATH_TITLE: Record<string, string> = {
  '/game/mahjong-sichuan': '四川麻将',
  '/game/mahjong-japanese': '日本麻将',
};

const GameMahjongComingSoon = () => {
  const { pathname } = useLocation();
  const title = PATH_TITLE[pathname] ?? '麻将';

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link
          to="/category/mahjong"
          className="text-muted-foreground hover:text-foreground"
        >
          ← 返回麻将分类
        </Link>
      </header>
      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-4">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-muted-foreground">开发中，敬请期待</p>
        <Link to="/category/mahjong" className="mt-6">
          <Button variant="outline">返回麻将分类</Button>
        </Link>
      </main>
    </div>
  );
};

export default GameMahjongComingSoon;
