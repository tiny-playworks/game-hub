import { describe, expect, test } from '@rstest/core';
import {
  rankSeatsByScore,
  resolveRiichiMatchEnd,
} from '../src/lib/riichiGameEnd';

describe('日麻终局判定', () => {
  test('任意玩家被击飞（负分）时立即终局', () => {
    const out = resolveRiichiMatchEnd({
      scores: [32000, -300, 25000, 43300],
      roundWind: 0,
      roundNumber: 3,
      dealer: 1,
      dealerStays: false,
    });
    expect(out).toEqual({ end: true, reason: 'tobi' });
  });

  test('南4子家和（不连庄）本局结束', () => {
    const out = resolveRiichiMatchEnd({
      scores: [28000, 24000, 26000, 22000],
      roundWind: 1,
      roundNumber: 4,
      dealer: 0,
      dealerStays: false,
    });
    expect(out).toEqual({ end: true, reason: 'south4_end' });
  });

  test('南4庄家连庄且头名可收场', () => {
    const out = resolveRiichiMatchEnd({
      scores: [37000, 21000, 23000, 19000],
      roundWind: 1,
      roundNumber: 4,
      dealer: 0,
      dealerStays: true,
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
    });
    expect(out).toEqual({ end: false });
  });

  test('名次按分数降序、同分按座位号', () => {
    expect(rankSeatsByScore([30000, 24000, 30000, 15000])).toEqual([
      0, 2, 1, 3,
    ]);
  });
});
