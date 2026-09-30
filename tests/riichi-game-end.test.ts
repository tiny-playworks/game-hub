import { describe, expect, test } from '@rstest/core';
import {
  rankSeatsByScore,
  resolveRiichiMatchEnd,
} from '../src/lib/riichiGameEnd';

describe('日麻终局判定', () => {
  test.each([
    { round: 1, scores: [31000, 23000, 24000, 22000], end: true },
    { round: 1, scores: [28000, 24000, 26000, 22000], end: false },
    { round: 4, scores: [28000, 24000, 26000, 22000], end: true },
  ])('西场第 $round 局按返点线和延长场上限终局', ({ round, scores, end }) => {
    const result = resolveRiichiMatchEnd({
      scores,
      roundWind: 2,
      roundNumber: round,
      dealer: round - 1,
      dealerStays: false,
      matchLength: 'south',
    });
    expect(result.end).toBe(end);
    if (end) expect(result.reason).toBe('extension_end');
  });

  test('南四流局庄家听牌且头名时继续，不能当作和了止め', () => {
    expect(
      resolveRiichiMatchEnd({
        scores: [18000, 22000, 23000, 37000],
        roundWind: 1,
        roundNumber: 4,
        dealer: 3,
        dealerStays: true,
        dealerWon: false,
        matchLength: 'south',
      }),
    ).toEqual({ end: false });
  });
  test('任意玩家被击飞（负分）时立即终局', () => {
    const out = resolveRiichiMatchEnd({
      scores: [32000, -300, 25000, 43300],
      roundWind: 0,
      roundNumber: 3,
      dealer: 1,
      dealerStays: false,
      matchLength: 'south',
    });
    expect(out).toEqual({ end: true, reason: 'tobi' });
  });

  test('东风场东4局无人到 30000 时南入', () => {
    const out = resolveRiichiMatchEnd({
      scores: [28000, 24000, 26000, 22000],
      roundWind: 0,
      roundNumber: 4,
      dealer: 3,
      dealerStays: false,
      matchLength: 'east',
    });
    expect(out).toEqual({ end: false });
  });

  test('东风场东4局流局（连庄）不结束', () => {
    const out = resolveRiichiMatchEnd({
      scores: [28000, 24000, 26000, 22000],
      roundWind: 0,
      roundNumber: 4,
      dealer: 3,
      dealerStays: true,
      matchLength: 'east',
    });
    expect(out).toEqual({ end: false });
  });

  test('南4子家和（不连庄）且无人到 30000 时继续', () => {
    const out = resolveRiichiMatchEnd({
      scores: [28000, 24000, 26000, 22000],
      roundWind: 1,
      roundNumber: 4,
      dealer: 0,
      dealerStays: false,
      matchLength: 'south',
    });
    expect(out).toEqual({ end: false });
  });

  test('南4子家和（不连庄）且有人到 30000 时结束', () => {
    const out = resolveRiichiMatchEnd({
      scores: [29500, 31500, 21000, 18000],
      roundWind: 1,
      roundNumber: 4,
      dealer: 0,
      dealerStays: false,
      matchLength: 'south',
    });
    expect(out).toEqual({ end: true, reason: 'south4_end' });
  });

  test('南4庄家和了且头名可收场', () => {
    const out = resolveRiichiMatchEnd({
      scores: [37000, 21000, 23000, 19000],
      roundWind: 1,
      roundNumber: 4,
      dealer: 0,
      dealerStays: true,
      dealerWon: true,
      matchLength: 'south',
    });
    expect(out).toEqual({ end: true, reason: 'agari_yame' });
  });

  test('南4庄家连庄但非头名则继续', () => {
    const out = resolveRiichiMatchEnd({
      scores: [28000, 31000, 22000, 19000],
      roundWind: 1,
      roundNumber: 4,
      dealer: 0,
      dealerStays: true,
      dealerWon: true,
      matchLength: 'south',
    });
    expect(out).toEqual({ end: false });
  });

  test('名次按分数降序、同分按座位号', () => {
    expect(rankSeatsByScore([30000, 24000, 30000, 15000])).toEqual([
      0, 2, 1, 3,
    ]);
  });
});
