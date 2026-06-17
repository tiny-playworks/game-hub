import { ArrowLeft, RotateCcw, Shuffle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RubiksCubeEngine } from './RubiksCubeEngine';
import './rubiks.css';

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
          <span>返回游戏列表</span>
        </Link>

        <h1>3D 魔方</h1>

        <div className="rubiks-actions">
          <button
            type="button"
            aria-label="打乱魔方"
            disabled={busy}
            onClick={() => engineRef.current?.scramble()}
          >
            <Shuffle aria-hidden="true" />
            <span>打乱</span>
          </button>
          <button
            type="button"
            aria-label="重置魔方"
            onClick={() => engineRef.current?.reset()}
          >
            <RotateCcw aria-hidden="true" />
            <span>重置</span>
          </button>
        </div>
      </header>

      <main className="rubiks-stage-shell">
        <div ref={stageRef} className="rubiks-stage" />
        <div className="rubiks-help" aria-live="polite">
          <span className="rubiks-status">{status}</span>
          <span>单指/左键拖动转层</span>
          <i aria-hidden="true" />
          <span>双指/右键旋转视角</span>
          <i aria-hidden="true" />
          <span>滚轮/双指缩放</span>
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
