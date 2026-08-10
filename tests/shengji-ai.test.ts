import { expect, test } from '@rstest/core';
import {
  applyAITurn,
  cardPoints,
  createInitialState,
  currentTrickLeaderSeat,
  getAIPlay,
  getValidPlays,
  isTrump,
  partner,
  playCard,
  type ShengjiState,
  teamIndex,
} from '../src/lib/shengji';

/** 手工摆一个可控局面 */
const buildState = (over: Partial<ShengjiState>): ShengjiState => ({
  ...createInitialState(),
  trumpSuit: 0,
  levelRank: 12,
  currentTrick: [],
  trickLeader: 0,
  teamScores: [0, 0],
  tricksPlayed: 0,
  roundOver: false,
  defenderUpgrade: false,
  lastTrick: null,
  ...over,
});

test('升级：一墩打完后保留 lastTrick，界面才能回放这一墩', () => {
  let state = buildState({
    hands: [[1], [2], [3], [4]],
    currentPlayer: 0,
    trickLeader: 0,
  });
  for (let i = 0; i < 4; i++) {
    state = playCard(
      state,
      state.currentPlayer,
      state.hands[state.currentPlayer][0],
    );
  }
  expect(state.currentTrick).toHaveLength(0);
  expect(state.lastTrick).not.toBeNull();
  expect(state.lastTrick?.cards).toHaveLength(4);
  expect(state.lastTrick?.leader).toBe(0);
  expect([0, 1, 2, 3]).toContain(state.lastTrick?.winner);
});

test('升级：lastTrick 记录的分数与该墩实际分牌一致', () => {
  // 5 是 5 分（rank 2），K 是 10 分（rank 10）
  const five = 2; // ♠5
  const king = 10; // ♠K
  let state = buildState({
    hands: [[five], [king], [0], [1]],
    currentPlayer: 0,
    trickLeader: 0,
  });
  for (let i = 0; i < 4; i++) {
    state = playCard(
      state,
      state.currentPlayer,
      state.hands[state.currentPlayer][0],
    );
  }
  expect(state.lastTrick?.points).toBe(cardPoints(five) + cardPoints(king));
  expect(state.lastTrick?.points).toBe(15);
});

test('升级 AI：只出合法牌（必须跟花色）', () => {
  // 领出 ♥3（副牌），玩家 1 手上有红桃就必须跟红桃
  const heart3 = 13;
  const state = buildState({
    hands: [[], [14, 15, 26], [], []],
    currentTrick: [heart3],
    trickLeader: 0,
    currentPlayer: 1,
  });
  const card = getAIPlay(state);
  expect(card).not.toBeNull();
  expect(getValidPlays(state, 1)).toContain(card as number);
});

test('升级 AI：队友已经拿下这一墩时会贴分牌', () => {
  // 0 领出 ♥A（很大），2 是 0 的队友，轮到 2 出牌
  const heartAce = 13 + 11;
  const heart4 = 13 + 1; // 无分
  const heartKing = 13 + 10; // 10 分
  const state = buildState({
    hands: [[], [], [heart4, heartKing], []],
    currentTrick: [heartAce, 13 + 0],
    trickLeader: 0,
    currentPlayer: 2,
  });
  expect(currentTrickLeaderSeat(state)).toBe(0);
  expect(partner(2)).toBe(0);
  expect(getAIPlay(state)).toBe(heartKing);
});

test('升级 AI：对手领先时用能赢的最小一张压过去', () => {
  // 0 领出 ♥5，玩家 1（对手）手上有 ♥6 和 ♥A，应该出 ♥6
  const heart5 = 13 + 2;
  const heart6 = 13 + 3;
  const heartAce = 13 + 11;
  const state = buildState({
    hands: [[], [heartAce, heart6], [], []],
    currentTrick: [heart5],
    trickLeader: 0,
    currentPlayer: 1,
  });
  expect(getAIPlay(state)).toBe(heart6);
});

test('升级 AI：赢不了这一墩时不会白送分牌', () => {
  // 0 领出 ♥A，玩家 1 只有更小的红桃：一张分牌 ♥10 和一张闲张 ♥4
  const heartAce = 13 + 11;
  const heart10 = 13 + 7; // 10 分
  const heart4 = 13 + 1; // 无分
  const state = buildState({
    hands: [[], [heart10, heart4], [], []],
    currentTrick: [heartAce],
    trickLeader: 0,
    currentPlayer: 1,
  });
  const card = getAIPlay(state);
  expect(cardPoints(card as number)).toBe(0);
  expect(card).toBe(heart4);
});

test('升级：整局自动打完 13 墩并结算，AI 不会死循环', () => {
  let state = createInitialState();
  let guard = 0;
  while (!state.roundOver && guard < 200) {
    guard += 1;
    if (state.currentPlayer === 0) {
      const valid = getValidPlays(state, 0);
      expect(valid.length).toBeGreaterThan(0);
      state = playCard(state, 0, valid[0]);
    } else {
      const before = state;
      state = applyAITurn(state);
      expect(state).not.toBe(before);
    }
  }
  expect(state.roundOver).toBe(true);
  expect(state.tricksPlayed).toBe(13);
  expect(state.hands.every((h) => h.length === 0)).toBe(true);
  // 全副牌共 100 分，扣底的分不参与逐墩结算，抠底时再按两倍补给闲家
  const buriedPoints = state.bottomCards.reduce(
    (sum, c) => sum + cardPoints(c),
    0,
  );
  expect(state.teamScores[0] + state.teamScores[1]).toBe(
    100 - buriedPoints + state.bottomBonus,
  );
  expect(state.defenderUpgrade).toBe(state.teamScores[1] >= 40);
});

test('升级：庄家扣底优先埋无分牌，不会把 5/10/K 埋掉', () => {
  // 随机开局多试几次，扣底里出现分牌应当是极少数（只有手上全是分牌才会发生）
  let withPoints = 0;
  for (let i = 0; i < 30; i++) {
    const state = createInitialState();
    expect(state.bottomCards).toHaveLength(2);
    const points = state.bottomCards.reduce((s, c) => s + cardPoints(c), 0);
    if (points > 0) withPoints += 1;
  }
  expect(withPoints).toBe(0);
});

test('升级：末墩由闲家赢下时抠底，底分按两倍计入闲家', () => {
  const heartKing = 13 + 10; // 10 分
  const spade4 = 1;
  // 庄家为 0（庄家队 0/2），让闲家 1 用大牌赢下第 13 墩
  const state = buildState({
    dealer: 0,
    hands: [[0], [12], [2], [3]],
    currentPlayer: 0,
    trickLeader: 0,
    tricksPlayed: 12,
    bottomCards: [heartKing, spade4],
  });
  let next = state;
  for (let i = 0; i < 4; i++) {
    next = playCard(
      next,
      next.currentPlayer,
      next.hands[next.currentPlayer][0],
    );
  }
  expect(next.roundOver).toBe(true);
  expect(teamIndex(next.lastTrick?.winner ?? 0)).toBe(1);
  expect(next.bottomBonus).toBe(20);
  expect(next.teamScores[1]).toBeGreaterThanOrEqual(20);
});

test('升级：主牌判定与队伍划分符合规则', () => {
  const state = buildState({ trumpSuit: 1, levelRank: 12 });
  expect(isTrump(13 + 5, state.trumpSuit, state.levelRank)).toBe(true); // 红桃
  expect(isTrump(53, state.trumpSuit, state.levelRank)).toBe(true); // 大王
  expect(isTrump(12, state.trumpSuit, state.levelRank)).toBe(true); // 级牌 2
  expect(isTrump(1, state.trumpSuit, state.levelRank)).toBe(false); // ♠4
  expect(teamIndex(0)).toBe(teamIndex(2));
  expect(teamIndex(1)).toBe(teamIndex(3));
  expect(teamIndex(0)).not.toBe(teamIndex(1));
});
