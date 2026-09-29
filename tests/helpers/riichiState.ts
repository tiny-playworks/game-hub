import {
  createMatch,
  type RiichiMatchState,
} from '../../src/pages/mahjong/japanese/engine';
import { computeDrawTurnOptions } from '../../src/pages/mahjong/japanese/engine/options';
import { DEFAULT_RIICHI_RULES } from '../../src/pages/mahjong/japanese/engine/rules';
import type { RiichiGameState } from '../../src/pages/mahjong/japanese/types';

/** 规则场景的固定种子底座；默认关闭第一巡役，避免普通算分用例意外触发天地和。 */
export function createTestRound(
  dealer = 0,
  roundWind = 0,
  roundNumber = 1,
): RiichiGameState {
  const round = structuredClone(
    createMatch({ seed: 42, matchLength: 'south' }).match.round,
  );
  return {
    ...round,
    dealer,
    roundWind,
    roundNumber,
    firstTurn: [false, false, false, false],
  };
}

/** 修改测试牌姿后，重新从引擎计算合法操作，并用该局面作为回退起点。 */
export function matchWithRound(round: RiichiGameState): RiichiMatchState {
  const match = createMatch({ seed: 42, matchLength: round.matchLength }).match;
  const next = {
    ...round,
    turnOptions:
      round.phase === 'discard'
        ? computeDrawTurnOptions(
            round,
            round.currentPlayer,
            DEFAULT_RIICHI_RULES,
          )
        : null,
  };
  return {
    ...match,
    round: next,
    status: next.phase === 'end' ? 'roundEnd' : 'playing',
    roundStart: { eventIndex: 0, log: match.log, round: next },
  };
}
