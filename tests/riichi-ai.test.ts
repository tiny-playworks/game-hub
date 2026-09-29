import { describe, expect, test } from '@rstest/core';
import {
  evaluateTileDanger,
  evaluateTileValue,
  type OpponentView,
} from '../src/lib/riichiAi';
import { emptyVisibleCounts } from '../src/lib/riichiShanten';
import {
  applyEvent,
  decideAiClaim,
  decideAiTurn,
  getPendingSeats,
} from '../src/pages/mahjong/japanese/engine';
import { computeClaimOptions } from '../src/pages/mahjong/japanese/engine/options';
import { DEFAULT_RIICHI_RULES } from '../src/pages/mahjong/japanese/engine/rules';
import { createTestRound, matchWithRound } from './helpers/riichiState';
import { tile, tiles } from './helpers/riichiTiles';

const opponent: OpponentView = {
  discards: [4, 12, 20],
  safeAfterRiichi: [],
  riichi: true,
  riichiIndex: 0,
  meldCount: 0,
};

describe('日麻确定性 AI 决策回归', () => {
  test('同一局面始终产生同一合法事件，不改写输入', () => {
    const match = matchWithRound(createTestRound());
    const snapshot = structuredClone(match.round);
    const event = decideAiTurn(match.round, 0, 'standard');
    expect(event).not.toBeNull();
    expect(decideAiTurn(structuredClone(match.round), 0, 'standard')).toEqual(
      event,
    );
    expect(match.round).toEqual(snapshot);
    expect(applyEvent(match, event!)).not.toBeNull();
  });

  test('无役听牌选择立直，并在宣言牌通过后缴纳立直棒', () => {
    const state = createTestRound();
    state.hands[0] = tiles('123456m234p678s5p1z');
    state.drawnTile = tile('1z');
    let match = matchWithRound(state);
    const event = decideAiTurn(match.round, 0, 'standard');
    expect(event).toEqual({ type: 'riichi', seat: 0, tile: tile('1z') });
    match = applyEvent(match, event!)!.match;
    while (match.round.phase === 'claim') {
      const seat = getPendingSeats(match.round)[0];
      match = applyEvent(match, {
        type: 'claim',
        seat,
        response: { type: 'pass' },
      })!.match;
    }
    expect(match.round.scores[0]).toBe(24000);
    expect(match.round.riichiPot).toBe(1000);
  });

  test('点数不足 1000 时不宣告立直', () => {
    const state = createTestRound();
    state.hands[0] = tiles('123456m234p678s5p1z');
    state.scores[0] = 900;
    state.drawnTile = tile('1z');
    expect(decideAiTurn(matchWithRound(state).round, 0, 'standard')?.type).toBe(
      'discard',
    );
  });

  test('立直后只打摸入牌', () => {
    const state = createTestRound();
    state.hands[0] = tiles('123456m234p678s5p1z');
    state.riichiDeclared[0] = true;
    state.drawnTile = tile('1z');
    expect(decideAiTurn(matchWithRound(state).round, 0, 'standard')).toEqual({
      type: 'discard',
      seat: 0,
      tile: tile('1z'),
    });
  });

  test('手牌很远而他家立直时选择现物', () => {
    const state = createTestRound();
    state.hands[0] = tiles('147m147p147s12345z');
    state.riichiDeclared[1] = true;
    state.discardPiles[1] = [tile('1z')];
    expect(decideAiTurn(matchWithRound(state).round, 0, 'standard')).toEqual({
      type: 'discard',
      seat: 0,
      tile: tile('1z'),
    });
  });

  test('现物和立直后安全牌的危险度为零', () => {
    expect(evaluateTileDanger(4, opponent, emptyVisibleCounts())).toBe(0);
    expect(evaluateTileDanger(34, opponent, emptyVisibleCounts())).toBe(0);
    expect(
      evaluateTileDanger(
        7,
        { ...opponent, safeAfterRiichi: [7] },
        emptyVisibleCounts(),
      ),
    ).toBe(0);
  });

  test('壁和已见三枚字牌会降低危险度', () => {
    const visible = emptyVisibleCounts();
    const plain = { ...opponent, discards: [] };
    const before = evaluateTileDanger(0, plain, visible);
    visible[1] = 4;
    expect(evaluateTileDanger(0, plain, visible)).toBeLessThan(before);
    visible[27] = 3;
    expect(evaluateTileDanger(27, plain, visible)).toBeLessThan(
      evaluateTileDanger(28, plain, visible),
    );
  });

  test('同等牌效下保留赤五和宝牌的价值更高', () => {
    const ctx = { doraIndicators: [3], seatWind: 0, roundWind: 0 };
    expect(evaluateTileValue(34, [34, 4], ctx)).toBeGreaterThan(
      evaluateTileValue(4, [34, 4], ctx),
    );
    expect(evaluateTileValue(4, [4, 6], ctx)).toBeGreaterThan(
      evaluateTileValue(6, [4, 6], ctx),
    );
  });

  function claimState(hand: string, called: string) {
    const state = createTestRound();
    state.phase = 'claim';
    state.hands[2] = tiles(hand);
    state.claim = {
      tile: tile(called),
      from: 1,
      kind: 'discard',
      options: computeClaimOptions(
        state,
        tile(called),
        1,
        'discard',
        DEFAULT_RIICHI_RULES,
      ),
      responses: [null, null, null, null],
    };
    return state;
  }

  test('合法荣和优先于所有鸣牌和防守', () => {
    const state = claimState('123456m234p678s5p', '5p');
    state.riichiDeclared[2] = true;
    state.claim!.options = computeClaimOptions(
      state,
      tile('5p'),
      1,
      'discard',
      DEFAULT_RIICHI_RULES,
    );
    expect(decideAiClaim(state, 2, 'standard')).toEqual({ type: 'ron' });
  });

  test('役牌碰使向听下降时鸣牌', () => {
    const state = claimState('55z123m456p22s68s1m', '5z');
    expect(decideAiClaim(state, 2, 'standard')).toEqual({ type: 'pon' });
  });

  test('无役路线的碰牌选择过牌', () => {
    const state = claimState('22m456p789s11z89p4z', '2m');
    expect(state.claim!.options[2]?.pon).toBe(true);
    expect(decideAiClaim(state, 2, 'standard')).toEqual({ type: 'pass' });
  });

  test('他家立直且自己未听牌时不冒险鸣牌', () => {
    const state = claimState('55z123m456p22s68s1m', '5z');
    state.riichiDeclared[1] = true;
    expect(decideAiClaim(state, 2, 'standard')).toEqual({ type: 'pass' });
  });
});
