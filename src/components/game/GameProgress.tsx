import type { ReactNode } from 'react';

export function GameProgress({
  label,
  value,
  current,
  target,
  feedback,
}: {
  label: string;
  value?: ReactNode;
  current: number;
  target: number;
  feedback?: ReactNode;
}) {
  const percent = Math.min(
    100,
    Math.max(0, (current / Math.max(1, target)) * 100),
  );
  return (
    <div className="game-progress">
      <div className="game-progress-copy">
        <span>{label}</span>
        <strong>{value ?? `${current} / ${target}`}</strong>
        {feedback && (
          <span className="game-progress-feedback" role="status">
            {feedback}
          </span>
        )}
      </div>
      <div
        className="game-progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(target, Math.max(0, current))}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
