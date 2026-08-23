import type { RefObject } from 'react';
import type { RiichiWinResult } from '../store/riichiGameStore';
import type { RiichiGameState, RiichiMeld } from '../types';

/** ClaimFlow 的 extra 参数（人类/超时由 hook 处理，AI 由 claimFlowAi 处理） */
export type ClaimFlowExtra = {
  claimPlayer: number | null;
  hasAnyClaimOption: boolean;
  canRon: boolean;
  isSeatFuriten: (seat: number, state: RiichiGameState) => boolean;
  flowDeps?: import('./flowDeps').RiichiFlowDeps | null;
};

/** setGame 的 updater 类型 */
export type SetGameUpdater = (
  updater:
    | RiichiGameState
    | null
    | ((prev: RiichiGameState | null) => RiichiGameState | null),
) => void;

/** setWinResult 的 updater 类型 */
export type SetWinResultUpdater = (
  updater:
    | RiichiWinResult
    | null
    | ((prev: RiichiWinResult | null) => RiichiWinResult | null),
) => void;

export type TurnClockRef = RefObject<{
  player: number;
  startedAt: number;
} | null>;

export type AddLogRef = RefObject<(msg: string) => void>;

export type GetWaitingTilesRiichi = (
  hand: number[],
  melds: RiichiMeld[],
  gameState?: RiichiGameState | null,
  options?: { seat?: number; isTsumo?: boolean; treatAsRiichi?: boolean },
) => number[];

/** 日麻音效（与 useRiichiSounds 返回值一致） */
export type RiichiSounds = ReturnType<
  typeof import('@/hooks/useRiichiSounds').useRiichiSounds
>;

/**
 * 统一运行时上下文，收敛 actions/flows 的重复参数。
 * 由 useRiichiGame 构建并传入各 hook，后续新增字段只需改此处与 useRiichiGame。
 */
export interface RiichiRuntimeContext {
  game: RiichiGameState | null;
  /** 和牌/流局结算弹窗展示中：为 true 时 flows 不得再推进局面 */
  winResult: RiichiWinResult | null;
  setGame: SetGameUpdater;
  addLog: (msg: string) => void;
  addLogRef: AddLogRef;
  turnClockRef: TurnClockRef;
  sounds: RiichiSounds;
  setWinResult: SetWinResultUpdater;
  consumeSeatTimeBank: (state: RiichiGameState, seat: number) => number[];
  getElapsedSecondsForSeat: (seat: number) => number;
  getWaitingTilesRiichi: GetWaitingTilesRiichi;
  clockNowMs: number;
  setClockNowMs: (value: number) => void;
  setDeclinedRonToken: (token: string | null) => void;
  markSeatRonDeclined: (seat: number) => void;
}
