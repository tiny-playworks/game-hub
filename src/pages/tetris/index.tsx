import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { unlock } from '@/lib/achievements';
import {
  applyTetrisAction,
  createInitialTetrisState,
  SHAPES,
  TETRIS_COLORS,
  type TetrisAction,
  type TetrisEvent,
  type TetrisState,
} from '@/lib/tetris';
import {
  Tetris3DEngine,
  type TetrisEngineController,
  type TetrisEngineFactoryOptions,
} from './Tetris3DEngine';
import './tetris.css';

const TETRIS_BEST_LINES_KEY = 'game-tetris-best-lines';
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
  const [state, setState] = useState<TetrisState>(() => stateRef.current);
  const [bestLines, setBestLines] = useState(() => readBestLines());

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
      localStorage?.setItem(TETRIS_BEST_LINES_KEY, String(state.lines));
      setBestLines(state.lines);
    }
    if (state.lines >= 10) unlock('tetris-10');
    if (state.lines >= 50) unlock('tetris-50');
    if (state.lines >= 100) unlock('tetris-100');
  }, [bestLines, state.lines]);

  const dispatch = useCallback(
    (action: TetrisAction) => {
      const events = commitAction(action);
      engineRef.current?.sync(stateRef.current, events);
    },
    [commitAction],
  );

  useEffect(() => {
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
      if (current.status !== 'playing') return;

      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        dispatch({ type: 'move', dx: -1 });
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        dispatch({ type: 'move', dx: 1 });
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        dispatch({ type: 'softDrop' });
      } else if (event.code === 'ArrowUp' || event.code === 'KeyX') {
        event.preventDefault();
        dispatch({ type: 'rotate', direction: 'cw' });
      } else if (event.code === 'KeyZ') {
        event.preventDefault();
        dispatch({ type: 'rotate', direction: 'ccw' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  const nextShape = useMemo(
    () => SHAPES[state.nextPiece][0],
    [state.nextPiece],
  );
  const statusText =
    state.status === 'idle'
      ? '按空格或点击舞台开始'
      : state.status === 'paused'
        ? '已暂停'
        : state.status === 'over'
          ? '游戏结束'
          : '游戏进行中';

  const togglePauseLabel = state.status === 'paused' ? '继续游戏' : '暂停游戏';

  return (
    <div className="tetris-game">
      <header className="tetris-toolbar">
        <Link to="/" className="tetris-back">
          ← 返回游戏列表
        </Link>
        <h1>3D 俄罗斯方块</h1>
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
            aria-label="重新开始"
            onClick={() => dispatch({ type: 'reset' })}
          >
            重新开始
          </Button>
        </div>
      </header>

      <main className="tetris-shell">
        <section className="tetris-stage" aria-label="3D 俄罗斯方块游戏舞台">
          <div ref={stageRef} className="absolute inset-0" />
          {state.status === 'idle' && (
            <button
              type="button"
              className="tetris-start-layer"
              onClick={() => dispatch({ type: 'start' })}
            >
              <span>按空格或点击舞台开始</span>
            </button>
          )}
        </section>

        <aside className="tetris-side" aria-label="俄罗斯方块状态">
          <div className="tetris-card tetris-stats">
            <span>得分: {state.score}</span>
            <span>等级: {state.level}</span>
            <span>消行: {state.lines}</span>
            <span>最高纪录: {bestLines}</span>
            <strong className="tetris-status">{statusText}</strong>
          </div>

          <div className="tetris-card">
            <p className="tetris-next-title">下一个方块</p>
            <div
              className="tetris-next-grid"
              role="img"
              aria-label="下一个方块预览"
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

          <p className="tetris-help">
            方向键移动，向上旋转，向下加速，空格直接落底，P 暂停。
          </p>
        </aside>
      </main>
    </div>
  );
};

function readBestLines(): number {
  if (typeof localStorage === 'undefined') return 0;
  return (
    Number.parseInt(localStorage.getItem(TETRIS_BEST_LINES_KEY) ?? '0', 10) || 0
  );
}

function supportsWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return Boolean(
    canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl'),
  );
}

export default GameTetris3D;
