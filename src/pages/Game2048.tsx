import { useCallback, useEffect } from 'react';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { Button } from '@/components/ui/button';
import { useArcade, useArcadeSnapshot } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';
import { VirtualController } from '../components/common/VirtualController';
import type { Dir } from '../hooks/use2048Engine';
import { useEngine2048 } from '../hooks/use2048Engine';
import { useScreenShake } from '../hooks/useScreenShake';
import './2048.css';

const Game2048 = () => {
  const { t } = useLocale();
  const { difficulty, paused, result, finish, restart } = useArcade();
  const size = difficulty === 'normal' ? 5 : difficulty === 'hard' ? 3 : 4;
  const { state, maxCombo, move, undo, canUndo } = useEngine2048(size);
  const maxTile = Math.max(
    0,
    ...Object.values(state.tiles).map((tile) => tile.value),
  );
  const shake = useScreenShake();

  useArcadeSnapshot(() => ({ ...state, maxTile, maxCombo, boardSize: size }));
  useEffect(() => {
    if (state.gameOver || maxTile >= 2048)
      finish(maxTile >= 2048 ? 'win' : 'lose', state.score, {
        maxTile,
        maxCombo,
      });
  }, [state.gameOver, state.score, maxTile, maxCombo, finish]);

  const tryMove = useCallback(
    (dir: Dir) => {
      if (paused || result) return;
      const { addedScore } = move(dir);
      if (addedScore >= 512) {
        shake();
      }
    },
    [move, shake, paused, result],
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
    <GameShell
      title={t('game.2048.name')}
      subtitle={t('game.2048.description')}
      status={<StatPill label={t('2048.score')} value={state.score} />}
      toolbar={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!canUndo || !!result || paused}
          >
            {t('2048.undo')}
          </Button>
          <Button variant="outline" size="sm" onClick={restart}>
            {t('2048.newGame')}
          </Button>
        </>
      }
    >
      <div className="w-full flex flex-col items-center pb-32 sm:pb-4">
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
            {Array.from({ length: size * size }).map((_, i) => (
              <div
                key={i}
                className="p-1 md:p-[6px]"
                style={{ width: `${100 / size}%`, height: `${100 / size}%` }}
              >
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
                    width: `${100 / size}%`,
                    height: `${100 / size}%`,
                    top: `${tile.r * (100 / size)}%`,
                    left: `${tile.c * (100 / size)}%`,
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

          <GameResultOverlay
            open={!!result}
            tone={maxTile >= 2048 ? 'win' : 'lose'}
            title={maxTile >= 2048 ? t('common.youWin') : t('2048.gameOver')}
            description={String(state.score) + ' ' + t('arcade.unit.points')}
            onRestart={restart}
          />
        </div>
      </div>

      <VirtualController
        onDirection={(dir) => tryMove(dir as Dir)}
        showActions={false}
        className="pb-safe"
        tone="dark"
      />
    </GameShell>
  );
};

export default Game2048;
