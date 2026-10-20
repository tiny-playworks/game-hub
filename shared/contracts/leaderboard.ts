export type LeaderboardScope = 'all-time' | 'week';

export interface LeaderboardEntry {
  rank: number;
  memberId: string;
  nickname: string;
  avatar?: string;
  value: number;
  /** Epoch ms when the member reached this value; 0 for pre-leaderboard history. */
  achievedAt: number;
}

export interface LeaderboardResponse {
  gameId: string;
  difficulty: string;
  scope: LeaderboardScope;
  /** `max` / `min` / `wins`, same as `games.ts` bestMetric. */
  metric: 'max' | 'min' | 'wins';
  /** Monday (Asia/Shanghai) of the week when scope is `week`. */
  weekId: string | null;
  entries: LeaderboardEntry[];
}

export interface LeaderboardStanding {
  allTimeRank: number | null;
  weekRank: number | null;
  /** Value of the member directly above on the all-time board, if any. */
  allTimeGapToPrevious: number | null;
  weekGapToPrevious: number | null;
  isFamilyRecord: boolean;
}

export type FamilyFeedKind = 'family-record' | 'weekly-champion' | 'family-cup' | 'family-arcade';

export interface FamilyFeedItem {
  id: number;
  kind: FamilyFeedKind;
  memberId: string | null;
  nickname: string | null;
  gameId: string | null;
  difficulty: string | null;
  value: number | null;
  weekId: string | null;
  cupId: string | null;
  createdAt: number;
}

export interface WeeklyChampionBadge {
  weekId: string;
  gameId: string;
  difficulty: string;
  value: number;
  awardedAt: number;
}
