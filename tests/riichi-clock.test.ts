import { describe, expect, test } from 'rstack/test';
import {
  consumeTimeBankSeconds,
  getAiDelayMs,
  getDecisionTotalSeconds,
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

  test('玩家决策读秒上限支持吃碰额外思考时间与多档位/无限时设置', () => {
    expect(getDecisionTotalSeconds(30, 'discard', 'standard')).toBe(35);
    expect(getDecisionTotalSeconds(0, 'discard', 'standard')).toBe(20);
    expect(getDecisionTotalSeconds(30, 'claim', 'standard')).toBe(50);
    expect(getDecisionTotalSeconds(0, 'claim', 'standard')).toBe(30);
    expect(getDecisionTotalSeconds(30, 'claim', 'relaxed')).toBe(70);
    expect(getDecisionTotalSeconds(30, 'discard', 'long')).toBe(90);
    expect(getDecisionTotalSeconds(30, 'claim', 'unlimited')).toBeNull();
  });

  test('AI 速度档位返回对应的出牌与鸣牌延迟', () => {
    expect(getAiDelayMs('slow', 'discard')).toBeGreaterThan(
      getAiDelayMs('normal', 'discard'),
    );
    expect(getAiDelayMs('normal', 'discard')).toBeGreaterThan(
      getAiDelayMs('fast', 'discard'),
    );
  });
});
