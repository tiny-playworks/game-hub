import { type FuritenState, getBaseTile } from '@/lib/mahjongRiichi';

export function createInitialFuritenState(): FuritenState {
  return { sutehai: false, doujun: false, riichi: false };
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
