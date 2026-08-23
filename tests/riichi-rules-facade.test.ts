import { describe, expect, test } from '@rstest/core';
import { ourTileToRs, rsHairiTileToOur } from '../src/lib/riichiRsAdapter';
import { analyzeRiichiHand, evaluateRiichiWin } from '../src/lib/riichiRules';

describe('riichi rule facade', () => {
  test('normalizes project tiles and zero-based hairi tiles across suit orders', () => {
    expect(ourTileToRs(0)).toBe(1);
    expect(ourTileToRs(9)).toBe(19);
    expect(ourTileToRs(18)).toBe(10);
    expect(ourTileToRs(35)).toBe(14);
    expect(ourTileToRs(36)).toBe(23);
    expect(ourTileToRs(31)).toBe(34);
    expect(ourTileToRs(33)).toBe(32);

    expect(rsHairiTileToOur(0)).toBe(0);
    expect(rsHairiTileToOur(9)).toBe(18);
    expect(rsHairiTileToOur(18)).toBe(9);
    expect(rsHairiTileToOur(31)).toBe(33);
    expect(rsHairiTileToOur(33)).toBe(31);
  });

  test('returns structural waits for a 13-tile hand in project tile ids', () => {
    const result = analyzeRiichiHand({
      hand: [
        0,
        1,
        2, // 123m
        18,
        19,
        20, // 123p
        27,
        27,
        27, // east triplet
        28,
        28,
        28, // south triplet
        13, // single 5s
      ],
    });

    expect(result.shanten).toBe(0);
    expect(result.effectiveTiles).toEqual([13]);
    expect(result.discardOptions).toEqual([]);
  });

  test('returns every 14-tile discard option with its resulting waits', () => {
    const result = analyzeRiichiHand({
      hand: [0, 1, 2, 18, 19, 20, 27, 27, 27, 28, 28, 28, 13, 14],
    });

    expect(result.shanten).toBe(0);
    expect(result.discardOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          discard: 13,
          shanten: 0,
          effectiveTiles: [14],
          isOptimal: true,
        }),
        expect.objectContaining({
          discard: 14,
          shanten: 0,
          effectiveTiles: [13],
          isOptimal: true,
        }),
      ]),
    );
  });

  test('counts an open kan as one three-tile logical meld for hairi', () => {
    const result = analyzeRiichiHand({
      hand: [0, 1, 2, 18, 19, 20, 9, 10, 11, 13],
      melds: [{ type: 'mingang', tiles: [27, 27, 27, 27] }],
    });

    expect(result.shanten).toBe(0);
    expect(result.effectiveTiles).toEqual([13]);
  });

  test('returns exact WASM score and outgoing tsumo payments', () => {
    const result = evaluateRiichiWin({
      state: {
        hand: [0, 1, 2, 3, 4, 5, 26, 26],
        melds: [
          { type: 'chi', tiles: [6, 7, 8] },
          { type: 'angang', tiles: [22, 22, 22, 22] },
        ],
        doraIndicators: [1],
        roundWind: 1,
        dealer: 1,
        riichiDeclared: [false, false, false, false],
        wallLength: 40,
        lastDiscard: null,
        winnerSeat: 0,
      },
      isTsumo: true,
      winningTile: 26,
    });

    expect(result.structuralAgari).toBe(true);
    expect(result.legalWin).toBe(true);
    expect(result.fu).toBe(40);
    expect(result.han).toBe(2);
    expect(result.totalPoints).toBe(2700);
    expect(result.tsumoPayments).toEqual({
      dealerOrAll: 1300,
      nonDealer: 700,
    });
    expect(result.yaku).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '一气通贯', han: 1 }),
        expect.objectContaining({ name: '宝牌', han: 1 }),
      ]),
    );
  });

  test.each([
    { dealer: 1, expected: 1000, label: '子家' },
    { dealer: 0, expected: 1500, label: '庄家' },
  ])('$label 30 符 1 番荣和使用精确点数', ({ dealer, expected }) => {
    const result = evaluateRiichiWin({
      state: {
        hand: [0, 1, 2, 3, 4, 5, 19, 20, 21, 14, 15, 22, 22],
        melds: [],
        doraIndicators: [],
        roundWind: 1,
        dealer,
        riichiDeclared: [false, false, false, false],
        wallLength: 40,
        lastDiscard: 16,
        winnerSeat: 0,
      },
      isTsumo: false,
      winningTile: 16,
    });

    expect(result.legalWin).toBe(true);
    expect(result.fu).toBe(30);
    expect(result.han).toBe(1);
    expect(result.totalPoints).toBe(expected);
  });

  test('re-evaluates a riichi win with ura indicators in WASM', () => {
    const result = evaluateRiichiWin({
      state: {
        hand: [0, 1, 2, 3, 4, 5, 6, 7, 8, 18, 19, 20, 26, 26],
        melds: [],
        doraIndicators: [33],
        roundWind: 1,
        dealer: 1,
        riichiDeclared: [true, false, false, false],
        wallLength: 40,
        lastDiscard: null,
        winnerSeat: 0,
      },
      isTsumo: true,
      winningTile: 26,
      uraDoraIndicators: [25],
    });

    expect(result.han).toBe(6);
    expect(result.uraDoraHan).toBe(2);
    expect(result.totalPoints).toBe(12000);
    expect(result.tsumoPayments).toEqual({
      dealerOrAll: 6000,
      nonDealer: 3000,
    });
    expect(result.yaku).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '54', name: '里宝牌', han: 2 }),
      ]),
    );
  });

  test('counts a discarded red five on ron without removing the normal five', () => {
    const result = evaluateRiichiWin({
      state: {
        hand: [18, 19, 20, 9, 10, 11, 6, 7, 8, 27, 27, 27, 34, 4],
        melds: [],
        doraIndicators: [33],
        roundWind: 1,
        dealer: 1,
        riichiDeclared: [true, false, false, false],
        wallLength: 40,
        lastDiscard: 34,
        winnerSeat: 0,
      },
      isTsumo: false,
      winningTile: 34,
    });

    expect(result.structuralAgari).toBe(true);
    expect(result.legalWin).toBe(true);
    expect(result.yaku).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '55', name: '赤宝牌', han: 1 }),
      ]),
    );
  });

  test('separates structural agari from a legal yaku-bearing win', () => {
    const result = evaluateRiichiWin({
      state: {
        hand: [0, 1, 2, 3, 4, 5, 24, 25, 26, 9, 10, 11, 27, 27],
        melds: [],
        // 北的下一张为东；东对子是 2 张宝牌，但宝牌本身不能作为和牌役。
        doraIndicators: [30],
        roundWind: 1,
        dealer: 1,
        riichiDeclared: [false, false, false, false],
        wallLength: 40,
        lastDiscard: 27,
        winnerSeat: 0,
      },
      isTsumo: false,
      winningTile: 27,
    });

    expect(result.structuralAgari).toBe(true);
    expect(result.legalWin).toBe(false);
    expect(result.totalPoints).toBe(0);
    expect(result.tsumoPayments).toBeNull();
  });
});
