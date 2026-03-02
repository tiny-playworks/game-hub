import type { AbortiveDrawReason } from '@/lib/riichiAbortiveDraw';
import type { MatchEndReason } from '@/lib/riichiGameEnd';
import type { PaymentDetail } from '@/lib/riichiSettlement';

export type { AbortiveDrawReason, MatchEndReason, PaymentDetail };

/** 副露：吃/碰/明杠/加杠；暗杠不算副露，保留门前清 */
export interface RiichiMeld {
  type: 'chi' | 'peng' | 'mingang' | 'angang' | 'kakan';
  tiles: number[];
  fromPlayer?: number;
}

export interface RiichiGameState {
  hands: number[][];
  wall: number[];
  discardPiles: number[][];
  melds: RiichiMeld[][];
  currentPlayer: number;
  drawnTile: number | null;
  /** 明宝牌表示牌（开局 1 张，每开杠追加 1 张） */
  doraIndicators: number[];
  phase: 'discard' | 'claim';
  lastDiscard: number | null;
  lastDiscardFrom: number | null;
  claimIndex: number;
  lastClaimMsg: string | null;
  /** 当前要牌是否因加杠（仅允许抢杠） */
  lastClaimWasKakan?: boolean;
  roundWind: number;
  roundNumber: number;
  honba: number;
  dealer: number;
  scores: number[];
  timeBanks: number[];
  riichiPot: number;
  riichiDeclared: boolean[];
  /** 立直后一巡内尚未摸牌且本巡无人吃碰杠则为 true，用于一发 */
  ippatsuPossible: boolean[];
  furitenStates: { sutehai: boolean; doujun: boolean; riichi: boolean }[];
  riichiDiscard: (number | null)[];
  uraDoraIndicators: number[];
  ryuukyoku?: boolean;
  ryuukyokuReason?: '荒牌' | AbortiveDrawReason;
  lastSettlement?: {
    payments: PaymentDetail[];
    deltas: number[];
    newScores: number[];
    tenpaiSeats?: number[];
    timeoutEvents?: string[];
  };
  timeoutEvents: string[];
  matchLength: 'east' | 'south';
}
