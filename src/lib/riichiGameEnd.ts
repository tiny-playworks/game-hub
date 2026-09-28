export type MatchEndReason =
  | 'tobi'
  | 'east4_end'
  | 'south4_end'
  | 'agari_yame'
  | 'extension_end';

export interface MatchEndRules {
  /** 返点线：最后一局结束时需有人达到该分数，否则进入延长战 */
  returnScore: number;
  /** 未达返点线时是否进入延长战（东风战南入 / 半庄战西入） */
  extension: boolean;
  /** 最后一局庄家和了且为头名（且达返点线）时自动收场 */
  agariYame: boolean;
  /** 最后一局荒牌庄家听牌且为头名时收场 */
  tenpaiYame: boolean;
  /** 有人点数低于 0 时击飞终局 */
  tobi: boolean;
}

export const DEFAULT_MATCH_END_RULES: MatchEndRules = {
  returnScore: 30000,
  extension: true,
  agariYame: true,
  tenpaiYame: false,
  tobi: true,
};

export function isDealerTop(scores: number[], dealer: number): boolean {
  const dealerScore = scores[dealer] ?? Number.NEGATIVE_INFINITY;
  return scores.every((s, i) => i === dealer || dealerScore >= s);
}

/**
 * 终局判定（对齐雀魂段位规则）：
 * 1) 有人点数 < 0：击飞
 * 2) 最后一局（东风战东4 / 半庄战南4）：
 *    - 庄家和了且为头名并达返点线：和了止め；听牌连庄默认继续
 *    - 庄家连庄但不满足收场条件：继续
 *    - 换庄时有人达返点线：终局，否则进入延长战
 * 3) 延长战（南入 / 西入）：换庄时有人达返点线即终局；延长场第 4 局换庄后强制终局
 */
export function resolveRiichiMatchEnd(input: {
  scores: number[];
  roundWind: number;
  roundNumber: number;
  dealer: number;
  dealerStays: boolean;
  /** 庄家是否为和了连庄（区别于听牌连庄） */
  dealerWon?: boolean;
  matchLength: 'east' | 'south';
  rules?: Partial<MatchEndRules>;
}): { end: boolean; reason?: MatchEndReason } {
  const rules = { ...DEFAULT_MATCH_END_RULES, ...input.rules };
  if (rules.tobi && input.scores.some((s) => s < 0)) {
    return { end: true, reason: 'tobi' };
  }

  const lastWind = input.matchLength === 'east' ? 0 : 1;
  const isAllLast = input.roundWind === lastWind && input.roundNumber === 4;
  const inExtension = input.roundWind > lastWind;
  if (!isAllLast && !inExtension) return { end: false };

  const hasTarget = input.scores.some((s) => s >= rules.returnScore);
  if (input.dealerStays) {
    const yameAllowed = input.dealerWon ? rules.agariYame : rules.tenpaiYame;
    if (
      yameAllowed &&
      isDealerTop(input.scores, input.dealer) &&
      input.scores[input.dealer] >= rules.returnScore
    ) {
      return { end: true, reason: 'agari_yame' };
    }
    return { end: false };
  }

  if (isAllLast) {
    if (hasTarget || !rules.extension) {
      return {
        end: true,
        reason: input.matchLength === 'east' ? 'east4_end' : 'south4_end',
      };
    }
    return { end: false };
  }

  if (hasTarget || input.roundNumber === 4 || input.roundWind > lastWind + 1) {
    return { end: true, reason: 'extension_end' };
  }
  return { end: false };
}

/** 最终名次（分数高者在前；同分按座位号小者在前）。 */
export function rankSeatsByScore(scores: number[]): number[] {
  return scores
    .map((score, seat) => ({ score, seat }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.seat - b.seat))
    .map((x) => x.seat);
}
