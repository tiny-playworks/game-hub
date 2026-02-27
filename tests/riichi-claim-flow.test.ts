import { describe, expect, test } from '@rstest/core';
import { canOfferRon, resolveClaimPass } from '../src/lib/riichiClaimFlow';

describe('日麻要牌流程回归', () => {
  test('要牌轮最后一位也过且牌墙为空时，必须判定荒牌流局', () => {
    const result = resolveClaimPass(2, 0);
    expect(result).toEqual({ type: 'ryuukyoku' });
  });

  test('非当前要牌顺位也应允许荣和入口（满足和牌条件时）', () => {
    const canRon = canOfferRon({
      phase: 'claim',
      lastDiscard: 4,
      lastDiscardFrom: 2,
      currentClaimToken: 'token-a',
      declinedRonToken: null,
      isWinShape: true,
      hasYaku: true,
    });
    expect(canRon).toBe(true);
  });

  test('本次打牌已放弃过荣和，不应重复弹荣和入口', () => {
    const canRon = canOfferRon({
      phase: 'claim',
      lastDiscard: 4,
      lastDiscardFrom: 2,
      currentClaimToken: 'token-a',
      declinedRonToken: 'token-a',
      isWinShape: true,
      hasYaku: true,
    });
    expect(canRon).toBe(false);
  });
});
