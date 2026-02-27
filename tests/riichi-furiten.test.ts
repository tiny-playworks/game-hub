import { describe, expect, test } from '@rstest/core';
import {
  applyRonDeclinedFuriten,
  clearDoujunFuriten,
  createInitialFuritenState,
  isRonForbiddenByFuriten,
  isSutehaiFuriten,
} from '../src/lib/riichiFuriten';

describe('日麻振听回归', () => {
  test('舍张振听：和牌候选牌包含自己曾打出的牌时应振听', () => {
    expect(isSutehaiFuriten([4, 7], [1, 34, 20])).toBe(true); // 34=赤5万 -> base 4
  });

  test('漏胡后同巡振听：下次摸牌应解除 doujun', () => {
    const s1 = applyRonDeclinedFuriten(createInitialFuritenState(), false);
    expect(s1.doujun).toBe(true);
    const s2 = clearDoujunFuriten(s1);
    expect(s2.doujun).toBe(false);
  });

  test('立直后漏胡：应进入 riichi 振听（本局荣和禁止）', () => {
    const s = applyRonDeclinedFuriten(createInitialFuritenState(), true);
    expect(s.riichi).toBe(true);
    expect(
      isRonForbiddenByFuriten({
        waitingTiles: [4],
        ownDiscards: [],
        state: s,
      }),
    ).toBe(true);
  });
});
