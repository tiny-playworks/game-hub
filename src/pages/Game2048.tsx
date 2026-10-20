import { RotateCcw, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GameProgress } from '@/components/game/GameProgress';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { Button } from '@/components/ui/button';
import { useArcade, useArcadeSnapshot } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';
import { useSwipeControls } from '@/hooks/useSwipeControls';
import { VirtualController } from '../components/common/VirtualController';
import type { Dir } from '../hooks/use2048Engine';
import { useEngine2048 } from '../hooks/use2048Engine';
import { useScreenShake } from '../hooks/useScreenShake';
import { arcadeChallengeGoal } from '../../shared/contracts/arcadeChallenge';
import { formatMessage } from '@/lib/i18n';
import './2048.css';

const Game2048 = () => {
  const { t, locale } = useLocale();
  const { difficulty, paused, result, finish, restart, mode } = useArcade();
  const size = difficulty === 'normal' ? 5 : difficulty === 'hard' ? 3 : 4;
  const { state, maxCombo, move, undo, canUndo } = useEngine2048(size);
  const maxTile = Math.max(
    0,
    ...Object.values(state.tiles).map((tile) => tile.value),
  );
  const shake = useScreenShake();
  const [gain, setGain] = useState({ value: 0, id: 0 });
  const [moves, setMoves] = useState(0);
  const [continuing, setContinuing] = useState(false);
  const [banking, setBanking] = useState(false);
  const challengeGoal = arcadeChallengeGoal('2048', difficulty);
  const challengeOver = mode === 'challenge' && (maxTile >= challengeGoal.target || moves >= challengeGoal.moves);
  const milestone = mode === 'classic' && maxTile >= 2048 && !continuing && !result;
  const emptyCells =
    size * size -
    Object.values(state.tiles).filter((tile) => !tile.mergedInto).length;
  const nextTarget = mode === 'challenge' ? challengeGoal.target : 2 ** Math.ceil(Math.log2(Math.max(4, maxTile + 1)));

  useArcadeSnapshot(() => ({ ...state, maxTile, maxCombo, boardSize: size }));
  useEffect(() => {
    if (state.gameOver || challengeOver)
      finish(maxTile >= 2048 ? 'win' : 'lose', state.score, {
        maxTile,
        maxCombo,
        moves,
      });
  }, [state.gameOver, state.score, maxTile, maxCombo, moves, challengeOver, finish]);

  const tryMove = useCallback(
    (dir: Dir) => {
      if (paused || result || milestone || banking || state.gameOver || challengeOver) return;
      const { addedScore, isMoved } = move(dir);
      if (isMoved) setMoves((count) => count + 1);
      if (addedScore > 0)
        setGain((previous) => ({ value: addedScore, id: previous.id + 1 }));
      if (addedScore >= 512) {
        shake();
      }
    },
    [move, shake, paused, result, milestone, banking, state.gameOver, challengeOver],
  );
  const swipe = useSwipeControls(tryMove);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
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
      status={<StatPill label={t('arcade.score')} value={state.score} />}
      toolbar={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!canUndo || !!result || paused || banking || state.gameOver || mode === 'challenge'}
          >
            <Undo2 className="size-4" />
            {t('arcade.undo')}
          </Button>
          <Button variant="outline" size="sm" onClick={restart}>
            <RotateCcw className="size-4" />
            {t('arcade.restart')}
          </Button>
        </>
      }
    >
      <div className="puzzle-2048 w-full flex flex-col items-center">
        {milestone ? <div className="game-milestone" role="status"><strong>{formatMessage(locale, 'play.tileMilestone', { target: 2048 })}</strong><div><Button disabled={banking} onClick={() => setContinuing(true)}>{t('play.continue2048')}</Button><Button variant="outline" disabled={banking} onClick={() => { setBanking(true); finish('win', state.score, { maxTile, maxCombo, moves }); }}>{t('play.finish2048')}</Button></div></div> : null}
        <GameProgress
          label={t('arcade.nextTarget')}
          value={nextTarget}
          current={maxTile}
          target={nextTarget}
          feedback={
            state.combo > 1 ? `${t('arcade.combo')} ×${state.combo}` : undefined
          }
        />

        <div
          className="puzzle-2048-board relative w-full aspect-square p-2 md:p-3 overflow-hidden"
          {...swipe}
        >
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

          {gain.value > 0 && (
            <span key={gain.id} className="puzzle-2048-gain" aria-hidden="true">
              +{gain.value}
            </span>
          )}

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
        <div className="arcade-session-note">
          <span>
            {t('arcade.combo')} <strong>×{state.combo}</strong>
          </span>
          <span>
            {size}×{size} · {t('arcade.emptyCells')} {emptyCells}
          </span>
          {mode === 'challenge' ? <span>{moves}/{challengeGoal.moves} {t('arcade.unit.moves')}</span> : null}
        </div>
      </div>

      <VirtualController
        onDirection={(dir) => tryMove(dir.toLowerCase() as Dir)}
        showActions={false}
        className="pb-safe"
        tone="dark"
      />
    </GameShell>
  );
};

export default Game2048;
