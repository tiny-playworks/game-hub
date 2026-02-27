import { describe, expect, test } from '@rstest/core';
import {
  consumeTimeBankSeconds,
  getTurnTotalSeconds,
  isTurnTimeout,
  RIICHI_TURN_SECONDS,
} from '../src/lib/riichiClock';

describe('日麻读秒与时间库', () => {
  test('每巡可用时间 = 时间库 + 5 秒读秒', () => {
    expect(getTurnTotalSeconds(30)).toBe(30 + RIICHI_TURN_SECONDS);
    expect(getTurnTotalSeconds(0)).toBe(RIICHI_TURN_SECONDS);
  });

  test('10 秒出牌：只扣时间库 5 秒', () => {
    expect(consumeTimeBankSeconds(30, 10)).toBe(25);
  });

  test('时间库耗尽后仅剩 5 秒读秒，超时判定应成立', () => {
    expect(isTurnTimeout(0, 5)).toBe(true);
    expect(isTurnTimeout(0, 4.99)).toBe(false);
  });
});
