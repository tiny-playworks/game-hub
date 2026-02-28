import { describe, expect, test } from '@rstest/core';
import {
  applyAiRiichiState,
  canAiRonOnClaim,
  chooseAiClaimActionAgainstRiichi,
  chooseAiDefensiveDiscard,
  chooseAiDefensiveDiscardWithMeta,
  evaluateTileDangerVsRiichi,
  shouldAiDeclareRiichi,
  shouldAiFoldClaimAgainstRiichi,
} from '../src/lib/riichiAi';

describe('日麻 AI 决策回归', () => {
  test('AI 立直：满足门清/听牌/点数且命中概率时应宣告', () => {
    const ok = shouldAiDeclareRiichi({
      alreadyRiichi: false,
      isMenzen: true,
      score: 12000,
      waitingCount: 3,
      random: 0.1,
    });
    expect(ok).toBe(true);
  });

  test('AI 立直：点数不足 1000 时必须禁止', () => {
    const ok = shouldAiDeclareRiichi({
      alreadyRiichi: false,
      isMenzen: true,
      score: 900,
      waitingCount: 2,
      random: 0.01,
    });
    expect(ok).toBe(false);
  });

  test('AI 立直状态应用：扣 1000 并增加棒池', () => {
    const out = applyAiRiichiState(
      [25000, 25000, 25000, 25000],
      [false, false, false, false],
      2000,
      2,
    );
    expect(out.scores).toEqual([25000, 25000, 24000, 25000]);
    expect(out.riichiDeclared).toEqual([false, false, true, false]);
    expect(out.riichiPot).toBe(3000);
  });

  test('AI 要牌轮：可和形+有役且非自打时应优先荣和', () => {
    const ok = canAiRonOnClaim({
      fromPlayer: 1,
      aiSeat: 2,
      isWinShape: true,
      hasYaku: true,
    });
    expect(ok).toBe(true);
  });

  test('防守危险度：立直家现物危险度应为最低', () => {
    const danger = evaluateTileDangerVsRiichi(4, [4, 12, 20]);
    expect(danger).toBe(0);
  });

  test('防守舍牌：有人立直时应优先切现物', () => {
    const picked = chooseAiDefensiveDiscard({
      hand: [4, 5, 17, 28],
      aiSeat: 2,
      riichiDeclared: [false, true, false, false],
      discardPiles: [[], [4, 22, 30], [], []],
    });
    expect(picked).toBe(4);
  });

  test('防守舍牌：无人立直时返回 null（不强制防守）', () => {
    const picked = chooseAiDefensiveDiscard({
      hand: [4, 5, 17, 28],
      aiSeat: 1,
      riichiDeclared: [false, false, false, false],
      discardPiles: [[], [], [], []],
    });
    expect(picked).toBe(null);
  });

  test('防守舍牌：同等危险度下优先保留赤宝牌', () => {
    const picked = chooseAiDefensiveDiscard({
      hand: [34, 6],
      aiSeat: 0,
      riichiDeclared: [false, true, false, false],
      discardPiles: [[], [], [], []],
    });
    expect(picked).toBe(6);
  });

  test('防守舍牌：同等危险度下优先保留宝牌', () => {
    const picked = chooseAiDefensiveDiscard({
      hand: [4, 6],
      aiSeat: 0,
      riichiDeclared: [false, true, false, false],
      discardPiles: [[], [], [], []],
      doraIndicators: [3],
    });
    expect(picked).toBe(6);
  });

  test('防守舍牌：绝对安全牌里优先切孤张字牌', () => {
    const picked = chooseAiDefensiveDiscard({
      hand: [27, 4, 5],
      aiSeat: 0,
      riichiDeclared: [false, true, false, false],
      discardPiles: [[], [27, 4, 31], [], []],
    });
    expect(picked).toBe(27);
  });

  test('防守舍牌：绝对安全牌里优先切孤张幺九', () => {
    const picked = chooseAiDefensiveDiscard({
      hand: [0, 3, 4],
      aiSeat: 0,
      riichiDeclared: [false, true, false, false],
      discardPiles: [[], [0, 3, 12], [], []],
    });
    expect(picked).toBe(0);
  });

  test('防守解释：应返回可读原因文本', () => {
    const out = chooseAiDefensiveDiscardWithMeta({
      hand: [4, 6, 28],
      aiSeat: 0,
      riichiDeclared: [false, true, false, false],
      discardPiles: [[], [4, 12], [], []],
    });
    expect(out.tile).toBe(4);
    expect(out.reason.length).toBeGreaterThan(0);
  });

  test('要牌防守：有他家立直时应转入过牌防守', () => {
    const fold = shouldAiFoldClaimAgainstRiichi({
      aiSeat: 2,
      riichiDeclared: [false, true, false, false],
    });
    expect(fold).toBe(true);
  });

  test('要牌防守：无人立直时不应强制过牌', () => {
    const fold = shouldAiFoldClaimAgainstRiichi({
      aiSeat: 2,
      riichiDeclared: [false, false, false, false],
    });
    expect(fold).toBe(false);
  });

  test('要牌中间档：牌效提升明显时允许谨慎碰', () => {
    const out = chooseAiClaimActionAgainstRiichi({
      aiSeat: 2,
      hand: [31, 31, 1, 4, 7, 10, 13, 16, 19, 22, 25, 27, 30],
      chiOptions: [],
      canPeng: true,
      lastTile: 31,
      riichiDeclared: [false, true, false, false],
      discardPiles: [[], [27, 31, 30], [], []],
    });
    expect(out.action).toBe('peng');
    expect(out.reason.includes('高于吃') || out.reason.includes('役牌碰')).toBe(
      true,
    );
  });

  test('要牌中间档：牌效提升不足时应继续过牌', () => {
    const out = chooseAiClaimActionAgainstRiichi({
      aiSeat: 2,
      hand: [1, 3, 7, 9, 12, 15, 18, 20, 22, 24, 27, 28, 29],
      chiOptions: [[1, 3]],
      canPeng: false,
      lastTile: 2,
      riichiDeclared: [false, true, false, false],
      discardPiles: [[], [2, 11, 19], [], []],
    });
    expect(out.action).toBe('pass');
  });

  test('要牌中间档：役牌碰应给出更高价值理由', () => {
    const out = chooseAiClaimActionAgainstRiichi({
      aiSeat: 0,
      hand: [27, 27, 1, 4, 7, 10, 13, 16, 19, 22, 25, 30, 31],
      chiOptions: [],
      canPeng: true,
      lastTile: 27,
      riichiDeclared: [false, true, false, false],
      discardPiles: [[], [27, 30, 31], [], []],
      seatWind: 0,
      roundWind: 0,
    });
    expect(out.action).toBe('peng');
    expect(out.reason.includes('役牌碰')).toBe(true);
  });
});
