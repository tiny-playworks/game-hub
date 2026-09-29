import { describe, expect, test } from '@rstest/core';
import {
  applyEvent,
  createMatch,
  evaluateSeatWin,
  getPendingSeats,
  type RiichiEvent,
  type RiichiMatchState,
} from '../src/pages/mahjong/japanese/engine';
import type { ClaimResponse } from '../src/pages/mahjong/japanese/types';
import { createTestRound, matchWithRound } from './helpers/riichiState';
import { tile, tiles } from './helpers/riichiTiles';

function play(match: RiichiMatchState, event: RiichiEvent): RiichiMatchState {
  const next = applyEvent(match, event);
  expect(next).not.toBeNull();
  if (!next) throw new Error(`事件被拒绝：${event.type}`);
  return next.match;
}

function answerClaims(
  match: RiichiMatchState,
  answers: Record<number, ClaimResponse> = {},
): RiichiMatchState {
  let current = match;
  while (current.round.phase === 'claim') {
    const [seat] = getPendingSeats(current.round);
    expect(seat).not.toBeUndefined();
    current = play(current, {
      type: 'claim',
      seat,
      response: answers[seat] ?? { type: 'pass' },
    });
  }
  return current;
}

function quietRound() {
  const state = createTestRound();
  state.hands = [
    tiles('147m147p147s12345z'),
    ...Array.from({ length: 3 }, () => tiles('147m147p147s1234z')),
  ];
  return state;
}

const waitWhite = () => tiles('123456m123p789s5z');

describe('日麻阶段 1 规则专项回归', () => {
  test('开局保留完整十四张死壁，庄家摸牌后活牌山为 69 张', () => {
    const { round } = createMatch({ seed: 1, matchLength: 'south' }).match;
    expect(round.wall).toHaveLength(69);
    expect(round.rinshanTiles).toHaveLength(4);
    expect(round.doraPool).toHaveLength(5);
    expect(round.uraPool).toHaveLength(5);
    expect(round.hands.map((hand) => hand.length)).toEqual([14, 13, 13, 13]);
  });

  test('加杠抢杠窗口仅开放荣和，第四张可以原本就在手中', () => {
    const state = quietRound();
    state.hands[0] = tiles('123m456p789s55z');
    state.drawnTile = tile('9s');
    state.melds[0] = [{ type: 'peng', tiles: tiles('555z'), fromPlayer: 2 }];
    state.hands[1] = waitWhite();
    const start = matchWithRound(state);
    expect(start.round.turnOptions?.kakan).toContainEqual({
      meldIndex: 0,
      tile: tile('5z'),
    });
    const window = play(start, {
      type: 'kakan',
      seat: 0,
      meldIndex: 0,
      tile: tile('5z'),
    });
    expect(window.round.claim?.kind).toBe('kakan');
    expect(window.round.claim?.options[1]).toEqual({
      ron: true,
      chi: [],
      pon: false,
      minkan: false,
    });
    expect(
      applyEvent(window, { type: 'claim', seat: 1, response: { type: 'pon' } }),
    ).toBeNull();
    const end = answerClaims(window, { 1: { type: 'ron' } });
    expect(end.round.result).toMatchObject({
      type: 'win',
      wins: [{ winner: 1, ronFrom: 0 }],
    });
    if (end.round.result?.type === 'win')
      expect(end.round.result.wins[0].yaku.some((y) => y.id === '39')).toBe(
        true,
      );
  });

  test('活牌山只剩一张时加杠仍完成岭上摸牌，不会留在鸣牌窗口', () => {
    const state = quietRound();
    state.hands[0] = tiles('123m456p789s55z');
    state.melds[0] = [{ type: 'peng', tiles: tiles('555z'), fromPlayer: 1 }];
    state.wall = [tile('1z')];
    const next = answerClaims(
      play(matchWithRound(state), {
        type: 'kakan',
        seat: 0,
        meldIndex: 0,
        tile: tile('5z'),
      }),
    );
    expect(next.round.phase).toBe('discard');
    expect(next.round.currentPlayer).toBe(0);
    expect(next.round.wall).toHaveLength(0);
    expect(next.round.rinshanTiles).toHaveLength(3);
    expect(next.round.doraIndicators).toHaveLength(2);
    expect(next.round.uraDoraIndicators).toHaveLength(2);
    expect(next.round.lastDrawWasRinshan).toBe(true);
  });

  test('活牌山耗尽时禁止开杠', () => {
    const state = quietRound();
    state.hands[0] = tiles('1111m234p678s55z12s');
    state.wall = [];
    const match = matchWithRound(state);
    expect(match.round.turnOptions?.ankan).toEqual([]);
    expect(
      applyEvent(match, { type: 'ankan', seat: 0, tiles: tiles('1111m') }),
    ).toBeNull();
  });

  test('海底和河底分别进入自摸与荣和算分，预览不借用偶发役', () => {
    const state = quietRound();
    state.melds[0] = [{ type: 'chi', tiles: tiles('123m'), fromPlayer: 3 }];
    state.hands[0] = tiles('456m234p789s55z');
    state.drawnTile = tile('5z');
    state.wall = [];
    const haitei = evaluateSeatWin({
      state,
      seat: 0,
      isTsumo: true,
      winningTile: tile('5z'),
    });
    expect(haitei.legalWin).toBe(true);
    expect(haitei.yaku.some((y) => y.id === '40')).toBe(true);
    expect(
      evaluateSeatWin({
        state,
        seat: 0,
        isTsumo: true,
        winningTile: tile('5z'),
        preview: true,
      }).legalWin,
    ).toBe(false);
    state.hands[0].pop();
    const houtei = evaluateSeatWin({
      state,
      seat: 0,
      isTsumo: false,
      winningTile: tile('5z'),
    });
    expect(houtei.legalWin).toBe(true);
    expect(houtei.yaku.some((y) => y.id === '41')).toBe(true);
  });

  test('立直后暗杠只允许待牌不变的摸入第四张', () => {
    const state = quietRound();
    state.hands[0] = tiles('1111m234p678s222s5z');
    state.drawnTile = tile('1m');
    state.riichiDeclared[0] = true;
    const match = matchWithRound(state);
    expect(match.round.turnOptions?.ankan).toEqual([tiles('1111m')]);
    const next = answerClaims(
      play(match, { type: 'ankan', seat: 0, tiles: tiles('1111m') }),
    );
    expect(next.round.hands[0]).toHaveLength(11);
    expect(next.round.melds[0][0].type).toBe('angang');
  });

  test('立直后会改变待牌的暗杠被拒绝', () => {
    const state = quietRound();
    state.hands[0] = tiles('111123m456p789s55z');
    state.drawnTile = tile('1m');
    state.riichiDeclared[0] = true;
    const match = matchWithRound(state);
    expect(match.round.turnOptions?.ankan).toEqual([]);
    expect(
      applyEvent(match, { type: 'ankan', seat: 0, tiles: tiles('1111m') }),
    ).toBeNull();
  });

  test('已有副露时暗杠后的门前牌按面子数计算', () => {
    const state = quietRound();
    state.melds[0] = [{ type: 'chi', tiles: tiles('123p'), fromPlayer: 3 }];
    state.hands[0] = tiles('1111m456s789p5z');
    const next = answerClaims(
      play(matchWithRound(state), {
        type: 'ankan',
        seat: 0,
        tiles: tiles('1111m'),
      }),
    );
    expect(next.round.hands[0]).toHaveLength(8);
    expect(next.round.melds[0]).toHaveLength(2);
    expect(next.round.turnOptions?.discardable.length).toBeGreaterThan(0);
  });

  test('两家同时荣和均结算，人类过牌不挡住 AI 荣和', () => {
    const state = quietRound();
    state.hands[1] = waitWhite();
    state.hands[2] = waitWhite();
    state.riichiDeclared[1] = state.riichiDeclared[2] = true;
    const window = play(matchWithRound(state), {
      type: 'discard',
      seat: 0,
      tile: tile('5z'),
    });
    const first = play(window, {
      type: 'claim',
      seat: 1,
      response: { type: 'ron' },
    });
    expect(first.status).toBe('playing');
    const end = answerClaims(first, { 2: { type: 'ron' } });
    expect(end.round.result?.type).toBe('win');
    if (end.round.result?.type !== 'win') throw new Error('未双响');
    expect(end.round.result.wins.map((win) => win.winner)).toEqual([1, 2]);
    expect(end.round.result.settlement.deltas[1]).toBeGreaterThan(0);
    expect(end.round.result.settlement.deltas[2]).toBeGreaterThan(0);
    expect(end.round.result.settlement.deltas.reduce((a, b) => a + b, 0)).toBe(
      0,
    );
  });

  test('自家放过荣和之后，另一家仍可荣和', () => {
    const state = quietRound();
    state.currentPlayer = 3;
    state.hands[3] = state.hands[0];
    state.hands[0] = waitWhite();
    state.hands[1] = waitWhite();
    state.riichiDeclared[0] = state.riichiDeclared[1] = true;
    let match = play(matchWithRound(state), {
      type: 'discard',
      seat: 3,
      tile: tile('5z'),
    });
    match = play(match, { type: 'claim', seat: 0, response: { type: 'pass' } });
    const end = answerClaims(match, { 1: { type: 'ron' } });
    expect(end.round.result).toMatchObject({
      type: 'win',
      wins: [{ winner: 1 }],
    });
  });

  test('三家和按规则途中流局', () => {
    const state = quietRound();
    for (const seat of [1, 2, 3]) {
      state.hands[seat] = waitWhite();
      state.riichiDeclared[seat] = true;
    }
    const window = play(matchWithRound(state), {
      type: 'discard',
      seat: 0,
      tile: tile('5z'),
    });
    expect(
      answerClaims(window, {
        1: { type: 'ron' },
        2: { type: 'ron' },
        3: { type: 'ron' },
      }).round.result,
    ).toMatchObject({ type: 'draw', reason: 'sanchahou' });
  });

  test('吃牌后禁止现物与筋食替，仍保留其他合法舍牌', () => {
    const state = quietRound();
    state.hands[1] = tiles('2345m147p147s123z');
    state.hands[0][0] = tile('2m');
    const window = play(matchWithRound(state), {
      type: 'discard',
      seat: 0,
      tile: tile('2m'),
    });
    const called = answerClaims(window, {
      1: { type: 'chi', tiles: tiles('34m') as [number, number] },
    });
    expect(called.round.currentPlayer).toBe(1);
    expect(called.round.turnOptions?.discardable).not.toContain(tile('2m'));
    expect(called.round.turnOptions?.discardable).not.toContain(tile('5m'));
    expect(
      applyEvent(called, { type: 'discard', seat: 1, tile: tile('2m') }),
    ).toBeNull();
    expect(called.round.turnOptions?.discardable).toContain(tile('1z'));
  });

  test('立直后一巡的摸牌保留一发直到自摸结算', () => {
    const state = quietRound();
    state.hands[0] = waitWhite();
    state.riichiDeclared[0] = true;
    state.ippatsuPossible[0] = true;
    state.currentPlayer = 3;
    state.hands[3] = tiles('147m147p147s12345z');
    state.wall = [tile('5z'), tile('9m')];
    const drawn = answerClaims(
      play(matchWithRound(state), {
        type: 'discard',
        seat: 3,
        tile: tile('4z'),
      }),
    );
    expect(drawn.round.currentPlayer).toBe(0);
    expect(drawn.round.ippatsuPossible[0]).toBe(true);
    const end = play(drawn, { type: 'tsumo', seat: 0 });
    expect(end.round.result?.type).toBe('win');
    if (end.round.result?.type === 'win')
      expect(end.round.result.wins[0].yaku.some((y) => y.id === '37')).toBe(
        true,
      );
  });

  test('第四家立直的宣言牌先判荣和，被荣和时不收立直棒', () => {
    const state = quietRound();
    state.hands[0] = tiles('123456m123p789s15z');
    state.hands[1] = waitWhite();
    state.riichiDeclared = [false, true, true, true];
    const window = play(matchWithRound(state), {
      type: 'riichi',
      seat: 0,
      tile: tile('5z'),
    });
    expect(window.status).toBe('playing');
    expect(window.round.scores[0]).toBe(25000);
    const end = answerClaims(window, { 1: { type: 'ron' } });
    expect(end.round.result?.type).toBe('win');
    expect(end.round.riichiPot).toBe(0);
  });

  test('局结束后拒绝摸打和鸣牌，只有下一局事件可推进', () => {
    const state = quietRound();
    state.hands[0] = tiles('19m19p19s1234567z1m');
    state.firstTurn[0] = true;
    const end = play(matchWithRound(state), { type: 'kyuushu', seat: 0 });
    expect(end.status).toBe('roundEnd');
    expect(
      applyEvent(end, { type: 'discard', seat: 0, tile: tile('1m') }),
    ).toBeNull();
    expect(
      applyEvent(end, { type: 'claim', seat: 1, response: { type: 'pass' } }),
    ).toBeNull();
    const next = play(end, { type: 'nextRound' });
    expect(next.status).toBe('playing');
    expect(next.round.honba).toBe(1);
    expect(next.round.roundId).toBe(1);
  });
});
