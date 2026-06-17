import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import type React from 'react';
import { cn } from '../../lib/utils';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type ActionType = 'A' | 'B';

interface VirtualControllerProps {
  onDirection?: (dir: Direction) => void;
  onAction?: (action: ActionType) => void;
  className?: string;
  showActions?: boolean;
}

export function VirtualController({
  onDirection,
  onAction,
  className,
  showActions = true,
}: VirtualControllerProps) {
  // Use touch events to prevent default zooming/scrolling on mobile
  const handleDirection = (
    e: React.TouchEvent | React.MouseEvent,
    dir: Direction,
  ) => {
    e.preventDefault();
    onDirection?.(dir);
  };

  const handleAction = (
    e: React.TouchEvent | React.MouseEvent,
    action: ActionType,
  ) => {
    e.preventDefault();
    onAction?.(action);
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
          className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-t-lg flex items-center justify-center active:bg-white/40 border border-white/10"
          aria-label="Up"
        >
          <ArrowUp className="text-white w-6 h-6" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => handleDirection(e, 'LEFT')}
          className="absolute top-1/2 left-0 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-l-lg flex items-center justify-center active:bg-white/40 border border-white/10"
          aria-label="Left"
        >
          <ArrowLeft className="text-white w-6 h-6" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => handleDirection(e, 'RIGHT')}
          className="absolute top-1/2 right-0 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-r-lg flex items-center justify-center active:bg-white/40 border border-white/10"
          aria-label="Right"
        >
          <ArrowRight className="text-white w-6 h-6" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => handleDirection(e, 'DOWN')}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-b-lg flex items-center justify-center active:bg-white/40 border border-white/10"
          aria-label="Down"
        >
          <ArrowDown className="text-white w-6 h-6" />
        </button>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm border border-white/10" />
      </div>

      {/* Action Buttons (Right Side) */}
      {showActions && (
        <div className="relative w-32 h-32 pointer-events-auto opacity-70 hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
          <button
            type="button"
            onPointerDown={(e) => handleAction(e, 'B')}
            className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:bg-white/40 border border-white/10 mt-12 text-white font-bold text-xl"
            aria-label="Action B"
          >
            B
          </button>
          <button
            type="button"
            onPointerDown={(e) => handleAction(e, 'A')}
            className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:bg-white/40 border border-white/10 mb-12 text-white font-bold text-xl"
            aria-label="Action A"
          >
            A
          </button>
        </div>
      )}
    </div>
  );
}
