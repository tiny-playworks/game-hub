import { expect, test } from '@rstest/core';
import {
  createDasArrState,
  DEFAULT_DAS_ARR,
  dasArrOnKeyDown,
  dasArrOnKeyUp,
  dasArrTick,
} from '../src/lib/tetrisDas';

test('keydown 立即触发一次移动', () => {
  const { state, fire } = dasArrOnKeyDown(createDasArrState(), -1);
  expect(fire).toBe(true);
  expect(state.held).toBe(-1);
  expect(state.charged).toBe(false);
});

test('同向重复 keydown（系统重复）不额外开火', () => {
  let s = createDasArrState();
  ({ state: s } = dasArrOnKeyDown(s, 1));
  const again = dasArrOnKeyDown(s, 1);
  expect(again.fire).toBe(false);
});

test('换向立刻开火并重置 DAS', () => {
  let s = createDasArrState();
  ({ state: s } = dasArrOnKeyDown(s, -1));
  s = dasArrTick(s, DEFAULT_DAS_ARR.dasMs / 2, DEFAULT_DAS_ARR).state;
  const swapped = dasArrOnKeyDown(s, 1);
  expect(swapped.fire).toBe(true);
  expect(swapped.state.held).toBe(1);
  expect(swapped.state.charged).toBe(false);
  expect(swapped.state.dasElapsed).toBe(0);
});

test('keyup 松开当前方向后停止', () => {
  let s = createDasArrState();
  ({ state: s } = dasArrOnKeyDown(s, -1));
  s = dasArrOnKeyUp(s, -1);
  expect(s.held).toBeNull();
  const tick = dasArrTick(s, 1000, DEFAULT_DAS_ARR);
  expect(tick.fires).toBe(0);
});

test('DAS 充满后按 ARR 连续开火', () => {
  let s = createDasArrState();
  ({ state: s } = dasArrOnKeyDown(s, 1));
  // before DAS: no auto fire
  let r = dasArrTick(s, DEFAULT_DAS_ARR.dasMs - 1, DEFAULT_DAS_ARR);
  expect(r.fires).toBe(0);
  s = r.state;
  // complete DAS → first ARR fire
  r = dasArrTick(s, 1, DEFAULT_DAS_ARR);
  expect(r.fires).toBe(1);
  s = r.state;
  expect(s.charged).toBe(true);
  // one ARR period → another fire
  r = dasArrTick(s, DEFAULT_DAS_ARR.arrMs, DEFAULT_DAS_ARR);
  expect(r.fires).toBe(1);
});

test('ARR 为 0 时 DAS 后每 tick 尽可能多移（单次 tick 一次）', () => {
  const cfg = { dasMs: 10, arrMs: 0 };
  let s = createDasArrState();
  ({ state: s } = dasArrOnKeyDown(s, 1));
  const r = dasArrTick(s, 10, cfg);
  expect(r.fires).toBeGreaterThanOrEqual(1);
});
