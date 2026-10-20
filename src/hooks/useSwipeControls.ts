import { type PointerEvent, useRef } from 'react';

type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export function useSwipeControls(
  onDirection: (direction: SwipeDirection) => void,
  continuous = false,
) {
  const gesture = useRef<{
    x: number;
    y: number;
    id: number;
    used: boolean;
  } | null>(null);
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (
        event.target instanceof Element &&
        event.target.closest('button, a, input, select, [role="alertdialog"]')
      )
        return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      gesture.current = {
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId,
        used: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const start = gesture.current;
      if (!start || start.id !== event.pointerId || start.used) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      onDirection(
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? 'right'
            : 'left'
          : dy > 0
            ? 'down'
            : 'up',
      );
      gesture.current = {
        x: event.clientX,
        y: event.clientY,
        id: start.id,
        used: !continuous,
      };
    },
    onPointerUp() {
      gesture.current = null;
    },
    onPointerCancel() {
      gesture.current = null;
    },
    onLostPointerCapture() {
      gesture.current = null;
    },
  };
}
