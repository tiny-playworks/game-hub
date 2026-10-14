import type { RiichiReplayFile } from '../../src/pages/mahjong/japanese/engine/match';
import type { RiichiMeld } from '../../src/pages/mahjong/japanese/types';

export type RiichiMatchLength = 'east' | 'south';
export type ReplaySource = 'free' | 'ai-ranked' | 'family';

export interface ReplayArchiveSummary {
  matchId: string;
  source: ReplaySource;
  roomId?: string;
  viewerSeat: number; // 0..3
  playerCharacterId: string;
  ranking: number; // 1..4
  finalScore: number;
  matchLength: RiichiMatchLength;
  isFavorite: boolean;
  createdAt: number;
  roundsCount?: number;
}

export interface ReplayArchiveDetail {
  summary: ReplayArchiveSummary;
  file: RiichiReplayFile;
}

export interface ReplayListQuery {
  source?: 'all' | ReplaySource;
  ranking?: 'all' | 1 | 2 | 3 | 4;
  favoriteOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface ReplayListResponse {
  total: number;
  favoritesCount: number;
  items: ReplayArchiveSummary[];
}

export type TrainingCategory = 'shanten' | 'ukeire' | 'dealIn' | 'riichi' | 'dama';

export interface TrainingProblem {
  id: string;
  matchId: string;
  frameIndex: number;
  category: TrainingCategory;
  viewerSeat: number;
  wind: number;
  roundNumber: number;
  honba: number;
  turn: number;
  hand: number[];
  melds: RiichiMeld[];
  playedTile: number;
  recommendedTile: number;
  playerRiichi: boolean;
  recommendedRiichi: boolean;
  reasonTextKey: string;
  explanation: {
    shantenDiff: number;
    ukeireDiff: number;
    dangerLoss: number;
    safer: boolean;
  };
}

export interface TrainingWeaknessSummary {
  totalMatchesAnalyzed: number;
  hasEnoughSamples: boolean; // >= 5 场对局
  countsByCategory: Record<TrainingCategory, number>;
  trend: 'improving' | 'stable' | 'needsAttention';
}
