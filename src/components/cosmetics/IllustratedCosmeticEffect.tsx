import { useEffect, useRef, useState } from 'react';
import {
  type CosmeticMotionAsset,
  loadCosmeticAtlas,
} from '@/lib/cosmeticMedia';

/** Plays painted frames; no per-frame React updates or procedural effect geometry. */
export function IllustratedCosmeticEffect({
  asset,
  id,
  kind,
  still,
  onComplete,
}: {
  asset: CosmeticMotionAsset;
  id: string;
  kind: 'riichi' | 'win';
  still: boolean;
  onComplete?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const completion = useRef(onComplete);
  const [status, setStatus] = useState<'loading' | 'playing' | 'ended' | 'failed'>(
    'loading',
  );

  useEffect(() => {
    completion.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (still) return;
    const context = canvas.current?.getContext('2d');
    let cancelled = false;
    let frameRequest = 0;
    let fallbackTimer = 0;
    setStatus('loading');

    const fallback = () => {
      if (cancelled) return;
      setStatus('failed');
      fallbackTimer = window.setTimeout(() => {
        if (!cancelled) completion.current?.();
      }, 350);
    };

    if (!context) {
      fallback();
    } else {
      void loadCosmeticAtlas(asset.atlas)
        .then((image) => {
          if (cancelled) return;
          setStatus('playing');
          const startedAt = performance.now();
          let previousFrame = -1;
          const step = (now: number) => {
            if (cancelled) return;
            const elapsed = now - startedAt;
            const index = Math.min(
              asset.frameCount - 1,
              Math.floor((elapsed / asset.durationMs) * asset.frameCount),
            );
            if (index !== previousFrame) {
              context.clearRect(0, 0, asset.frameSize, asset.frameSize);
              context.drawImage(
                image,
                (index % asset.columns) * asset.frameSize,
                Math.floor(index / asset.columns) * asset.frameSize,
                asset.frameSize,
                asset.frameSize,
                0,
                0,
                asset.frameSize,
                asset.frameSize,
              );
              previousFrame = index;
            }
            if (elapsed < asset.durationMs) {
              frameRequest = requestAnimationFrame(step);
            } else {
              setStatus('ended');
              completion.current?.();
            }
          };
          step(startedAt);
        })
        .catch(fallback);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRequest);
      window.clearTimeout(fallbackTimer);
    };
  }, [asset, still]);

  const showCanvas = !still && (status === 'playing' || status === 'ended');
  return (
    <span
      className="cosmetic-effect cosmetic-effect--illustrated"
      data-cosmetic-effect={id}
      data-kind={kind}
      data-state={still ? 'still' : status}
      aria-hidden="true"
    >
      <span className="cosmetic-motion-stage">
        <img
          className="cosmetic-motion-poster"
          src={asset.poster}
          width={asset.frameSize}
          height={asset.frameSize}
          alt=""
          decoding="async"
          hidden={showCanvas}
        />
        <canvas
          ref={canvas}
          width={asset.frameSize}
          height={asset.frameSize}
          hidden={!showCanvas}
        />
      </span>
    </span>
  );
}
