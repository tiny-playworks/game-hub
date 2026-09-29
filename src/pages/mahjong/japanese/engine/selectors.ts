import type {
  RiichiGameState,
  SeatClaimOptions,
  SeatTurnOptions,
} from '../types';

/** 当前需要表态的座位（打牌阶段为行牌者；鸣牌窗口为尚未响应且有选项者） */
export function getPendingSeats(state: RiichiGameState): number[] {
  if (state.phase === 'discard') return [state.currentPlayer];
  if (state.phase === 'claim' && state.claim) {
    const claim = state.claim;
    return [0, 1, 2, 3].filter(
      (seat) => claim.options[seat] !== null && claim.responses[seat] === null,
    );
  }
  return [];
}

export function getSeatTurnOptions(
  state: RiichiGameState,
  seat: number,
): SeatTurnOptions | null {
  if (state.phase !== 'discard' || state.currentPlayer !== seat) return null;
  return state.turnOptions?.seat === seat ? state.turnOptions : null;
}

export function getSeatClaimOptions(
  state: RiichiGameState,
  seat: number,
): SeatClaimOptions | null {
  const claim = state.claim;
  if (state.phase !== 'claim' || !claim) return null;
  if (claim.responses[seat] !== null) return null;
  return claim.options[seat];
}

/** 计时显示用：优先显示自家的待决策，其次为第一个待决策 AI */
export function getDecisionSeat(state: RiichiGameState): number | null {
  const pending = getPendingSeats(state);
  if (pending.length === 0) return null;
  return pending.includes(0) ? 0 : pending[0];
}

export function getSeatWind(
  _roundWind: number,
  seat: number,
  dealer: number,
): number {
  return (seat - dealer + 4) % 4;
}

/** 已翻开宝牌与尚存牌数等场况统计（136 张守恒检查亦用） */
export function countAllTiles(state: RiichiGameState): number {
  const inHands = state.hands.reduce((s, h) => s + h.length, 0);
  const inRivers = state.discardPiles.reduce((s, p) => s + p.length, 0);
  const inMelds = state.melds.reduce(
    (s, ms) => s + ms.reduce((t, m) => t + m.tiles.length, 0),
    0,
  );
  const deadWall =
    state.rinshanTiles.length +
    state.doraPool.length +
    state.uraPool.length +
    state.deadWallSupplements.length;
  return inHands + inRivers + inMelds + state.wall.length + deadWall;
}
