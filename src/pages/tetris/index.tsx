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
import { unlock } from '@/lib/achievements';
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
  const [state, setState] = useState<TetrisState>(() => stateRef.current);
  const { stats, updateHighScore } = useGameStore();
  const bestLines = stats.tetris?.highScore || 0;
  const [theme, setTheme] = useState<'glass' | 'neon'>('glass');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

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
      } else if (event.code === 'ShiftLeft' || event.code === 'KeyC') {
        event.preventDefault();
        dispatch({ type: 'hold' });
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="切换主题"
            onClick={() =>
              setTheme((current) => (current === 'glass' ? 'neon' : 'glass'))
            }
          >
            切换主题
          </Button>
        </div>
      </header>

      <main className="tetris-shell">
        <section
          className="tetris-stage"
          aria-label="3D 俄罗斯方块游戏舞台"
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
            <span>连击: {state.combo}</span>
            <span>
              技能能量: {state.skillEnergy}/{state.skillMax}
            </span>
            <span>暂存: {pieceLabel(state.heldPiece)}</span>
            <span>当前特效: {specialLabel(state.activeSpecial)}</span>
            <span>下个特效: {specialLabel(state.nextSpecial)}</span>
            <strong className="tetris-status">{statusText}</strong>
          </div>

          <div className="tetris-card tetris-skill-card">
            <div
              className="tetris-energy-bar"
              role="progressbar"
              aria-label="技能能量槽"
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
              aria-label="释放技能"
              disabled={!skillReady || state.status !== 'playing'}
              onClick={() => dispatch({ type: 'useSkill' })}
            >
              E 释放技能：清除底行
            </Button>
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
            方向键移动，向上旋转，向下加速，空格直接落底，Shift/C 暂存，E
            技能，P 暂停。移动端可滑动操作。
          </p>
        </aside>
      </main>

      <fieldset className="tetris-mobile-controls">
        <legend className="sr-only">移动端操作</legend>
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
            ? '开始'
            : state.status === 'paused'
              ? '继续'
              : state.status === 'over'
                ? '重开'
                : '暂停'}
        </Button>
        <Button
          variant={skillReady ? 'default' : 'outline'}
          size="sm"
          disabled={!skillReady || state.status !== 'playing'}
          onClick={() => dispatch({ type: 'useSkill' })}
        >
          技能
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status !== 'playing'}
          onClick={() => dispatch({ type: 'move', dx: -1 })}
        >
          左移
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status !== 'playing'}
          onClick={() => dispatch({ type: 'move', dx: 1 })}
        >
          右移
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status !== 'playing'}
          onClick={() => dispatch({ type: 'rotate', direction: 'cw' })}
        >
          旋转
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status !== 'playing'}
          onClick={() => dispatch({ type: 'softDrop' })}
        >
          下移
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status !== 'playing'}
          onClick={() => dispatch({ type: 'hardDrop' })}
        >
          硬降
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state.status !== 'playing'}
          onClick={() => dispatch({ type: 'hold' })}
        >
          暂存
        </Button>
      </fieldset>

      {state.pendingUpgradeChoices.length > 0 && (
        <div className="tetris-upgrade-layer" role="dialog" aria-modal="true">
          <div className="tetris-upgrade-panel">
            <h2>选择局内强化</h2>
            <p>每清除 10 行出现一次，最多几次轻量成长。</p>
            <div className="tetris-upgrade-options">
              {state.pendingUpgradeChoices.map((upgrade) => (
                <button
                  type="button"
                  key={upgrade}
                  onClick={() => dispatch({ type: 'chooseUpgrade', upgrade })}
                >
                  <strong>{upgradeLabel(upgrade)}</strong>
                  <span>{upgradeDescription(upgrade)}</span>
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

function pieceLabel(piece: number | null): string {
  if (piece === null) return '空';
  return ['I', 'O', 'T', 'S', 'Z', 'J', 'L'][piece] ?? '未知';
}

function specialLabel(special: TetrisSpecial | null): string {
  if (special === 'bomb') return '炸弹';
  if (special === 'ice') return '冰冻';
  if (special === 'wildcard') return '万能';
  return '普通';
}

function upgradeLabel(upgrade: TetrisUpgrade): string {
  return {
    score_boost: '消行得分 +20%',
    slow_fall: '下落速度降低',
    skill_boost: '技能能量 +25%',
    bomb_rate: '炸弹块频率提升',
    combo_boost: '连击倍率提升',
  }[upgrade];
}

function upgradeDescription(upgrade: TetrisUpgrade): string {
  return {
    score_boost: '让传统消行更有收益。',
    slow_fall: '给高层堆叠更多反应时间。',
    skill_boost: '更快攒满清底行技能。',
    bomb_rate: '低频特殊块更容易出现炸弹。',
    combo_boost: '连续消行时获得更高倍率。',
  }[upgrade];
}
