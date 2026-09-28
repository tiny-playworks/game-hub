import { getBaseTile } from '@/lib/mahjongRiichi';

/**
 * 振听状态中需要记忆的部分；舍张振听由自家牌河与当前待牌实时计算。
 * doujun：同巡振听（见逃后到自己下次摸牌前）；riichi：立直后见逃，本局永久振听。
 */
export interface FuritenState {
  doujun: boolean;
  riichi: boolean;
}

export function createInitialFuritenState(): FuritenState {
  return { doujun: false, riichi: false };
}

export function clearDoujunFuriten(state: FuritenState): FuritenState {
  return { ...state, doujun: false };
}

export function applyRonDeclinedFuriten(
  state: FuritenState,
  isRiichiDeclared: boolean,
): FuritenState {
  if (isRiichiDeclared) return { ...state, riichi: true, doujun: false };
  return { ...state, doujun: true };
}

export function isSutehaiFuriten(
  waitingTiles: number[],
  ownDiscards: number[],
): boolean {
  if (waitingTiles.length === 0 || ownDiscards.length === 0) return false;
  const waits = new Set(waitingTiles.map((t) => getBaseTile(t)));
  return ownDiscards.some((t) => waits.has(getBaseTile(t)));
}

export function isRonForbiddenByFuriten(params: {
  waitingTiles: number[];
  ownDiscards: number[];
  state: FuritenState;
}): boolean {
  return (
    params.state.riichi ||
    params.state.doujun ||
    isSutehaiFuriten(params.waitingTiles, params.ownDiscards)
  );
}

export type FuritenReason = 'riichi' | 'doujun' | 'sutehai';

export function getFuritenReason(params: {
  waitingTiles: number[];
  ownDiscards: number[];
  state: FuritenState;
}): FuritenReason | null {
  if (params.state.riichi) return 'riichi';
  if (params.state.doujun) return 'doujun';
  if (isSutehaiFuriten(params.waitingTiles, params.ownDiscards)) {
    return 'sutehai';
  }
  return null;
}
