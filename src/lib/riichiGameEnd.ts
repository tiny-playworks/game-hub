export type MatchEndReason = 'tobi' | 'south4_end' | 'agari_yame';

export function isDealerTop(scores: number[], dealer: number): boolean {
  const dealerScore = scores[dealer] ?? Number.NEGATIVE_INFINITY;
  return scores.every((s, i) => i === dealer || dealerScore >= s);
}

/**
 * 终局判定（简化天凤/雀魂常规）：
 * 1) 任意玩家分数 < 0：击飞终局
 * 2) 南4（roundWind=1, roundNumber=4）时：
 *    - 庄家连庄且庄家头名：可收场（agari-yame）
 *    - 非连庄：本局后结束
 */
export function resolveRiichiMatchEnd(input: {
  scores: number[];
  roundWind: number;
  roundNumber: number;
  dealer: number;
  dealerStays: boolean;
}): { end: boolean; reason?: MatchEndReason } {
  if (input.scores.some((s) => s < 0)) return { end: true, reason: 'tobi' };

  const isSouth4 = input.roundWind === 1 && input.roundNumber === 4;
  if (!isSouth4) return { end: false };

  if (!input.dealerStays) return { end: true, reason: 'south4_end' };
  if (isDealerTop(input.scores, input.dealer)) {
    return { end: true, reason: 'agari_yame' };
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
