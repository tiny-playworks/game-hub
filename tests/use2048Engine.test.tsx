import { afterEach, expect, rs, test } from '@rstest/core';
import { act, renderHook } from '@testing-library/react';
import { useEngine2048 } from '../src/hooks/use2048Engine';

afterEach(() => {
  rs.restoreAllMocks();
});

test('useEngine2048 undo - should not mutate history state when moving', () => {
  // Mock random so we have predictable behavior
  rs.spyOn(Math, 'random').mockReturnValue(0.5);

  const { result } = renderHook(() => useEngine2048());

  act(() => {
    // move to create some history
    result.current.move('down');
  });

  const stateAfterMove1 = structuredClone(result.current.state);

  act(() => {
    // move again
    result.current.move('left');
  });

  act(() => {
    // undo
    result.current.undo();
  });

  // The state should be exactly stateAfterMove1
  // If mutation occurred, the objects inside stateAfterMove1.tiles would have been modified by the second move
  expect(result.current.state).toEqual(stateAfterMove1);
});
