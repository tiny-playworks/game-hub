import { describe, expect, test } from '@rstest/core';
import {
  settleNagashiMangan,
  settleRyuukyoku,
  settleWins,
} from '../src/lib/riichiSettlement';
import {
  applyEvent,
  decideAiTurn,
  evaluateSeatWin,
  getPendingSeats,
} from '../src/pages/mahjong/japanese/engine';
import { computeClaimOptions } from '../src/pages/mahjong/japanese/engine/options';
import { DEFAULT_RIICHI_RULES } from '../src/pages/mahjong/japanese/engine/rules';
import { createTestRound, matchWithRound } from './helpers/riichiState';
import { tile, tiles } from './helpers/riichiTiles';

const scores = [25000, 25000, 25000, 25000];

describe('阶段 2：特殊役与结算边界', () => {
  test('双立直按两番结算；庄家首摸天和、子家首摸地和', () => {
    const round = createTestRound();
    round.hands[0] = tiles('123456m123p789s55z');
    round.drawnTile = tile('5z');
    round.riichiDeclared[0] = true;
    round.doubleRiichi[0] = true;
    const double = evaluateSeatWin({
      state: round,
      seat: 0,
      isTsumo: true,
      winningTile: tile('5z'),
    });
    expect(double.yaku).toContainEqual(
      expect.objectContaining({ id: '29', han: 2 }),
    );

    round.riichiDeclared[0] = false;
    round.firstTurn[0] = true;
    expect(
      evaluateSeatWin({
        state: round,
        seat: 0,
        isTsumo: true,
        winningTile: tile('5z'),
      }).yaku,
    ).toContainEqual(expect.objectContaining({ id: '13' }));

    round.dealer = 1;
    expect(
      evaluateSeatWin({
        state: round,
        seat: 0,
        isTsumo: true,
        winningTile: tile('5z'),
      }).yaku,
    ).toContainEqual(expect.objectContaining({ id: '14' }));
  });

  test('三张不同花色赤五均进入同一次和牌番数', () => {
    const round = createTestRound();
    round.hands[0] = tiles('123406m406p406s55z');
    round.drawnTile = tile('5z');
    const win = evaluateSeatWin({
      state: round,
      seat: 0,
      isTsumo: true,
      winningTile: tile('5z'),
    });
    expect(win.legalWin).toBe(true);
    expect(win.yaku).toContainEqual(
      expect.objectContaining({ id: '55', han: 3 }),
    );
  });

  test('无人鸣牌的首巡荣和判定人和', () => {
    const round = createTestRound();
    round.hands[1] = tiles('123456m123p789s5z');
    round.firstTurn[1] = true;
    const win = evaluateSeatWin({
      state: round,
      seat: 1,
      isTsumo: false,
      winningTile: tile('5z'),
    });
    expect(win.yaku).toContainEqual(expect.objectContaining({ id: '15' }));
  });

  test.each([
    { ready: [0], deltas: [3000, -1000, -1000, -1000] },
    { ready: [0, 1], deltas: [1500, 1500, -1500, -1500] },
    { ready: [0, 1, 2], deltas: [1000, 1000, 1000, -3000] },
    { ready: [], deltas: [0, 0, 0, 0] },
  ])('$ready 家听牌时不听罚符精确守恒', ({ ready, deltas }) => {
    const result = settleRyuukyoku(scores, ready, 2000);
    expect(result.deltas).toEqual(deltas);
    expect(result.nextRiichiPot).toBe(2000);
    expect(result.newScores.reduce((a, b) => a + b, 0)).toBe(100000);
  });

  test('连续本场与立直棒只归双响第一位', () => {
    const result = settleWins({
      scores,
      dealer: 0,
      honba: 3,
      riichiPot: 2000,
      ronFrom: 0,
      wins: [
        { winner: 1, isTsumo: false, baseTen: 2000 },
        { winner: 2, isTsumo: false, baseTen: 2000 },
      ],
    });
    expect(result.payments.filter((p) => p.reason === 'honba')).toEqual([
      expect.objectContaining({ from: 0, to: 1, amount: 900 }),
    ]);
    expect(
      result.payments.filter((p) => p.reason === 'riichi').map((p) => p.to),
    ).toEqual([1, 1]);
    expect(result.newScores.reduce((a, b) => a + b, 0)).toBe(102000);
  });

  test('包牌责任者支付役满自摸；流局满贯不执行不听罚符', () => {
    const pao = settleWins({
      scores,
      dealer: 0,
      honba: 0,
      riichiPot: 0,
      wins: [
        {
          winner: 1,
          isTsumo: true,
          baseTen: 32000,
          tsumoPayments: { dealerOrAll: 16000, nonDealer: 8000 },
          paoSeat: 2,
          paoShare: 1,
        },
      ],
    });
    expect(pao.payments).toEqual([
      expect.objectContaining({ from: 2, to: 1, amount: 32000, reason: 'pao' }),
    ]);
    const nagashi = settleNagashiMangan(scores, 0, [1], 1000);
    expect(nagashi.payments.every((p) => p.reason === 'nagashi')).toBe(true);
    expect(nagashi.deltas).toEqual([-4000, 8000, -2000, -2000]);
    expect(nagashi.nextRiichiPot).toBe(1000);
  });

  test('AI 碰牌后按牌效舍牌，不固定舍第一张手牌', () => {
    const round = createTestRound();
    round.phase = 'claim';
    round.hands[1] = tiles('55z123m456p22s68s1z');
    round.claim = {
      tile: tile('5z'),
      from: 0,
      kind: 'discard',
      options: computeClaimOptions(
        round,
        tile('5z'),
        0,
        'discard',
        DEFAULT_RIICHI_RULES,
      ),
      responses: [null, null, null, null],
    };
    let match = matchWithRound(round);
    while (match.round.phase === 'claim') {
      const seat = getPendingSeats(match.round)[0];
      const response =
        seat === 1 ? { type: 'pon' as const } : { type: 'pass' as const };
      match = applyEvent(match, { type: 'claim', seat, response })!.match;
    }
    expect(match.round.currentPlayer).toBe(1);
    const event = decideAiTurn(match.round, 1, 'standard');
    expect(event?.type).toBe('discard');
    if (event?.type === 'discard')
      expect(event.tile).not.toBe(match.round.hands[1][0]);
    expect(applyEvent(match, event!)).not.toBeNull();
  });
});
