import { useEffect, useRef, useState } from 'react';
import {
  type CosmeticMotionAsset,
  type CosmeticMotionCue,
  loadCosmeticAtlas,
} from '@/lib/cosmeticMedia';

/** Plays painted frames; no per-frame React updates or procedural effect geometry. */
export function IllustratedCosmeticEffect({
  asset,
  id,
  kind,
  still,
  onComplete,
  onCue,
  onPlaybackStop,
}: {
  asset: CosmeticMotionAsset;
  id: string;
  kind: 'riichi' | 'win';
  still: boolean;
  onComplete?: () => void;
  onCue?: (cue: CosmeticMotionCue) => void;
  onPlaybackStop?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const completion = useRef(onComplete);
  const cue = useRef(onCue);
  const playbackStop = useRef(onPlaybackStop);
  const [status, setStatus] = useState<'loading' | 'playing' | 'ended' | 'failed'>(
    'loading',
  );

  useEffect(() => {
    completion.current = onComplete;
    cue.current = onCue;
    playbackStop.current = onPlaybackStop;
  }, [onComplete, onCue, onPlaybackStop]);

  useEffect(() => {
    if (still) return;
    const context = canvas.current?.getContext('2d');
    let cancelled = false;
    let frameRequest = 0;
    let fallbackTimer = 0;
    let completed = false;
    setStatus('loading');
    const complete = () => {
      if (cancelled || completed) return;
      completed = true;
      playbackStop.current?.();
      completion.current?.();
    };
    const visibility = () => {
      if (!document.hidden) return;
      cancelAnimationFrame(frameRequest);
      window.clearTimeout(fallbackTimer);
      complete();
      cancelled = true;
    };
    document.addEventListener('visibilitychange', visibility);

    const fallback = () => {
      if (cancelled) return;
      setStatus('failed');
      playbackStop.current?.();
      fallbackTimer = window.setTimeout(() => {
        complete();
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
          let markerIndex = 0;
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
              let reached: CosmeticMotionCue | undefined;
              while (markerIndex < asset.cues.length && asset.cues[markerIndex].frame <= index) {
                reached = asset.cues[markerIndex++];
              }
              // A delayed frame consumes old markers rather than playing a burst of stale sounds.
              if (reached) cue.current?.(reached);
            }
            if (elapsed < asset.durationMs) {
              frameRequest = requestAnimationFrame(step);
            } else {
              setStatus('ended');
              complete();
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
      document.removeEventListener('visibilitychange', visibility);
      playbackStop.current?.();
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
