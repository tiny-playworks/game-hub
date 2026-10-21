import { type ReactElement, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AchievementUnlockToast from '@/components/AchievementUnlockToast';
import CoinsToast from '@/components/CoinsToast';
import { AffinityNotice } from '@/components/characters/AffinityNotice';
import { HouseholdNotice } from '@/components/household/HouseholdNotice';
import GrowthPointToast from '@/components/GrowthPointToast';
import { VenueNavigation } from '@/components/layout/VenueNavigation';
import { RankedNavigationGuard } from '@/components/ranked/RankedNavigationGuard';
import { PageErrorBoundary } from '@/components/recovery/PageErrorBoundary';
import { StorageNotice } from '@/components/recovery/StorageNotice';
import { ArcadeSession } from '@/contexts/ArcadeContext';
import { HouseholdProvider, useHousehold } from '@/contexts/HouseholdContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { CosmeticsProvider } from '@/hooks/useCosmetics';
import { migrateLegacyArcadeStats } from '@/lib/achievements';
import { lazyPage } from '@/lib/lazyPage';
import Home from '@/pages/Home';
import './App.css';
import './cosmetics.css';
import './styles/venue.css';
import './styles/play-experience.css';
import './styles/riichi-venue.css';
import './styles/cosmetic-finish.css';

const Achievements = lazyPage(() => import('@/pages/Achievements'));
const Category = lazyPage(() => import('@/pages/Category'));
const Game2048 = lazyPage(() => import('@/pages/Game2048'));
const GameBreakout = lazyPage(() => import('@/pages/GameBreakout'));
const GameChess = lazyPage(() => import('@/pages/GameChess'));
const GameDoudizhu = lazyPage(() => import('@/pages/GameDoudizhu'));
const GameGo = lazyPage(() => import('@/pages/GameGo'));
const GameShengji = lazyPage(() => import('@/pages/GameShengji'));
const GameGomoku = lazyPage(() => import('@/pages/GameGomoku'));
const GameGuessNumber = lazyPage(() => import('@/pages/GameGuessNumber'));
const GameMahjongJapanese = lazyPage(() => import('@/pages/mahjong/japanese'));
const GameMemory = lazyPage(() => import('@/pages/GameMemory'));
const GameRubiks = lazyPage(() => import('@/pages/rubiks'));
const Profile = lazyPage(() => import('@/pages/Profile'));
const Shop = lazyPage(() => import('@/pages/Shop'));
const Characters = lazyPage(() => import('@/pages/Characters'));
const CharacterProfile = lazyPage(() => import('@/pages/CharacterProfile'));
const GameShooter = lazyPage(() => import('@/pages/GameShooter'));
const GameSnake = lazyPage(() => import('@/pages/GameSnake'));
const GameTank = lazyPage(() => import('@/pages/GameTank'));
const GameTetris = lazyPage(() => import('@/pages/GameTetris'));
const GameTictactoe = lazyPage(() => import('@/pages/GameTictactoe'));
const GameXiangqi = lazyPage(() => import('@/pages/GameXiangqi'));
const FamilyLobby = lazyPage(() => import('@/pages/FamilyLobby'));
const FamilyRoom = lazyPage(() => import('@/pages/FamilyRoom'));
const FamilyGameRoom = lazyPage(() => import('@/pages/FamilyGameRoom'));
const ReplayArchive = lazyPage(() => import('@/pages/ReplayArchive'));
const RiichiTraining = lazyPage(() => import('@/pages/RiichiTraining'));
const Journey = lazyPage(() => import('@/pages/Journey'));
const Leaderboard = lazyPage(() => import('@/pages/Leaderboard'));

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
  const { isLoading, currentMember } = useHousehold();
  if (isLoading) return <PageFallback />;
  return (
    <ArcadeSession
      key={`${gameId}:${currentMember?.id ?? 'guest'}`}
      gameId={gameId}
    >
      {children}
    </ArcadeSession>
  );
}

function HouseholdReady({ children }: { children: ReactElement }) {
  const { isLoading } = useHousehold();
  return isLoading ? <PageFallback /> : children;
}

const App = () => {
  useEffect(() => {
    migrateLegacyArcadeStats();
  }, []);
  return (
    <BrowserRouter>
      <HouseholdProvider>
        <LocaleProvider>
          <StorageNotice />
          <HouseholdNotice />
          <CosmeticsProvider>
            <VenueNavigation />
            <RankedNavigationGuard />
            <AchievementUnlockToast />
            <GrowthPointToast />
            <CoinsToast />
            <AffinityNotice />
            <PageErrorBoundary showStorageNotice={false}>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route
                    path="/family"
                    element={
                      <HouseholdReady>
                        <FamilyLobby />
                      </HouseholdReady>
                    }
                  />
                  <Route
                    path="/family/:roomId"
                    element={
                      <HouseholdReady>
                        <FamilyRoom />
                      </HouseholdReady>
                    }
                  />
                  <Route
                    path="/family/games/:roomId"
                    element={
                      <HouseholdReady>
                        <FamilyGameRoom />
                      </HouseholdReady>
                    }
                  />
                  <Route
                    path="/leaderboard"
                    element={
                      <HouseholdReady>
                        <Leaderboard />
                      </HouseholdReady>
                    }
                  />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/replays" element={<ReplayArchive />} />
                  <Route
                    path="/replays/training"
                    element={<RiichiTraining />}
                  />
                  <Route path="/journey" element={<Journey />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/characters" element={<Characters />} />
                  <Route
                    path="/characters/:id"
                    element={<CharacterProfile />}
                  />
                  <Route path="/achievements" element={<Achievements />} />
                  <Route path="/category/:categoryId" element={<Category />} />
                  <Route
                    path="/game/mahjong-japanese"
                    element={
                      <HouseholdReady>
                        <GameMahjongJapanese />
                      </HouseholdReady>
                    }
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
            </PageErrorBoundary>
          </CosmeticsProvider>
        </LocaleProvider>
      </HouseholdProvider>
    </BrowserRouter>
  );
};

export default App;
