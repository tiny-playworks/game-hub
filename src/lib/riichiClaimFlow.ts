export type ClaimPassResolution =
  | { type: 'next'; nextClaimIndex: number }
  | { type: 'ryuukyoku' }
  | { type: 'draw' };

/** 要牌轮有人「过」后，统一推进到下一家/摸牌/流局。 */
export function resolveClaimPass(
  claimIndex: number,
  wallLength: number,
): ClaimPassResolution {
  const nextIndex = claimIndex + 1;
  if (nextIndex < 3) return { type: 'next', nextClaimIndex: nextIndex };
  if (wallLength === 0) return { type: 'ryuukyoku' };
  return { type: 'draw' };
}

/** 是否应提供荣和入口（不依赖 claim 顺位，避免错过荣和窗口）。 */
export function canOfferRon(params: {
  phase: 'discard' | 'claim';
  lastDiscard: number | null;
  lastDiscardFrom: number | null;
  currentClaimToken: string | null;
  declinedRonToken: string | null;
  isWinShape: boolean;
  hasYaku: boolean;
}): boolean {
  return (
    params.phase === 'claim' &&
    params.lastDiscard !== null &&
    params.lastDiscardFrom !== null &&
    params.lastDiscardFrom !== 0 &&
    params.currentClaimToken !== params.declinedRonToken &&
    params.isWinShape &&
    params.hasYaku
  );
}
