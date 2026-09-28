import { describe, expect, test } from '@rstest/core';
import {
  AKA_5_MAN,
  AKA_5_PIN,
  AKA_5_SOU,
  createRiichiDeck,
  getTileLabel,
} from '../src/lib/mahjongRiichi';
import { mixSeed, mulberry32 } from '../src/lib/seededRandom';
import { tile, tiles } from './helpers/riichiTiles';

describe('牌面记法解析器', () => {
  test('数牌与字牌', () => {
    expect(tiles('123m')).toEqual([0, 1, 2]);
    expect(tiles('19s')).toEqual([9, 17]);
    expect(tiles('19p')).toEqual([18, 26]);
    expect(tiles('1234567z').map((t) => getTileLabel(t))).toEqual([
      '东',
      '南',
      '西',
      '北',
      '白',
      '发',
      '中',
    ]);
  });

  test('赤五与单张', () => {
    expect(tiles('0m0p0s')).toEqual([AKA_5_MAN, AKA_5_PIN, AKA_5_SOU]);
    expect(tile('5p')).toBe(22);
    expect(() => tile('12m')).toThrow();
    expect(() => tiles('123')).toThrow();
  });
});

describe('可复现随机源', () => {
  test('相同种子产生相同牌山', () => {
    const a = createRiichiDeck(mulberry32(42));
    const b = createRiichiDeck(mulberry32(42));
    const c = createRiichiDeck(mulberry32(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(136);
  });

  test('mixSeed 对输入敏感且稳定', () => {
    expect(mixSeed(1, 2)).toBe(mixSeed(1, 2));
    expect(mixSeed(1, 2)).not.toBe(mixSeed(2, 1));
  });
});
