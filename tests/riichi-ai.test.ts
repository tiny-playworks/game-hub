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

  test('初级保持进攻，标准在远手面对立直时防守，两者都只返回合法动作', () => {
    const state = createTestRound();
    state.hands[0] = tiles('147m147p147s12345z');
    state.riichiDeclared[1] = true;
    state.discardPiles[1] = [tile('1z')];
    const match = matchWithRound(state);
    const beginner = decideAiTurn(match.round, 0, 'beginner');
    const standard = decideAiTurn(match.round, 0, 'standard');
    expect(beginner).not.toEqual(standard);
    expect(applyEvent(match, beginner!)).not.toBeNull();
    expect(applyEvent(match, standard!)).not.toBeNull();
  });

  test('已有倍满役且立直不提升打点时，标准保留默听，初级选择立直', () => {
    const state = createTestRound();
    state.hands[0] = tiles('1122445577889m1z');
    state.drawnTile = tile('1z');
    state.doraIndicators = [tile('9p')];
    state.wall = Array.from({ length: 16 }, () => tile('9p'));
    const match = matchWithRound(state);
    expect(decideAiTurn(match.round, 0, 'standard')?.type).toBe('discard');
    expect(decideAiTurn(match.round, 0, 'beginner')?.type).toBe('riichi');
  });

  test('最后一局领先足够且有人立直时，已有役的标准 AI 保留换牌余地', () => {
    const state = createTestRound(0, 1, 4);
    state.hands[0] = tiles('123456m345p67s22p1z');
    state.drawnTile = tile('1z');
    state.scores = [43000, 27000, 20000, 10000];
    state.riichiDeclared[1] = true;
    state.discardPiles[1] = [tile('1z')];
    state.wall = Array.from({ length: 16 }, () => tile('9p'));
    expect(decideAiTurn(matchWithRound(state).round, 0, 'standard')?.type).toBe(
      'discard',
    );
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

  test('宣言牌形成的筋与早巡筋采用更保守的危险估计', () => {
    const visible = emptyVisibleCounts();
    const later = { ...opponent, discards: tiles('12z4m9p9s'), riichiIndex: 4 };
    const declaration = { ...later, riichiIndex: 2 };
    const early = { ...later, discards: tiles('4m12z9p9s') };
    expect(
      evaluateTileDanger(tile('1m'), declaration, visible),
    ).toBeGreaterThan(evaluateTileDanger(tile('1m'), later, visible));
    expect(evaluateTileDanger(tile('1m'), early, visible)).toBeGreaterThan(
      evaluateTileDanger(tile('1m'), later, visible),
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
    expect(decideAiClaim(state, 2, 'beginner')).toEqual({ type: 'pass' });
  });

  test('他家立直且自己未听牌时不冒险鸣牌', () => {
    const state = claimState('55z123m456p22s68s1m', '5z');
    state.riichiDeclared[1] = true;
    expect(decideAiClaim(state, 2, 'standard')).toEqual({ type: 'pass' });
  });
});
