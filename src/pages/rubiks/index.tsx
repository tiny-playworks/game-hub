import { RotateCcw, Shuffle, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { Button } from '@/components/ui/button';
import { useArcade, useArcadeSnapshot } from '@/contexts/ArcadeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { RubiksCubeEngine } from './RubiksCubeEngine';
import './rubiks.css';

const getStatusLabel = (status: string, t: (k: string) => string): string => {
  switch (status) {
    case '正在初始化':
      return t('rubiks.status.init');
    case '设备不支持 WebGL，无法渲染 3D 场景':
      return t('rubiks.webglError');
    case '可操作':
      return t('rubiks.status.ready');
    case '正在打乱':
      return t('rubiks.status.scrambling');
    case '已复原':
      return t('rubiks.status.solved');
    case '转动中':
      return t('rubiks.status.turning');
    case '自动对齐':
      return t('rubiks.status.aligning');
    case '打乱完成':
      return t('rubiks.status.scrambled');
    default:
      return status;
  }
};

export interface RubiksEngineController {
  dispose(): void;
  reset(): void;
  scramble(moves?: number): void;
  setPaused?(paused: boolean): void;
  getSnapshot?(): unknown;
  undo(): void;
  getMoveCount(): number;
}

interface RubiksEngineFactoryOptions {
  onBusyChange: (busy: boolean) => void;
  onStatusChange: (status: string) => void;
  onMoveCountChange: (count: number) => void;
  onSolvedChange: (solved: boolean) => void;
}

type RubiksEngineFactory = (
  host: HTMLElement,
  options: RubiksEngineFactoryOptions,
) => RubiksEngineController;

interface GameRubiksProps {
  createEngine?: RubiksEngineFactory;
}

const createDefaultEngine: RubiksEngineFactory = (host, options) =>
  new RubiksCubeEngine(host, options);

const GameRubiks = ({
  createEngine = createDefaultEngine,
}: GameRubiksProps) => {
  const { locale, t } = useLocale();
  const arcade = useArcade();
  const { difficulty, paused, result, finish, newRound } = arcade;
  const scrambleLength =
    difficulty === 'easy' ? 5 : difficulty === 'hard' ? 25 : 12;
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const active = useRef(false);
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RubiksEngineController | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('正在初始化');
  const [moveCount, setMoveCount] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    if (!supportsWebGL() && createEngine === createDefaultEngine) {
      setStatus('设备不支持 WebGL，无法渲染 3D 场景');
      return;
    }

    const engine = createEngine(stage, {
      onBusyChange: setBusy,
      onStatusChange: (value) => {
        setStatus(value);
        if (value === '打乱完成') active.current = true;
      },
      onMoveCountChange: setMoveCount,
      onSolvedChange: (solved) => {
        if (solved && active.current) {
          active.current = false;
          finishRef.current('win', Math.max(1, elapsedRef.current), {
            scrambleMoves: scrambleLength,
          });
        }
      },
    });
    engineRef.current = engine;
    setStatus('可操作');
    setMoveCount(engine.getMoveCount());

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [createEngine, scrambleLength]);

  useEffect(() => {
    engineRef.current?.setPaused?.(paused);
  }, [paused]);
  useEffect(() => {
    if (paused || result) return;
    const timer = window.setInterval(() => {
      if (active.current) {
        elapsedRef.current++;
        setElapsed(elapsedRef.current);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [paused, result]);
  useArcadeSnapshot(() => ({
    status,
    busy,
    moveCount,
    elapsed,
    scrambleLength,
    cube: engineRef.current?.getSnapshot?.(),
  }));
  const scramble = () => {
    if (paused || busy) return;
    active.current = false;
    newRound();
    elapsedRef.current = 0;
    setElapsed(0);
    engineRef.current?.scramble(scrambleLength);
    arcade.start();
  };
  const reset = () => {
    active.current = false;
    newRound();
    elapsedRef.current = 0;
    setElapsed(0);
    engineRef.current?.reset();
  };
  return (
    <GameShell
      autoStart={false}
      title={t('game.rubiks.name')}
      subtitle={t('game.rubiks.description')}
      status={
        <>
          <StatPill label={t('arcade.unit.seconds')} value={elapsed} />
        </>
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {formatMessage(locale, 'rubiks.moves', { count: moveCount })}
          </span>
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label={t('rubiks.undoAria')}
            disabled={paused || busy || moveCount === 0}
            onClick={() => engineRef.current?.undo()}
          >
            <Undo2 aria-hidden="true" />
            <span>{t('rubiks.undo')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label={t('rubiks.scrambleAria')}
            disabled={paused || busy}
            onClick={scramble}
          >
            <Shuffle aria-hidden="true" />
            <span>{t('rubiks.scramble')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label={t('rubiks.resetAria')}
            onClick={reset}
          >
            <RotateCcw aria-hidden="true" />
            <span>{t('rubiks.reset')}</span>
          </Button>
        </div>
      }
    >
      <div
        className="rubiks-stage-shell relative w-full overflow-hidden rounded-2xl"
        style={{ display: 'block', height: 'min(60dvh, 620px)' }}
      >
        <div ref={stageRef} className="rubiks-stage h-full w-full" />
        <GameResultOverlay
          open={!!result}
          tone="win"
          title={t('rubiks.status.solved')}
          description={`${elapsed} ${t('arcade.unit.seconds')}`}
          onRestart={arcade.restart}
        />
        <div className="rubiks-help" aria-live="polite">
          <span className="rubiks-status">{getStatusLabel(status, t)}</span>
          <span>{t('rubiks.help.drag')}</span>
          <i aria-hidden="true" />
          <span>{t('rubiks.help.rotate')}</span>
          <i aria-hidden="true" />
          <span>{t('rubiks.help.zoom')}</span>
        </div>
      </div>
    </GameShell>
  );
};

function supportsWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return Boolean(
    canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl'),
  );
}

export default GameRubiks;
