import type { MemberSnapshot } from './member';
import type { RiichiReplayFile } from '../../src/pages/mahjong/japanese/engine/match';

export type OfflineMatchSource = 'free' | 'arcade';

export interface RiichiOfflinePayload {
  replay: RiichiReplayFile;
  playerCharacterId: string;
  processedProgress?: string[];
  /** Missing on receipts queued before P16; only newly started matches count. */
  themeChallengeEligible?: boolean;
}

export interface ArcadeOfflinePayload {
  gameId: string;
  difficulty: 'easy' | 'normal' | 'hard';
  score: number;
  outcome: 'win' | 'lose' | 'draw';
  meta?: Record<string, unknown>;
}

export type OfflineReceiptPayload =
  | { source: 'free'; riichi: RiichiOfflinePayload }
  | { source: 'arcade'; arcade: ArcadeOfflinePayload };

export interface OfflineReceipt {
  schema: 1;
  eventId: string;
  memberId: string;
  deviceId: string;
  matchId: string;
  matchSource: OfflineMatchSource;
  occurredAt: string;
  payload: OfflineReceiptPayload;
}

export interface OfflineReceiptResult {
  eventId: string;
  matchId: string;
  source: OfflineMatchSource;
  coinsEarned: number;
  pointsEarned: number;
  affinityEarned?: { characterId: string; amount: number };
  record?: {
    isNewBest: boolean;
    previousBest: number | null;
    currentBest: number | null;
  };
}

export interface SyncRejectedItem {
  eventId: string;
  code: string;
  messageKey: string;
}

export interface SyncBatchRequest {
  baseRevision: number;
  receipts: OfflineReceipt[];
}

export interface SyncBatchResponse {
  accepted: OfflineReceiptResult[];
  duplicates: string[];
  rejected: SyncRejectedItem[];
  snapshot: MemberSnapshot;
}

export interface ResumeSaveRecord {
  schema: 1;
  memberId: string;
  deviceId: string;
  saveId: string;
  source: 'free';
  updatedAt: string;
  replay: RiichiReplayFile;
  processedProgress: string[];
  playerCharacterId?: string;
  themeChallengeEligible?: boolean;
  roundSummary?: {
    round: number;
    roundName: string;
    scores: number[];
  };
}

export interface ResumeSaveSummary {
  saveId: string;
  deviceId: string;
  updatedAt: string;
  source: 'free';
  matchLength: 'east' | 'south';
  roundSummary?: {
    round: number;
    roundName: string;
    scores: number[];
  };
}
