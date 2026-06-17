import { ArrowLeft, RotateCcw, Shuffle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '@/contexts/LocaleContext';
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
  scramble(): void;
}

interface RubiksEngineFactoryOptions {
  onBusyChange: (busy: boolean) => void;
  onStatusChange: (status: string) => void;
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
  const { t } = useLocale();
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RubiksEngineController | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('正在初始化');

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    if (!supportsWebGL() && createEngine === createDefaultEngine) {
      setStatus('设备不支持 WebGL，无法渲染 3D 场景');
      return;
    }

    const engine = createEngine(stage, {
      onBusyChange: setBusy,
      onStatusChange: setStatus,
    });
    engineRef.current = engine;
    setStatus('可操作');

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [createEngine]);

  return (
    <div className="rubiks-game">
      <header className="rubiks-toolbar">
        <Link to="/" className="rubiks-back">
          <ArrowLeft aria-hidden="true" />
          <span>{t('common.backToList')}</span>
        </Link>

        <h1>{t('game.rubiks.name')}</h1>

        <div className="rubiks-actions">
          <button
            type="button"
            aria-label={t('rubiks.scrambleAria')}
            disabled={busy}
            onClick={() => engineRef.current?.scramble()}
          >
            <Shuffle aria-hidden="true" />
            <span>{t('rubiks.scramble')}</span>
          </button>
          <button
            type="button"
            aria-label={t('rubiks.resetAria')}
            onClick={() => engineRef.current?.reset()}
          >
            <RotateCcw aria-hidden="true" />
            <span>{t('rubiks.reset')}</span>
          </button>
        </div>
      </header>

      <main className="rubiks-stage-shell">
        <div ref={stageRef} className="rubiks-stage" />
        <div className="rubiks-help" aria-live="polite">
          <span className="rubiks-status">{getStatusLabel(status, t)}</span>
          <span>{t('rubiks.help.drag')}</span>
          <i aria-hidden="true" />
          <span>{t('rubiks.help.rotate')}</span>
          <i aria-hidden="true" />
          <span>{t('rubiks.help.zoom')}</span>
        </div>
      </main>
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

export default GameRubiks;
