import { expect, test } from '@rstest/core';
import {
  calculateFanSichuan,
  createSichuanDeck,
  dealSichuan,
  isValidQueMenHand,
} from '../src/lib/mahjongSichuan';

test('creates proper Sichuan deck', () => {
  const deck = createSichuanDeck();
  expect(deck).toHaveLength(108); // 川麻 108 张，仅万/条/筒
});

test('deals Sichuan cards correctly', () => {
  const deck = createSichuanDeck();
  const [hands] = dealSichuan(deck, 0);

  expect(hands[0]).toHaveLength(14);
  expect(hands[1]).toHaveLength(13);
  expect(hands[2]).toHaveLength(13);
  expect(hands[3]).toHaveLength(13);
});

test('validates que men requirement', () => {
  const hand = [0, 1, 2, 9, 10, 11]; // 万子和条子
  expect(isValidQueMenHand(hand, 'tong')).toBe(true); // 缺筒子，符合要求
  expect(isValidQueMenHand(hand, 'wan')).toBe(false); // 不缺万子，不符合
});

test('calculates fan correctly', () => {
  // 手牌 11 张 + 1 组碰 3 张 = 14，对对胡（4 刻子+1 将）
  const hand = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4];
  const melds = [{ type: 'peng' as const, tiles: [0, 0, 0], fromPlayer: 1 }];

  const result1 = calculateFanSichuan(hand, melds, false, 'wan'); // 点炮，定缺万
  const result2 = calculateFanSichuan(hand, melds, true, 'wan'); // 自摸

  expect(result1.fan).toBe(2); // 对对胡 2 番
  expect(result2.fan).toBe(4); // 对对胡 2 × 自摸 2

  expect(result1.fanTypes).toContain('对对胡');
  expect(result2.fanTypes).toContain('对对胡');
  expect(result2.fanTypes).toContain('自摸×2');
});
