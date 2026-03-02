import type { AbortiveDrawReason } from '@/lib/riichiAbortiveDraw';
import type { MatchEndReason } from '@/lib/riichiGameEnd';
import type { PaymentDetail } from '@/lib/riichiSettlement';

export type { AbortiveDrawReason, MatchEndReason, PaymentDetail };

/** 副露：吃/碰/明杠；暗杠不算副露，保留门前清 */
export interface RiichiMeld {
  type: 'chi' | 'peng' | 'mingang' | 'angang';
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
  doraIndicator: number;
  phase: 'discard' | 'claim';
  lastDiscard: number | null;
  lastDiscardFrom: number | null;
  claimIndex: number;
  lastClaimMsg: string | null;
  roundWind: number;
  roundNumber: number;
  honba: number;
  dealer: number;
  scores: number[];
  timeBanks: number[];
  riichiPot: number;
  riichiDeclared: boolean[];
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
