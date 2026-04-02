import { describe, expect, test } from '@rstest/core';
import {
  AKA_5_MAN,
  AKA_5_PIN,
  AKA_5_SOU,
  calcFu,
  computeYaku,
  createRiichiDeck,
  getBaseTile,
  getTileLabel,
} from '../src/lib/mahjongRiichi';

describe('日麻 - 赤宝牌映射修复', () => {
  test('AKA_5_PIN 映射到五筒(22)', () => {
    expect(getBaseTile(AKA_5_PIN)).toBe(22);
    expect(getTileLabel(AKA_5_PIN)).toBe('五筒');
  });

  test('AKA_5_SOU 映射到五条(13)', () => {
    expect(getBaseTile(AKA_5_SOU)).toBe(13);
    expect(getTileLabel(AKA_5_SOU)).toBe('五条');
  });

  test('AKA_5_MAN 映射正确', () => {
    expect(getBaseTile(AKA_5_MAN)).toBe(4);
    expect(getTileLabel(AKA_5_MAN)).toBe('五万');
  });

  test('牌堆含 136 张且赤牌正确', () => {
    const deck = createRiichiDeck();
    expect(deck).toHaveLength(136);
    const fiveManCount = deck.filter((t) => t === 4 || t === AKA_5_MAN).length;
    const fiveSouCount = deck.filter((t) => t === 13 || t === AKA_5_SOU).length;
    const fivePinCount = deck.filter((t) => t === 22 || t === AKA_5_PIN).length;
    expect(fiveManCount).toBe(4);
    expect(fiveSouCount).toBe(4);
    expect(fivePinCount).toBe(4);
  });
});

describe('日麻 - 符数计算修复', () => {
  test('平和自摸 = 20 符', () => {
    const fu = calcFu({
      isTsumo: true,
      isMenzhen: true,
      hasPinfu: true,
      isChiitoitsu: false,
    });
    expect(fu).toBe(20);
  });

  test('平和荣和 = 30 符', () => {
    const fu = calcFu({
      isTsumo: false,
      isMenzhen: true,
      hasPinfu: true,
      isChiitoitsu: false,
    });
    expect(fu).toBe(30);
  });

  test('七对子 = 25 符', () => {
    const fu = calcFu({
      isTsumo: false,
      isMenzhen: true,
      hasPinfu: false,
      isChiitoitsu: true,
    });
    expect(fu).toBe(25);
  });
});

describe('日麻 - 平和判定修复', () => {
  test('同牌 3 张跨顺子的平和手牌应被识别', () => {
    // 0,0,0,1,1,1,2,2,2,3,4,5,6,6 → pair 66 + 012×3 + 345
    const hand = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 4, 5, 6, 6];
    const yaku = computeYaku({
      hand,
      melds: [],
      isMenzhen: true,
      isTsumo: false,
      isRiichi: false,
      ippatsuPossible: false,
      seatWind: 27,
      roundWind: 27,
    });
    expect(yaku.some((y) => y.id === 'pinfu')).toBe(true);
  });

  test('含刻子的手牌不是平和', () => {
    // 0,0,0,9,10,11,18,19,20,1,2,3,4,4 → pair 44 + 000(刻) + 9-10-11 + 18-19-20 + 123
    const hand = [0, 0, 0, 1, 2, 3, 4, 4, 9, 10, 11, 18, 19, 20];
    const yaku = computeYaku({
      hand,
      melds: [],
      isMenzhen: true,
      isTsumo: false,
      isRiichi: false,
      ippatsuPossible: false,
      seatWind: 27,
      roundWind: 27,
    });
    expect(yaku.some((y) => y.id === 'pinfu')).toBe(false);
  });

  test('役牌将的手牌不是平和', () => {
    // pair = 白白(33,33), melds all sequences
    const hand = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 33, 33];
    const yaku = computeYaku({
      hand,
      melds: [],
      isMenzhen: true,
      isTsumo: false,
      isRiichi: false,
      ippatsuPossible: false,
      seatWind: 27,
      roundWind: 27,
    });
    expect(yaku.some((y) => y.id === 'pinfu')).toBe(false);
  });
});
