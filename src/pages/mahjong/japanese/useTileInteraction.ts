import { useCallback, useEffect, useRef, useState } from 'react';

export type TileInteractionOptions = {
  handItems: readonly { tile: number; key: string }[];
  discardable: readonly number[];
  canDiscard: boolean;
  riichiSelecting: boolean;
  isMyClaim: boolean;
  enabled: boolean;
  decisionKey?: string | number | null;
  singleClickDiscard?: boolean;
  onDiscard: (tile: number) => void;
  onCancelRiichi: () => void;
  onPassClaim: () => void;
  onActionShortcut?: (key: string) => boolean | void;
};

export type TileTouchProps = {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent, key: string, tile: number) => void;
};

export function useTileInteraction({
  handItems,
  discardable,
  canDiscard,
  riichiSelecting,
  isMyClaim,
  enabled,
  decisionKey,
  singleClickDiscard = false,
  onDiscard,
  onCancelRiichi,
  onPassClaim,
  onActionShortcut,
}: TileInteractionOptions) {
  const [selection, setSelection] = useState<{
    key: string;
    tile: number;
    decision: TileInteractionOptions['decisionKey'];
  } | null>(null);
  const currentSelection = enabled && selection?.decision === decisionKey ? selection : null;
  const selectedKey = currentSelection?.key ?? null;
  const selectedTile = currentSelection?.tile ?? null;

  // Auto-clear selection if no longer allowed to discard or tile is invalid
  useEffect(() => {
    if (!canDiscard || !enabled) {
      setSelection(null);
      return;
    }
    if (selectedTile !== null && !discardable.includes(selectedTile)) {
      setSelection(null);
    }
  }, [canDiscard, enabled, discardable, selectedTile]);

  useEffect(() => {
    setSelection(null);
  }, [decisionKey]);

  // Touch gesture scroll safety: finger movement > 10px cancels tap
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isTouchScrolling = useRef(false);
  const lastTouchTime = useRef(0);

  const selectTile = useCallback(
    (key: string, tile: number, source?: 'click' | 'touch') => {
      if (source === 'click' && Date.now() - lastTouchTime.current < 650) {
        return;
      }
      if (!enabled || !canDiscard || !discardable.includes(tile)) return;
      if (singleClickDiscard && !riichiSelecting && source === 'click') {
        onDiscard(tile);
        setSelection(null);
        return;
      }
      if (selectedKey === key) {
        // Second tap/click on already selected tile -> confirm discard!
        onDiscard(tile);
        setSelection(null);
      } else {
        // First tap/click -> select the tile
        setSelection({ key, tile, decision: decisionKey });
      }
    },
    [enabled, canDiscard, discardable, selectedKey, singleClickDiscard, riichiSelecting, decisionKey, onDiscard],
  );

  const confirmDiscard = useCallback(() => {
    if (enabled && selectedTile !== null && canDiscard && discardable.includes(selectedTile)) {
      onDiscard(selectedTile);
      setSelection(null);
    }
  }, [enabled, canDiscard, discardable, selectedTile, onDiscard]);

  const cancelSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      isTouchScrolling.current = false;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartPos.current && e.touches.length > 0) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (deltaX > 10 || deltaY > 10) {
        isTouchScrolling.current = true;
      }
    }
  }, []);

  const onTouchEnd = useCallback(
    (_e: React.TouchEvent, key: string, tile: number) => {
      touchStartPos.current = null;
      lastTouchTime.current = Date.now();
      if (isTouchScrolling.current) {
        isTouchScrolling.current = false;
        return;
      }
      selectTile(key, tile, 'touch');
    },
    [selectTile],
  );

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (!enabled) return;

    const onKey = (event: KeyboardEvent) => {
      try {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (
          target?.closest?.(
            'input,select,textarea,[contenteditable="true"],[role="dialog"]',
          ) ||
          document.querySelector('.riichi-menu-drawer[data-state="open"]')
        ) {
          return;
        }

        const key = event.key ? event.key.toLowerCase() : '';
        if ((key === 'enter' || key === ' ') && target?.closest('button, a') && !target.closest('.riichi-self-hand')) return;

        // Arrow navigation
        if (key === 'arrowleft' || key === 'arrowright') {
          if (!canDiscard) return;
          const discardableItems = handItems.filter((item) =>
            discardable.includes(item.tile),
          );
          if (discardableItems.length === 0) return;

          let nextIndex = 0;
          const currentIdx = discardableItems.findIndex(
            (item) => item.key === selectedKey,
          );

        if (currentIdx < 0) {
          nextIndex = key === 'arrowleft' ? discardableItems.length - 1 : 0;
        } else {
          nextIndex =
            (currentIdx + (key === 'arrowright' ? 1 : discardableItems.length - 1)) %
            discardableItems.length;
        }

        const nextItem = discardableItems[nextIndex];
        setSelection({ key: nextItem.key, tile: nextItem.tile, decision: decisionKey });

        // Also focus corresponding button if present
        const buttons = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '.riichi-self-hand button:not(:disabled)',
          ),
        );
        const targetBtn = buttons.find(
          (b) => b.getAttribute('aria-label') && b.dataset.tileKey === nextItem.key,
        ) ?? buttons[nextIndex];
        targetBtn?.focus();

        event.preventDefault();
        return;
      }

      // Enter to discard
      if (key === 'enter') {
        if (selectedTile !== null && canDiscard && discardable.includes(selectedTile)) {
          event.preventDefault();
          confirmDiscard();
          return;
        }
      }

      // Escape to cancel selection, riichi selection, or pass claim
      if (key === 'escape') {
        if (selectedKey !== null) {
          event.preventDefault();
          cancelSelection();
          return;
        }
        if (riichiSelecting) {
          event.preventDefault();
          onCancelRiichi();
          return;
        }
        if (isMyClaim) {
          event.preventDefault();
          onPassClaim();
          return;
        }
      }

      // Delegate extra action shortcuts
      if (onActionShortcut) {
        if (onActionShortcut(key)) {
          event.preventDefault();
        }
      }
    } catch (err) {
      console.error('ONKEY ERROR:', err);
    }
  };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [
    enabled,
    decisionKey,
    canDiscard,
    discardable,
    handItems,
    selectedKey,
    selectedTile,
    riichiSelecting,
    isMyClaim,
    confirmDiscard,
    cancelSelection,
    onCancelRiichi,
    onPassClaim,
    onActionShortcut,
  ]);

  return {
    selectedKey,
    selectedTile,
    selectTile,
    confirmDiscard,
    cancelSelection,
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
