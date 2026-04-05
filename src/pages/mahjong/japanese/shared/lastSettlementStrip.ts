import type { RiichiGameState } from '../types';

/**
 * 新巡开始后保留 `lastSettlement` 便于查看上一局结算，但会长期遮挡桌面。
 * 在「本巡已有可见进展」时清除：首次有牌下河，或暗杠后进入 claim（河仍为 0）。
 */
export function stripLastSettlementWhenRoundVisible(
  before: RiichiGameState,
  after: RiichiGameState,
): RiichiGameState {
  if (!before.lastSettlement) return after;
  const totalBefore = before.discardPiles.reduce((s, p) => s + p.length, 0);
  const totalAfter = after.discardPiles.reduce((s, p) => s + p.length, 0);
  if (totalBefore === 0 && totalAfter > 0) {
    return { ...after, lastSettlement: undefined };
  }
  if (
    totalBefore === 0 &&
    totalAfter === 0 &&
    after.phase === 'claim' &&
    after.lastDiscard !== null
  ) {
    return { ...after, lastSettlement: undefined };
  }
  return after;
}
