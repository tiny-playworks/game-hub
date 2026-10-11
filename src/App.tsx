import { lazy, type ReactElement, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AchievementUnlockToast from '@/components/AchievementUnlockToast';
import CoinsToast from '@/components/CoinsToast';
import { AffinityNotice } from '@/components/characters/AffinityNotice';
import GrowthPointToast from '@/components/GrowthPointToast';
import { RankedNavigationGuard } from '@/components/ranked/RankedNavigationGuard';
import { ArcadeSession } from '@/contexts/ArcadeContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { CosmeticsProvider } from '@/hooks/useCosmetics';
import { migrateLegacyArcadeStats } from '@/lib/achievements';
import Home from '@/pages/Home';
import './App.css';
import './cosmetics.css';

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
const GameMahjongJapanese = lazy(() => import('@/pages/mahjong/japanese'));
const GameMemory = lazy(() => import('@/pages/GameMemory'));
const GameRubiks = lazy(() => import('@/pages/rubiks'));
const Profile = lazy(() => import('@/pages/Profile'));
const Shop = lazy(() => import('@/pages/Shop'));
const Characters = lazy(() => import('@/pages/Characters'));
const CharacterProfile = lazy(() => import('@/pages/CharacterProfile'));
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

function TrackedPage({
  gameId,
  children,
}: {
  gameId: string;
  children: ReactElement;
}) {
  return (
    <ArcadeSession key={gameId} gameId={gameId}>
      {children}
    </ArcadeSession>
  );
}

const App = () => {
  useEffect(() => {
    migrateLegacyArcadeStats();
  }, []);
  return (
    <BrowserRouter>
      <LocaleProvider>
        <CosmeticsProvider>
          <RankedNavigationGuard />
          <AchievementUnlockToast />
          <GrowthPointToast />
          <CoinsToast />
          <AffinityNotice />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/characters" element={<Characters />} />
              <Route path="/characters/:id" element={<CharacterProfile />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/category/:categoryId" element={<Category />} />
              <Route
                path="/game/mahjong-japanese"
                element={<GameMahjongJapanese />}
              />
              <Route
                path="/game/guess-number"
                element={
                  <TrackedPage gameId="guess-number">
                    <GameGuessNumber />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/tictactoe"
                element={
                  <TrackedPage gameId="tictactoe">
                    <GameTictactoe />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/memory"
                element={
                  <TrackedPage gameId="memory">
                    <GameMemory />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/2048"
                element={
                  <TrackedPage gameId="2048">
                    <Game2048 />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/snake"
                element={
                  <TrackedPage gameId="snake">
                    <GameSnake />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/breakout"
                element={
                  <TrackedPage gameId="breakout">
                    <GameBreakout />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/shooter"
                element={
                  <TrackedPage gameId="shooter">
                    <GameShooter />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/tank"
                element={
                  <TrackedPage gameId="tank">
                    <GameTank />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/tetris"
                element={
                  <TrackedPage gameId="tetris">
                    <GameTetris />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/rubiks"
                element={
                  <TrackedPage gameId="rubiks">
                    <GameRubiks />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/go"
                element={
                  <TrackedPage gameId="go">
                    <GameGo />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/gomoku"
                element={
                  <TrackedPage gameId="gomoku">
                    <GameGomoku />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/xiangqi"
                element={
                  <TrackedPage gameId="xiangqi">
                    <GameXiangqi />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/chess"
                element={
                  <TrackedPage gameId="chess">
                    <GameChess />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/doudizhu"
                element={
                  <TrackedPage gameId="doudizhu">
                    <GameDoudizhu />
                  </TrackedPage>
                }
              />
              <Route
                path="/game/shengji"
                element={
                  <TrackedPage gameId="shengji">
                    <GameShengji />
                  </TrackedPage>
                }
              />
            </Routes>
          </Suspense>
        </CosmeticsProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
};

export default App;
