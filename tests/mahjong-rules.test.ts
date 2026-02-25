import { describe, expect, test } from '@rstest/core';
import { getWinFans, type Meld } from '../src/lib/mahjong';
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
import {
  calculateGangSettlement,
  checkWinSichuan,
  type GangRecord,
} from '../src/lib/mahjongSichuan';

describe('国标麻将 - 屁胡叠加修复', () => {
  test('纯基础牌型无其他番 → 屁胡 1 番（含门清）', () => {
    // 有吃碰→非门清的基础手牌：吃 123万 + 手牌 456万 789万 123条 将55条
    const hand = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 13];
    const melds: Meld[] = [{ type: 'chi', tiles: [0, 1, 2], fromPlayer: 3 }];
    const result = getWinFans(hand, melds, undefined, {});
    expect(result).not.toBeNull();
    expect(result?.fans.some((f) => f.name === '屁胡')).toBe(true);
    expect(result?.fans.some((f) => f.name === '门清')).toBe(false);
    expect(result?.totalFan).toBe(1);
  });

  test('对对胡不叠加屁胡', () => {
    // 全刻子型：4 组刻子 + 1 将
    const hand = [0, 0, 0, 1, 1, 1, 9, 9, 9, 18, 18];
    const melds: Meld[] = [
      { type: 'peng', tiles: [27, 27, 27], fromPlayer: 1 },
    ];
    const result = getWinFans(hand, melds, undefined, {});
    expect(result).not.toBeNull();
    expect(result?.fans.some((f) => f.name === '屁胡')).toBe(false);
    expect(result?.fans.some((f) => f.name === '对对胡')).toBe(true);
  });

  test('清一色不叠加屁胡', () => {
    // 全万子
    const hand = [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3, 3];
    const melds: Meld[] = [];
    const result = getWinFans(hand, melds, undefined, {});
    expect(result).not.toBeNull();
    expect(result?.fans.some((f) => f.name === '屁胡')).toBe(false);
    expect(result?.fans.some((f) => f.name === '清一色')).toBe(true);
  });
});

describe('川麻 - 七对/龙七对胡牌判定', () => {
  test('七对可以胡牌', () => {
    // 7 对：0,0,1,1,2,2,3,3,4,4,5,5,6,6 (全万子)
    const hand = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6];
    const melds: never[] = [];
    const result = checkWinSichuan(hand, melds, 'tiao');
    expect(result).toBe(true);
  });

  test('龙七对可以胡牌', () => {
    // 龙七对：含 1 组 4 张相同 (0,0,0,0,1,1,2,2,3,3,4,4,5,5)
    const hand = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
    const melds: never[] = [];
    const result = checkWinSichuan(hand, melds, 'tiao');
    expect(result).toBe(true);
  });

  test('定缺未打完不能胡七对', () => {
    // 手牌含条子(9)，定缺条
    const hand = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 9, 9];
    const melds: never[] = [];
    const result = checkWinSichuan(hand, melds, 'tiao');
    expect(result).toBe(false);
  });
});

describe('川麻 - 杠牌计分', () => {
  test('明杠：3 家各付 1 倍', () => {
    const records: GangRecord[] = [
      { player: 0, type: 'mingGang', tile: 0, round: 1 },
    ];
    const scores = calculateGangSettlement(records, 1);
    expect(scores[0]).toBe(3);
    expect(scores[1]).toBe(-1);
    expect(scores[2]).toBe(-1);
    expect(scores[3]).toBe(-1);
  });

  test('暗杠：3 家各付 2 倍', () => {
    const records: GangRecord[] = [
      { player: 1, type: 'anGang', tile: 0, round: 1 },
    ];
    const scores = calculateGangSettlement(records, 1);
    expect(scores[0]).toBe(-2);
    expect(scores[1]).toBe(6);
    expect(scores[2]).toBe(-2);
    expect(scores[3]).toBe(-2);
  });

  test('补杠：原点炮者付 2 倍', () => {
    const records: GangRecord[] = [
      { player: 0, type: 'jiaGang', tile: 0, round: 1, fromPlayer: 2 },
    ];
    const scores = calculateGangSettlement(records, 1);
    expect(scores[0]).toBe(2);
    expect(scores[1]).toBe(0);
    expect(scores[2]).toBe(-2);
    expect(scores[3]).toBe(0);
  });
});

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
