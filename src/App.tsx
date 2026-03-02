import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LocaleProvider } from '@/contexts/LocaleContext';
import Home from '@/pages/Home';
import './App.css';

const Achievements = lazy(() => import('@/pages/Achievements'));
const Category = lazy(() => import('@/pages/Category'));
const Game2048 = lazy(() => import('@/pages/Game2048'));
const GameBreakout = lazy(() => import('@/pages/GameBreakout'));
const GameChess = lazy(() => import('@/pages/GameChess'));
const GameDoudizhu = lazy(() => import('@/pages/GameDoudizhu'));
const GameGo = lazy(() => import('@/pages/GameGo'));
const GameShengji = lazy(() => import('@/pages/GameShengji'));
const GameGomoku = lazy(() => import('@/pages/GameGomoku'));
const GameGuessNumber = lazy(() => import('@/pages/GameGuessNumber'));
const GameMahjongChinese = lazy(() => import('@/pages/mahjong/chinese'));
const GameMahjongJapanese = lazy(() => import('@/pages/mahjong/japanese'));
const GameMahjongSichuan = lazy(() => import('@/pages/mahjong/sichuan'));
const GameMemory = lazy(() => import('@/pages/GameMemory'));
const GameShooter = lazy(() => import('@/pages/GameShooter'));
const GameSnake = lazy(() => import('@/pages/GameSnake'));
const GameTank = lazy(() => import('@/pages/GameTank'));
const GameTetris = lazy(() => import('@/pages/GameTetris'));
const GameTictactoe = lazy(() => import('@/pages/GameTictactoe'));
const GameXiangqi = lazy(() => import('@/pages/GameXiangqi'));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      加载中…
    </div>
  );
}

const App = () => {
  return (
    <BrowserRouter>
      <LocaleProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/category/:categoryId" element={<Category />} />
            <Route
              path="/game/mahjong-chinese"
              element={<GameMahjongChinese />}
            />
            <Route
              path="/game/mahjong-sichuan"
              element={<GameMahjongSichuan />}
            />
            <Route
              path="/game/mahjong-japanese"
              element={<GameMahjongJapanese />}
            />
            <Route path="/game/guess-number" element={<GameGuessNumber />} />
            <Route path="/game/tictactoe" element={<GameTictactoe />} />
            <Route path="/game/memory" element={<GameMemory />} />
            <Route path="/game/2048" element={<Game2048 />} />
            <Route path="/game/snake" element={<GameSnake />} />
            <Route path="/game/breakout" element={<GameBreakout />} />
            <Route path="/game/shooter" element={<GameShooter />} />
            <Route path="/game/tank" element={<GameTank />} />
            <Route path="/game/tetris" element={<GameTetris />} />
            <Route path="/game/go" element={<GameGo />} />
            <Route path="/game/gomoku" element={<GameGomoku />} />
            <Route path="/game/xiangqi" element={<GameXiangqi />} />
            <Route path="/game/chess" element={<GameChess />} />
            <Route path="/game/doudizhu" element={<GameDoudizhu />} />
            <Route path="/game/shengji" element={<GameShengji />} />
          </Routes>
        </Suspense>
      </LocaleProvider>
    </BrowserRouter>
  );
};

export default App;
