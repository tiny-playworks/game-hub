import { afterEach, expect, rs, test } from '@rstest/core';
import { act, renderHook } from '@testing-library/react';
import { normalizeRiichiSettings } from '../src/lib/playerProfile';
import * as progress from '../src/lib/riichiProgress';
import {
  applyEvent,
  createMatch,
  toReplayFile,
} from '../src/pages/mahjong/japanese/engine';
import { useRiichiStore } from '../src/pages/mahjong/japanese/store/riichiMatchStore';
import {
  useRiichiAutomation,
  withElapsed,
} from '../src/pages/mahjong/japanese/useRiichiAutomation';
import { nextAutoEvent } from './helpers/riichiSim';

afterEach(() => {
  rs.restoreAllMocks();
  rs.useRealTimers();
  useRiichiStore.setState({
    match: null,
    view: 'rules',
    showGuide: false,
    showMenu: false,
    replay: null,
    decisionClock: null,
    processedProgress: [],
  });
  localStorage.clear();
});

test('指南和牌谱重叠打开时只暂停一次，全部关闭后继续原读秒', () => {
  const now = rs.spyOn(Date, 'now');
  const file = toReplayFile(createMatch({ seed: 909 }).match);
  useRiichiStore.setState({
    view: 'game',
    decisionClock: { key: 'same-turn', startedAt: 1000 },
  });
  now.mockReturnValue(4000);
  useRiichiStore.getState().setShowGuide(true);
  now.mockReturnValue(7000);
  useRiichiStore.getState().openReplay(file);
  useRiichiStore.getState().setShowGuide(false);
  expect(withElapsed({ type: 'tsumo', seat: 0, elapsed: 0 }).elapsed).toBe(3);
  expect(useRiichiStore.getState().decisionClock?.pausedAt).toBe(4000);
  now.mockReturnValue(24000);
  useRiichiStore.getState().openReplay(null);
  expect(useRiichiStore.getState().decisionClock).toEqual({
    key: 'same-turn',
    startedAt: 21000,
  });
  now.mockReturnValue(26000);
  expect(withElapsed({ type: 'tsumo', seat: 0, elapsed: 0 }).elapsed).toBe(5);
});

test.each(['guide', 'menu', 'replay'])(
  '调度器在 $0 内不自动超时，关闭后用剩余时间完成合法舍牌',
  (dialog) => {
    rs.useFakeTimers();
    const match = createMatch({ seed: 910 }).match;
    useRiichiStore.setState({ match, view: 'game', decisionClock: null });
    const settings = {
      ...normalizeRiichiSettings(null),
      autoWin: false,
      noCall: false,
      autoTsumogiri: false,
    };
    const hook = renderHook(() => useRiichiAutomation(settings));
    act(() => rs.advanceTimersByTime(2000));
    const toggle = (open: boolean) => {
      const store = useRiichiStore.getState();
      if (dialog === 'guide') store.setShowGuide(open);
      if (dialog === 'menu') store.setShowMenu(open);
      if (dialog === 'replay')
        store.openReplay(open ? toReplayFile(match) : null);
    };
    act(() => toggle(true));
    act(() => rs.advanceTimersByTime(60000));
    expect(useRiichiStore.getState().match?.events).toHaveLength(0);
    act(() => toggle(false));
    act(() => rs.advanceTimersByTime(32000));
    expect(useRiichiStore.getState().match?.events).toHaveLength(0);
    act(() => rs.advanceTimersByTime(1000));
    expect(useRiichiStore.getState().match?.events[0]).toEqual(
      expect.objectContaining({
        type: 'discard',
        seat: 0,
        timeout: true,
        elapsed: 35,
      }),
    );
    hook.unmount();
  },
);

test('恢复已计入进度的对局不再发放进入奖励', () => {
  const record = rs.spyOn(progress, 'recordRiichiProgressEvent');
  useRiichiStore.getState().startMatch({ seed: 911 });
  expect(record).toHaveBeenCalledTimes(1);
  expect(useRiichiStore.getState().resumeSaved()).toBe(true);
  expect(record).toHaveBeenCalledTimes(1);
  expect(useRiichiStore.getState().processedProgress).toEqual([
    '911:enter-game',
  ]);
});

test('回退后重新立直不会重复计入成长进度', () => {
  const record = rs.spyOn(progress, 'recordRiichiProgressEvent');
  let match = createMatch({ seed: 1 }).match;
  for (let index = 0; index < 4000; index++) {
    const event = nextAutoEvent(match);
    if (!event) break;
    if (event.type === 'riichi' && event.seat === 0) {
      useRiichiStore.setState({ match, view: 'game', processedProgress: [] });
      expect(useRiichiStore.getState().dispatch(event)).toBe(true);
      expect(record).toHaveBeenCalledTimes(1);
      expect(useRiichiStore.getState().undo()).toBe(true);
      expect(useRiichiStore.getState().dispatch(event)).toBe(true);
      expect(record).toHaveBeenCalledTimes(1);
      return;
    }
    match = applyEvent(match, event)!.match;
  }
  throw new Error('固定种子中没有自家立直');
});
