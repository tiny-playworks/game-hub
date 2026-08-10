import {
  type TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { unlock } from '@/lib/achievements';
import { formatMessage } from '@/lib/i18n';
import {
  applyTetrisAction,
  createInitialTetrisState,
  SHAPES,
  TETRIS_COLORS,
  type TetrisAction,
  type TetrisEvent,
  type TetrisSpecial,
  type TetrisState,
  type TetrisUpgrade,
} from '@/lib/tetris';
import {
  createDasArrState,
  DEFAULT_DAS_ARR,
  dasArrOnKeyDown,
  dasArrOnKeyUp,
  dasArrTick,
  type HorizontalDir,
} from '@/lib/tetrisDas';
import { useGameStore } from '@/store/gameStore';
import {
  Tetris3DEngine,
  type TetrisEngineController,
  type TetrisEngineFactoryOptions,
} from './Tetris3DEngine';
import './tetris.css';

const TICK_MS = 1000 / 60;

type TetrisEngineFactory = (
  host: HTMLElement,
  options: TetrisEngineFactoryOptions,
) => TetrisEngineController;

interface GameTetris3DProps {
  createEngine?: TetrisEngineFactory;
}

const createNoopEngine = (): TetrisEngineController => ({
  dispose() {},
  setTheme() {},
  sync() {},
});

const createDefaultEngine: TetrisEngineFactory = (host, options) => {
  if (!supportsWebGL()) return createNoopEngine();
  return new Tetris3DEngine(host, options);
};

const GameTetris3D = ({
  createEngine = createDefaultEngine,
}: GameTetris3DProps) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TetrisEngineController | null>(null);
  const stateRef = useRef<TetrisState>(createInitialTetrisState());
  const { locale, t } = useLocale();
  const [state, setState] = useState<TetrisState>(() => stateRef.current);
  const { stats, updateHighScore } = useGameStore();
  const bestLines = stats.tetris?.highScore || 0;
  const [theme, setTheme] = useState<'glass' | 'neon'>('glass');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const dasRef = useRef(createDasArrState());
  const dasLastTimeRef = useRef(0);

  const commitAction = useCallback((action: TetrisAction): TetrisEvent[] => {
    const result = applyTetrisAction(stateRef.current, action);
    stateRef.current = result.state;
    setState(result.state);
    return result.events;
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const engine = createEngine(stage, {});
    engineRef.current = engine;
    engine.sync(stateRef.current, [{ type: 'reset' }]);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [createEngine]);

  useEffect(() => {
    engineRef.current?.sync(state, []);
  }, [state]);

  useEffect(() => {
    engineRef.current?.setTheme?.(theme);
  }, [theme]);

  useEffect(() => {
    if (state.status !== 'playing') return;
    const id = window.setInterval(() => {
      const events = commitAction({ type: 'tick' });
      engineRef.current?.sync(stateRef.current, events);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [state.status, commitAction]);

  useEffect(() => {
    if (state.lines <= 0) return;
    if (state.lines > bestLines) {
      updateHighScore('tetris', state.lines);
    }
    if (state.lines >= 10) unlock('tetris-10');
    if (state.lines >= 50) unlock('tetris-50');
    if (state.lines >= 100) unlock('tetris-100');
  }, [bestLines, state.lines, updateHighScore]);

  const dispatch = useCallback(
    (action: TetrisAction) => {
      const events = commitAction(action);
      engineRef.current?.sync(stateRef.current, events);
    },
    [commitAction],
  );

  useEffect(() => {
    const applyHorizontal = (dir: HorizontalDir) => {
      const result = dasArrOnKeyDown(dasRef.current, dir);
      dasRef.current = result.state;
      if (result.fire) dispatch({ type: 'move', dx: dir });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const current = stateRef.current;
      if (event.code === 'Space') {
        event.preventDefault();
        dispatch(
          current.status === 'idle' ? { type: 'start' } : { type: 'hardDrop' },
        );
        return;
      }
      if (event.code === 'KeyP') {
        event.preventDefault();
        dispatch({ type: 'togglePause' });
        return;
      }
      if (event.code === 'KeyE') {
        event.preventDefault();
        dispatch({ type: 'useSkill' });
        return;
      }
      if (current.status !== 'playing') return;

      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        applyHorizontal(-1);
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        applyHorizontal(1);
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        dispatch({ type: 'softDrop' });
      } else if (event.code === 'ArrowUp' || event.code === 'KeyX') {
        event.preventDefault();
        dispatch({ type: 'rotate', direction: 'cw' });
      } else if (event.code === 'KeyZ') {
        event.preventDefault();
        dispatch({ type: 'rotate', direction: 'ccw' });
      } else if (event.code === 'ShiftLeft' || event.code === 'KeyC') {
        event.preventDefault();
        dispatch({ type: 'hold' });
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft') {
        dasRef.current = dasArrOnKeyUp(dasRef.current, -1);
      } else if (event.code === 'ArrowRight') {
        dasRef.current = dasArrOnKeyUp(dasRef.current, 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [dispatch]);

  useEffect(() => {
    if (state.status !== 'playing') {
      dasRef.current = createDasArrState();
      dasLastTimeRef.current = 0;
      return;
    }

    let rafId = 0;
    const loop = (time: number) => {
      const last = dasLastTimeRef.current || time;
      const dt = Math.min(time - last, 50);
      dasLastTimeRef.current = time;
      if (dasRef.current.held !== null) {
        const result = dasArrTick(dasRef.current, dt, DEFAULT_DAS_ARR);
        dasRef.current = result.state;
        for (let i = 0; i < result.fires; i++) {
          dispatch({ type: 'move', dx: result.state.held ?? 0 });
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [state.status, dispatch]);

  const nextShape = useMemo(
    () => SHAPES[state.nextPiece][0],
    [state.nextPiece],
  );
  const statusText =
    state.status === 'idle'
      ? t('tetris.startTip')
      : state.status === 'paused'
        ? t('shooter.paused')
        : state.status === 'over'
          ? t('2048.gameOver')
          : t('tetris.status.playing');

  const togglePauseLabel =
    state.status === 'paused' ? t('shooter.btnResume') : t('shooter.btnPause');
  const skillReady = state.skillEnergy >= state.skillMax;

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < 28) return;
    if (absX > absY) {
      dispatch({ type: 'move', dx: dx > 0 ? 1 : -1 });
    } else if (dy < 0) {
      dispatch({ type: 'rotate', direction: 'cw' });
    } else {
      dispatch({ type: 'hardDrop' });
    }
  };

  return (
    <div className={`tetris-game tetris-theme-${theme}`}>
      <header className="tetris-toolbar">
        <Link to="/" className="tetris-back">
          ← {t('common.backToList')}
        </Link>
        <h1>{t('game.tetris.name')}</h1>
        <div className="tetris-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={togglePauseLabel}
            disabled={state.status === 'idle' || state.status === 'over'}
            onClick={() => dispatch({ type: 'togglePause' })}
          >
            {togglePauseLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t('common.restart')}
            onClick={() => dispatch({ type: 'reset' })}
          >
            {t('common.restart')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t('tetris.toggleTheme')}
            onClick={() =>
              setTheme((current) => (current === 'glass' ? 'neon' : 'glass'))
            }
          >
            {t('tetris.toggleTheme')}
          </Button>
        </div>
      </header>

      <main className="tetris-shell">
        <section
          className="tetris-stage"
          aria-label={t('tetris.stageAria')}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div ref={stageRef} className="absolute inset-0" />
          {state.status === 'idle' && (
            <button
              type="button"
              className="tetris-start-layer"
              onClick={() => dispatch({ type: 'start' })}
            >
              <span>{t('tetris.startTip')}</span>
            </button>
          )}
        </section>

        <aside className="tetris-side" aria-label={t('category.mini.name')}>
          <div className="tetris-card tetris-stats">
            <span>
              {formatMessage(locale, 'tetris.score', { score: state.score })}
            </span>
            <span>
              {formatMessage(locale, 'tetris.level', { level: state.level })}
            </span>
            <span>
              {formatMessage(locale, 'tetris.lines', { lines: state.lines })}
            </span>
            <span>
              {formatMessage(locale, 'tetris.bestLines', { lines: bestLines })}
            </span>
            <span>
              {formatMessage(locale, 'tetris.combo', { combo: state.combo })}
            </span>
            <span>
              {formatMessage(locale, 'tetris.energy', {
                current: state.skillEnergy,
                max: state.skillMax,
              })}
            </span>
            <span>
              {formatMessage(locale, 'tetris.hold', {
                piece: pieceLabel(state.heldPiece, t),
              })}
            </span>
            <span>
              {formatMessage(locale, 'tetris.activeSpecial', {
                special: specialLabel(state.activeSpecial, t),
              })}
            </span>
            <span>
              {formatMessage(locale, 'tetris.nextSpecial', {
                special: specialLabel(state.nextSpecial, t),
              })}
            </span>
            <strong className="tetris-status">{statusText}</strong>
          </div>

          <div className="tetris-card tetris-skill-card">
            <div
              className="tetris-energy-bar"
              role="progressbar"
              aria-label={t('tetris.energyAria')}
              aria-valuemin={0}
              aria-valuemax={state.skillMax}
              aria-valuenow={state.skillEnergy}
            >
              <i
                style={{
                  width: `${Math.min(100, (state.skillEnergy / state.skillMax) * 100)}%`,
                }}
              />
            </div>
            <Button
              type="button"
              variant={skillReady ? 'default' : 'outline'}
              size="sm"
              aria-label={t('tetris.skillAria')}
              disabled={!skillReady || state.status !== 'playing'}
              onClick={() => dispatch({ type: 'useSkill' })}
            >
              {t('tetris.skillBtn')}
            </Button>
          </div>

          <div className="tetris-card">
            <p className="tetris-next-title">{t('tetris.nextBlock')}</p>
            <div
              className="tetris-next-grid"
              role="img"
              aria-label={t('tetris.nextBlockAria')}
            >
              {nextShape.flatMap((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <i
                    key={`${rowIndex}-${colIndex}`}
                    className={`tetris-next-cell${cell ? ' is-filled' : ''}`}
                    style={
                      cell
                        ? {
                            backgroundColor: TETRIS_COLORS[state.nextPiece + 1],
                          }
                        : undefined
                    }
                  />
                )),
              )}
            </div>
          </div>

          <p className="tetris-help">{t('tetris.help')}</p>
        </aside>
      </main>

      <fieldset className="tetris-mobile-controls">
        <legend className="sr-only">{t('category.mini.name')}</legend>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            dispatch(
              state.status === 'idle'
                ? { type: 'start' }
                : state.status === 'over'
                  ? { type: 'reset' }
                  : { type: 'togglePause' },
            )
          }
        >
          {state.status === 'idle'
            ? t('common.start')
            : state.status === 'paused'
              ? t('shooter.btnResume')
              : state.status === 'over'
                ? t('common.restart')
                : t('shooter.btnPause')}
        </Button>
        <Button
          variant={skillReady ? 'default' : 'outline'}
          size="sm"
          disabled={!skillReady || state.status !== 'playing'}
          onClick={() => dispatch({ type: 'useSkill' })}
        >
          {t('tetris.mobile.skill')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status !== 'playing'}
          onClick={() => dispatch({ type: 'move', dx: -1 })}
        >
          {t('tetris.mobile.left')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status !== 'playing'}
          onClick={() => dispatch({ type: 'move', dx: 1 })}
        >
          {t('tetris.mobile.right')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status !== 'playing'}
          onClick={() => dispatch({ type: 'rotate', direction: 'cw' })}
        >
          {t('tetris.mobile.rotate')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status !== 'playing'}
          onClick={() => dispatch({ type: 'softDrop' })}
        >
          {t('tetris.mobile.down')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status !== 'playing'}
          onClick={() => dispatch({ type: 'hardDrop' })}
        >
          {t('tetris.mobile.hardDrop')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status !== 'playing'}
          onClick={() => dispatch({ type: 'hold' })}
        >
          {t('tetris.mobile.hold')}
        </Button>
      </fieldset>

      {state.pendingUpgradeChoices.length > 0 && (
        <div className="tetris-upgrade-layer" role="dialog" aria-modal="true">
          <div className="tetris-upgrade-panel">
            <h2>{t('tetris.upgradeTitle')}</h2>
            <p>{t('tetris.upgradeDesc')}</p>
            <div className="tetris-upgrade-options">
              {state.pendingUpgradeChoices.map((upgrade) => (
                <button
                  type="button"
                  key={upgrade}
                  onClick={() => dispatch({ type: 'chooseUpgrade', upgrade })}
                >
                  <strong>{upgradeLabel(upgrade, t)}</strong>
                  <span>{upgradeDescription(upgrade, t)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function supportsWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return Boolean(
    canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl'),
  );
}

export default GameTetris3D;

function pieceLabel(piece: number | null, t: (k: string) => string): string {
  if (piece === null) return t('tetris.piece.empty');
  return (
    ['I', 'O', 'T', 'S', 'Z', 'J', 'L'][piece] ?? t('tetris.piece.unknown')
  );
}

function specialLabel(
  special: TetrisSpecial | null,
  t: (k: string) => string,
): string {
  if (special === 'bomb') return t('tetris.special.bomb');
  if (special === 'ice') return t('tetris.special.ice');
  if (special === 'wildcard') return t('tetris.special.wildcard');
  return t('tetris.special.normal');
}

function upgradeLabel(
  upgrade: TetrisUpgrade,
  t: (k: string) => string,
): string {
  return {
    score_boost: t('tetris.upgrade.score_boost.label'),
    slow_fall: t('tetris.upgrade.slow_fall.label'),
    skill_boost: t('tetris.upgrade.skill_boost.label'),
    bomb_rate: t('tetris.upgrade.bomb_rate.label'),
    combo_boost: t('tetris.upgrade.combo_boost.label'),
  }[upgrade];
}

function upgradeDescription(
  upgrade: TetrisUpgrade,
  t: (k: string) => string,
): string {
  return {
    score_boost: t('tetris.upgrade.score_boost.desc'),
    slow_fall: t('tetris.upgrade.slow_fall.desc'),
    skill_boost: t('tetris.upgrade.skill_boost.desc'),
    bomb_rate: t('tetris.upgrade.bomb_rate.desc'),
    combo_boost: t('tetris.upgrade.combo_boost.desc'),
  }[upgrade];
}
