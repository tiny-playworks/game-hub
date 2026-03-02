import type { RefObject } from 'react';
import type { RiichiMatchEnd, RiichiWinResult } from '../store/riichiGameStore';
import type { RiichiGameState, RiichiMeld } from '../types';

/** round/history/match 用上下文，与 RiichiRuntimeContext（gameplay）并列 */
export interface RiichiRoundContext {
  history: RiichiGameState[];
  matchLength: 'east' | 'south';
  game: RiichiGameState | null;
  winResult: RiichiWinResult | null;
  setView: (view: 'rules' | 'game') => void;
  setGame: (
    updater:
      | RiichiGameState
      | null
      | ((prev: RiichiGameState | null) => RiichiGameState | null),
  ) => void;
  setHistory: (
    updater:
      | RiichiGameState[]
      | ((prev: RiichiGameState[]) => RiichiGameState[]),
  ) => void;
  setGameLog: (updater: string[] | ((prev: string[]) => string[])) => void;
  setWinResult: (
    updater:
      | RiichiWinResult
      | null
      | ((prev: RiichiWinResult | null) => RiichiWinResult | null),
  ) => void;
  setMatchEnd: (
    updater:
      | RiichiMatchEnd
      | null
      | ((prev: RiichiMatchEnd | null) => RiichiMatchEnd | null),
  ) => void;
  setDeclinedRonToken: (token: string | null) => void;
  undoingRef: RefObject<boolean>;
  addLog: (msg: string) => void;
  getWaitingTilesRiichi: (
    hand: number[],
    melds: RiichiMeld[],
    gameState?: RiichiGameState | null,
    options?: { seat?: number; isTsumo?: boolean; treatAsRiichi?: boolean },
  ) => number[];
}
