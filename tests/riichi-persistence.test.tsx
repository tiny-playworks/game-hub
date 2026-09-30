import { expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from '../src/contexts/LocaleContext';
import { ReplayViewer } from '../src/pages/mahjong/japanese/components/ReplayViewer';
import {
  applyEvent,
  createMatch,
  isReplayFile,
  replayMatch,
  restoreMatch,
  toReplayFile,
} from '../src/pages/mahjong/japanese/engine';
import {
  hasSavedMatch,
  loadSavedMatch,
  RIICHI_SAVE_STORAGE_KEY,
  saveMatch,
} from '../src/pages/mahjong/japanese/store/persistence';

test('存档只记录种子、规则和事件，重新进入时可恢复同一局面', () => {
  localStorage.removeItem(RIICHI_SAVE_STORAGE_KEY);
  const initial = createMatch({ seed: 903, matchLength: 'east' }).match;
  const event = {
    type: 'discard' as const,
    seat: 0,
    tile: initial.round.turnOptions!.discardable[0],
  };
  const match = applyEvent(initial, event)!.match;
  saveMatch(match, ['903:enter-game']);
  const stored = JSON.parse(localStorage.getItem(RIICHI_SAVE_STORAGE_KEY)!);
  expect(stored.replay).toEqual(toReplayFile(match));
  expect(stored.match).toBeUndefined();
  expect(hasSavedMatch()).toBe(true);
  const loaded = loadSavedMatch();
  expect(loaded?.match.round).toEqual(match.round);
  expect(loaded?.processedProgress).toEqual(['903:enter-game']);
  localStorage.removeItem(RIICHI_SAVE_STORAGE_KEY);
});

test('牌谱拒绝无效动作，也不能把不完整回放当作存档', () => {
  const match = createMatch({ seed: 904, matchLength: 'east' }).match;
  const file = toReplayFile(match);
  expect(isReplayFile({ ...file, events: [{ type: 'claim', seat: 0 }] })).toBe(
    false,
  );
  const illegal = {
    ...file,
    events: [{ type: 'discard' as const, seat: 1, tile: 0 }],
  };
  expect(isReplayFile(illegal)).toBe(true);
  expect(restoreMatch(illegal)).toBeNull();
  expect(() => replayMatch(illegal)).toThrow(/Invalid replay event/);
  localStorage.setItem(
    RIICHI_SAVE_STORAGE_KEY,
    JSON.stringify({ replay: illegal, processedProgress: [], savedAt: 1 }),
  );
  expect(loadSavedMatch()).toBeNull();
  localStorage.removeItem(RIICHI_SAVE_STORAGE_KEY);
});

test('旧快照存档从种子和事件重建，不信任快照中的手牌', () => {
  const match = createMatch({ seed: 908, matchLength: 'east' }).match;
  localStorage.setItem(
    RIICHI_SAVE_STORAGE_KEY,
    JSON.stringify({
      match: { ...match, round: { hands: [] } },
      processedProgress: ['908:enter-game', 123],
    }),
  );
  expect(hasSavedMatch()).toBe(true);
  expect(loadSavedMatch()?.match.round).toEqual(match.round);
  expect(loadSavedMatch()?.processedProgress).toEqual(['908:enter-game']);
  localStorage.removeItem(RIICHI_SAVE_STORAGE_KEY);
});

test('牌谱拒绝缺少规则、负用时和错误标记，不能污染重放结果', () => {
  const file = toReplayFile(createMatch({ seed: 907 }).match);
  expect(isReplayFile({ ...file, rules: {} })).toBe(false);
  expect(
    isReplayFile({ ...file, rules: { ...file.rules, aiLevel: 'unknown' } }),
  ).toBe(false);
  for (const meta of [
    { elapsed: -1 },
    { elapsed: '5' },
    { elapsed: Infinity },
    { timeout: 'yes' },
  ]) {
    expect(
      isReplayFile({
        ...file,
        events: [{ type: 'discard', seat: 0, tile: 1, ...meta }],
      }),
    ).toBe(false);
  }
});

test('牌谱查看器支持逐步前进和跳到本局', () => {
  const initial = createMatch({ seed: 905, matchLength: 'east' }).match;
  const match = applyEvent(initial, {
    type: 'discard',
    seat: 0,
    tile: initial.round.turnOptions!.discardable[0],
  })!.match;
  render(
    <LocaleProvider>
      <ReplayViewer file={toReplayFile(match)} onClose={() => {}} />
    </LocaleProvider>,
  );
  expect(screen.getByText('第 0 / 1 步')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  expect(screen.getByText('第 1 / 1 步')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '上一步' }));
  expect(screen.getByText('第 0 / 1 步')).toBeInTheDocument();
});
