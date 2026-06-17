import { useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';
import { VirtualController } from '../components/common/VirtualController';
import type { Dir } from '../hooks/use2048Engine';
import { useEngine2048 } from '../hooks/use2048Engine';
import { useScreenShake } from '../hooks/useScreenShake';
import { useGameStore } from '../store/gameStore';
import './2048.css';

const Game2048 = () => {
  const { t } = useLocale();
  const { state, maxCombo, move, undo, initGame, canUndo } = useEngine2048();
  const shake = useScreenShake();

  const { stats, updateHighScore, updateMaxCombo } = useGameStore();
  const gameStats = stats['2048'] || {
    highScore: 0,
    playCount: 0,
    maxCombo: 0,
  };

  useEffect(() => {
    if (state.score > gameStats.highScore) {
      updateHighScore('2048', state.score);
    }
  }, [state.score, gameStats.highScore, updateHighScore]);

  useEffect(() => {
    if (maxCombo > gameStats.maxCombo) {
      updateMaxCombo('2048', maxCombo);
    }
  }, [maxCombo, gameStats.maxCombo, updateMaxCombo]);

  const tryMove = useCallback(
    (dir: Dir) => {
      const { addedScore } = move(dir);
      if (addedScore >= 512) {
        shake();
      }
    },
    [move, shake],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (state.gameOver) return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          tryMove('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          tryMove('right');
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          tryMove('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          tryMove('down');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.gameOver, tryMove]);

  const getTileClass = (value: number) => {
    if (value <= 2048) return `tile-${value}`;
    return 'tile-super';
  };

  return (
    <div className="min-h-screen bg-[#faf8ef] dark:bg-[#1a1a1a] text-[#776e65] dark:text-[#f9f6f2]">
      <header className="flex items-center justify-between border-b border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-md px-4 py-3 sticky top-0 z-10">
        <Link
          to="/"
          className="text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white transition-colors font-medium"
        >
          ← {t('common.backToList')}
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <div className="bg-[#bbada0] dark:bg-[#333] text-white rounded-md px-3 py-1 text-center">
              <div className="text-[10px] uppercase font-bold text-[#eee4da] dark:text-white/70">
                分数:
              </div>
              <div className="font-bold leading-none">{state.score}</div>
            </div>
            <div className="bg-[#bbada0] dark:bg-[#333] text-white rounded-md px-3 py-1 text-center">
              <div className="text-[10px] uppercase font-bold text-[#eee4da] dark:text-white/70">
                最佳:
              </div>
              <div className="font-bold leading-none">
                {Math.max(state.score, gameStats.highScore)}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-64px)] pb-32">
        <div className="flex w-full max-w-[340px] sm:max-w-[400px] justify-between items-end mb-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#776e65] dark:text-white/90">
              2048
            </h1>
            <p className="text-sm mt-1 opacity-70">
              方向键移动，相同数字合并，努力拼出 <strong>2048</strong>。
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={!canUndo || state.gameOver}
              className="bg-[#8f7a66] hover:bg-[#9f8b77] text-white border-none font-bold"
            >
              撤销
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={initGame}
              className="bg-[#8f7a66] hover:bg-[#9f8b77] text-white border-none font-bold"
            >
              新游戏
            </Button>
          </div>
        </div>

        {/* Combo Banner */}
        <div className="h-6 mb-2">
          {state.combo > 1 && (
            <div className="text-[#f67c5f] font-bold text-lg animate-pop-in">
              {state.combo} Combo!
            </div>
          )}
        </div>

        <div className="relative w-full max-w-[340px] sm:max-w-[400px] aspect-square bg-[#bbada0] dark:bg-[#2a2a2a] rounded-lg p-2 md:p-3 overflow-hidden shadow-2xl">
          {/* Background grid */}
          <div className="absolute inset-2 md:inset-3 flex flex-wrap">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="w-[25%] h-[25%] p-1 md:p-[6px]">
                <div className="w-full h-full bg-[#cdc1b4] dark:bg-[#3a3a3a] rounded-md md:rounded-lg" />
              </div>
            ))}
          </div>

          {/* Active tiles */}
          <div className="absolute inset-2 md:inset-3">
            {Object.values(state.tiles).map((tile) => {
              // Ensure destroyed merged tiles are rendered BELOW the new tile
              const zIndex = tile.mergedInto
                ? 10
                : tile.isNew || tile.isMerged
                  ? 30
                  : 20;

              // use window to avoid SSR issue, but fallback cleanly
              const pad =
                typeof window !== 'undefined' && window.innerWidth >= 768
                  ? '6px'
                  : '4px';

              return (
                <div
                  key={tile.id}
                  className="absolute transition-all duration-150 ease-in-out"
                  style={{
                    width: '25%',
                    height: '25%',
                    top: `${tile.r * 25}%`,
                    left: `${tile.c * 25}%`,
                    padding: pad,
                    zIndex,
                  }}
                >
                  <div
                    className={cn(
                      'w-full h-full flex items-center justify-center rounded-md md:rounded-lg text-2xl sm:text-3xl font-extrabold shadow-sm',
                      getTileClass(tile.value),
                      tile.isNew ? 'animate-pop-in' : '',
                      tile.isMerged ? 'animate-merge-pop' : '',
                    )}
                  >
                    {tile.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Game Over Overlay */}
          {state.gameOver && (
            <div className="absolute inset-0 bg-[#eee4da]/70 dark:bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-pop-in">
              <h2 className="text-4xl font-extrabold text-[#776e65] dark:text-white mb-4">
                游戏结束
              </h2>
              <Button
                onClick={initGame}
                size="lg"
                className="bg-[#8f7a66] hover:bg-[#9f8b77] text-white font-bold text-lg px-8 py-6 rounded-xl border-none"
              >
                再来一局
              </Button>
            </div>
          )}
        </div>
      </main>

      <VirtualController
        onDirection={(dir) => tryMove(dir as Dir)}
        showActions={false}
        className="pb-safe"
        tone="dark"
      />
    </div>
  );
};

export default Game2048;
