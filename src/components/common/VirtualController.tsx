import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import type React from 'react';
import { cn } from '../../lib/utils';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type ActionType = 'A' | 'B';
export type ControllerTone = 'light' | 'dark';

interface VirtualControllerProps {
  onDirection?: (dir: Direction) => void;
  onDirectionEnd?: (dir: Direction) => void;
  onAction?: (action: ActionType) => void;
  onActionEnd?: (action: ActionType) => void;
  className?: string;
  showActions?: boolean;
  tone?: ControllerTone;
}

export function VirtualController({
  onDirection,
  onDirectionEnd,
  onAction,
  onActionEnd,
  className,
  showActions = true,
  tone = 'light',
}: VirtualControllerProps) {
  const buttonTone =
    tone === 'dark'
      ? 'bg-black/25 active:bg-black/40 border-black/10'
      : 'bg-white/20 active:bg-white/40 border-white/10';
  const iconTone = tone === 'dark' ? 'text-zinc-900' : 'text-white';

  // Use touch events to prevent default zooming/scrolling on mobile
  const handleDirection = (e: React.PointerEvent, dir: Direction) => {
    e.preventDefault();
    onDirection?.(dir);
  };

  const handleDirectionEnd = (e: React.PointerEvent, dir: Direction) => {
    e.preventDefault();
    onDirectionEnd?.(dir);
  };

  const handleAction = (e: React.PointerEvent, action: ActionType) => {
    e.preventDefault();
    onAction?.(action);
  };

  const handleActionEnd = (e: React.PointerEvent, action: ActionType) => {
    e.preventDefault();
    onActionEnd?.(action);
  };

  return (
    <div
      className={cn(
        'fixed bottom-8 left-0 right-0 z-50 flex justify-between px-6 pointer-events-none md:hidden',
        className,
      )}
    >
      {/* D-Pad (Left Side) */}
      <div className="relative w-36 h-36 pointer-events-auto opacity-70 hover:opacity-100 transition-opacity">
        <button
          type="button"
          onPointerDown={(e) => handleDirection(e, 'UP')}
          onPointerUp={(e) => handleDirectionEnd(e, 'UP')}
          onPointerCancel={(e) => handleDirectionEnd(e, 'UP')}
          onPointerLeave={(e) => handleDirectionEnd(e, 'UP')}
          className={cn(
            'absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 backdrop-blur-sm rounded-t-lg flex items-center justify-center border',
            buttonTone,
          )}
          aria-label="Up"
        >
          <ArrowUp className={cn('w-6 h-6', iconTone)} />
        </button>
        <button
          type="button"
          onPointerDown={(e) => handleDirection(e, 'LEFT')}
          onPointerUp={(e) => handleDirectionEnd(e, 'LEFT')}
          onPointerCancel={(e) => handleDirectionEnd(e, 'LEFT')}
          onPointerLeave={(e) => handleDirectionEnd(e, 'LEFT')}
          className={cn(
            'absolute top-1/2 left-0 -translate-y-1/2 w-12 h-12 backdrop-blur-sm rounded-l-lg flex items-center justify-center border',
            buttonTone,
          )}
          aria-label="Left"
        >
          <ArrowLeft className={cn('w-6 h-6', iconTone)} />
        </button>
        <button
          type="button"
          onPointerDown={(e) => handleDirection(e, 'RIGHT')}
          onPointerUp={(e) => handleDirectionEnd(e, 'RIGHT')}
          onPointerCancel={(e) => handleDirectionEnd(e, 'RIGHT')}
          onPointerLeave={(e) => handleDirectionEnd(e, 'RIGHT')}
          className={cn(
            'absolute top-1/2 right-0 -translate-y-1/2 w-12 h-12 backdrop-blur-sm rounded-r-lg flex items-center justify-center border',
            buttonTone,
          )}
          aria-label="Right"
        >
          <ArrowRight className={cn('w-6 h-6', iconTone)} />
        </button>
        <button
          type="button"
          onPointerDown={(e) => handleDirection(e, 'DOWN')}
          onPointerUp={(e) => handleDirectionEnd(e, 'DOWN')}
          onPointerCancel={(e) => handleDirectionEnd(e, 'DOWN')}
          onPointerLeave={(e) => handleDirectionEnd(e, 'DOWN')}
          className={cn(
            'absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 backdrop-blur-sm rounded-b-lg flex items-center justify-center border',
            buttonTone,
          )}
          aria-label="Down"
        >
          <ArrowDown className={cn('w-6 h-6', iconTone)} />
        </button>
        <div
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 backdrop-blur-sm border',
            buttonTone,
          )}
        />
      </div>

      {/* Action Buttons (Right Side) */}
      {showActions && (
        <div className="relative w-32 h-32 pointer-events-auto opacity-70 hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
          <button
            type="button"
            onPointerDown={(e) => handleAction(e, 'B')}
            onPointerUp={(e) => handleActionEnd(e, 'B')}
            onPointerCancel={(e) => handleActionEnd(e, 'B')}
            onPointerLeave={(e) => handleActionEnd(e, 'B')}
            className={cn(
              'w-14 h-14 rounded-full backdrop-blur-sm flex items-center justify-center border mt-12 font-bold text-xl',
              buttonTone,
              iconTone,
            )}
            aria-label="Action B"
          >
            B
          </button>
          <button
            type="button"
            onPointerDown={(e) => handleAction(e, 'A')}
            onPointerUp={(e) => handleActionEnd(e, 'A')}
            onPointerCancel={(e) => handleActionEnd(e, 'A')}
            onPointerLeave={(e) => handleActionEnd(e, 'A')}
            className={cn(
              'w-14 h-14 rounded-full backdrop-blur-sm flex items-center justify-center border mb-12 font-bold text-xl',
              buttonTone,
              iconTone,
            )}
            aria-label="Action A"
          >
            A
          </button>
        </div>
      )}
    </div>
  );
}
