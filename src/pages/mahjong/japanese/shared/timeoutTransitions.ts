import type { RiichiGameState } from '../types';
import { stripLastSettlementWhenRoundVisible } from './lastSettlementStrip';

/**
 * 纯函数：某家超时自动出牌后的下一状态（不含流局检查）。
 * timeoutEvent 会追加到 state.timeoutEvents 并保留最近 20 条。
 * lastClaimMsg 由调用方传入（如 `${SEAT_NAMES[player]} 超时自动出牌`）。
 */
export function buildStateAfterTimeoutDiscard(
  g: RiichiGameState,
  player: number,
  nextBanks: number[],
  tileToDiscard: number,
  timeoutEvent: string,
  lastClaimMsg: string,
): RiichiGameState {
  const hand = [...g.hands[player]];
  const idx = hand.indexOf(tileToDiscard);
  if (idx < 0) return g;
  hand.splice(idx, 1);
  const piles = g.discardPiles.map((q) => [...q]);
  piles[player].push(tileToDiscard);
  const nextPlayer = (player + 1) % 4;
  const next: RiichiGameState = {
    ...g,
    timeoutEvents: [...g.timeoutEvents, timeoutEvent].slice(-20),
    timeBanks: nextBanks,
    hands: g.hands.map((h, i) => (i === player ? hand : h)),
    discardPiles: piles,
    currentPlayer: nextPlayer,
    drawnTile: null,
    lastDrawWasRinshan: false,
    phase: 'claim',
    lastDiscard: tileToDiscard,
    lastDiscardFrom: player,
    claimIndex: 0,
    lastClaimMsg,
  };
  return stripLastSettlementWhenRoundVisible(g, next);
}

/**
 * 将一条超时事件追加到 state.timeoutEvents（保留最近 20 条）。
 * 若仅需在已有 state 上追加事件时可使用。
 */
export function appendTimeoutEvent(
  state: RiichiGameState,
  event: string,
): RiichiGameState {
  return {
    ...state,
    timeoutEvents: [...state.timeoutEvents, event].slice(-20),
  };
}
