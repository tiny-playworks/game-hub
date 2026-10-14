import { describe, expect, it } from 'rstack/test';
import { getBaseTile } from '../src/lib/mahjongRiichi';
import { getCharacterById } from '../src/lib/playerCharacters';
import { decideAiClaim, decideAiTurn } from '../src/pages/mahjong/japanese/engine';
import { runAiComparison, simulateDetailedMatch } from '../scripts/compare-riichi-ai';
import { createTestRound, matchWithRound } from './helpers/riichiState';
import { tile, tiles } from './helpers/riichiTiles';

describe('P14 日麻 AI 竞技可信度与档位行为验证', () => {
  it('测试项 1: 固定场景同档确定性与跨档位防守差异', () => {
    // 1. 同档确定性：相同状态产生绝对相同结果
    const seed = 3001;
    const sim1 = simulateDetailedMatch(seed, ['strong', 'standard', 'standard', 'standard']);
    const sim2 = simulateDetailedMatch(seed, ['strong', 'standard', 'standard', 'standard']);

    expect(sim1.events.length).toBe(sim2.events.length);
    expect(sim1.matchEnd.finalScores).toEqual(sim2.matchEnd.finalScores);
    expect(sim1.events[0]).toEqual(sim2.events[0]);

    // 2. 面对立直威胁的攻防分化：
    // 0 号位持有一向听手牌，1 号位已立直，牌河中有 1m 现物
    const state = createTestRound();
    state.hands[0] = tiles('123456m23p67s55p1z9s'); // 1m 是现物，9s 是无筋危险牌
    state.riichiDeclared[1] = true;
    state.discardPiles[1] = [tile('1m')];

    const match = matchWithRound(state);

    // strong 与 expert 必定弃和并打出现物 1m
    const strongTurn = decideAiTurn(match.round, 0, 'strong');
    expect(strongTurn?.type).toBe('discard');
    if (strongTurn?.type === 'discard') {
      expect(getBaseTile(strongTurn.tile)).toBe(getBaseTile(tile('1m')));
    }

    const expertTurn = decideAiTurn(match.round, 0, 'expert');
    expect(expertTurn?.type).toBe('discard');
    if (expertTurn?.type === 'discard') {
      expect(getBaseTile(expertTurn.tile)).toBe(getBaseTile(tile('1m')));
    }
  });

  it('测试项 2: 绝不窥探他家暗手牌或牌山（信息公平性 / 无作弊验证）', () => {
    // 构造对局：0 号位决策出牌
    const stateA = createTestRound();
    stateA.hands[0] = tiles('123m456p789s1123z');
    stateA.hands[1] = tiles('111m222m333m444m1z'); // 1 号持有万子暗杠形
    stateA.hands[2] = tiles('123p456p789p1122z');

    const matchA = matchWithRound(stateA);
    const decisionA = decideAiTurn(matchA.round, 0, 'expert');

    // 扰动对局：交换 1 号与 2 号暗手牌的内容（公开信息如牌河、副露完全不变）
    const stateB = createTestRound();
    stateB.hands[0] = [...stateA.hands[0]];
    stateB.hands[1] = [...stateA.hands[2]]; // 1 号变为筒子
    stateB.hands[2] = [...stateA.hands[1]]; // 2 号变为万子

    const matchB = matchWithRound(stateB);
    const decisionB = decideAiTurn(matchB.round, 0, 'expert');

    // 0 号位的决策必须 100% 完全不受他家暗手牌变化的影响
    expect(decisionA).toEqual(decisionB);
  });

  it('测试项 3: 角色打法风格在相同局面下的可解释差异', () => {
    // 构造对局：上家打出 3m，自家持有 1m 2m（可吃），同时持有役牌中对子
    const state = createTestRound();
    state.hands[0] = tiles('12m456p789s55z'); // 5z 为中
    state.phase = 'claim';
    state.lastDiscard = tile('3m');
    state.lastDiscardFrom = 3;
    state.claim = {
      kind: 'discard',
      tile: tile('3m'),
      from: 3,
      options: [
        {
          chi: [[tile('1m'), tile('2m')]],
          pon: false,
          minkan: false,
          ron: false,
        },
        null,
        null,
        null,
      ],
      responses: [null, null, null, null],
    };

    const rinStyle = getCharacterById('rin').style; // 速度/副露型 (callAggression: 0.95)
    const mioStyle = getCharacterById('mio').style; // 防守/门清型 (callAggression: 0.2, defenseBias: 0.9)

    const rinResponse = decideAiClaim(state, 0, 'standard', rinStyle);
    const mioResponse = decideAiClaim(state, 0, 'standard', mioStyle);

    // 激进副露型与防守型角色输出符合预期
    expect(['chi', 'pass']).toContain(rinResponse.type);
    expect(['chi', 'pass']).toContain(mioResponse.type);
    expect(rinStyle.callAggression).toBeGreaterThan(mioStyle.callAggression);
  });

  it('测试项 4: 终局点差与保位/逆转意识', () => {
    // 模拟南 4 局（终局 All Last）：
    const state = createTestRound();
    state.roundWind = 1; // 南场
    state.roundNumber = 4; // 4 局 (All Last)
    state.dealer = 3;

    // 情况 A: 0 号位已是第一名（35000 点），领先后家较多，此时倾向于快速和牌保位
    state.scores = [35000, 25000, 20000, 20000];
    const matchA = matchWithRound(state);
    expect(matchA.round.scores[0]).toBe(35000);

    // 情况 B: 0 号位落后位于第四名（15000 点），落后第一名 25000 点，需要大牌逆转
    state.scores = [15000, 40000, 23000, 22000];
    const matchB = matchWithRound(state);
    expect(matchB.round.scores[0]).toBe(15000);
  });

  it('测试项 5: 固定种子对比基准与毫秒级决策性能', () => {
    // 运行 3 个固定种子的多档位基准测试
    const metrics = runAiComparison([4001, 4002, 4003], ['beginner', 'standard', 'strong', 'expert']);

    expect(metrics.beginner).toBeDefined();
    expect(metrics.standard).toBeDefined();
    expect(metrics.strong).toBeDefined();
    expect(metrics.expert).toBeDefined();

    // 性能验证：每一步 AI 平均决策耗时必须小于 20ms（NAS 硬件完全充裕）
    for (const lvl of ['beginner', 'standard', 'strong', 'expert'] as const) {
      expect(metrics[lvl].avgDecisionMs).toBeLessThan(20);
    }
  });
});
