import type {
  RiichiMeld,
  RoundResult,
  SeatClaimOptions,
  SeatTurnOptions,
} from '../../src/pages/mahjong/japanese/types';

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export type SeatType = 'human' | 'ai' | 'empty';

export interface HumanSeat {
  type: 'human';
  seatIndex: number; // 0..3 (东、南、西、北 绝对座次)
  memberId: string;
  nickname: string;
  avatarPresetId: string;
  deviceId: string;
  leaseDeviceId: string; // 当前持有控制权的设备 ID
  isReady: boolean;
  connected: boolean;
  disconnectedAt: number | null; // 最近离线时间戳
  isAutoplay: boolean; // 是否处于 AI 临时接手托管状态
}

export interface AiSeat {
  type: 'ai';
  seatIndex: number;
  characterId: string;
  aiLevel: 'beginner' | 'standard' | 'expert' | 'strong';
}

export interface EmptySeat {
  type: 'empty';
  seatIndex: number;
}

export type RoomSeat = HumanSeat | AiSeat | EmptySeat;

export interface RoomSettings {
  matchLength: 'east' | 'south';
  defaultAiLevel: 'beginner' | 'standard' | 'expert' | 'strong';
  turnTimeLimitSeconds: number; // 每步操作默认限时秒数
  cupTotalMatches?: 2 | 3 | null; // P20 家庭雀庄杯总场次（2 或 3 场，null/undefined 为单场）
}

export interface FamilyCupParticipant {
  seatIndex: number;
  memberId: string;
  nickname: string;
  avatarPresetId: string;
}

export interface FamilyCupMatchRecord {
  matchIndex: number; // 1..totalMatches
  matchId: string;
  finalScores: [number, number, number, number];
  /** Human memberId -> cup points earned in this match */
  awardedPoints: Record<string, number>;
  completedAt: number;
}

export interface FamilyCupStanding {
  memberId: string;
  nickname: string;
  avatarPresetId: string;
  seatIndex: number;
  rank: number; // 1-based rank (tied when both cupPoints and totalMatchScore match)
  totalCupPoints: number;
  totalMatchScore: number;
  matchesPlayed: number;
}

export interface FamilyCupSummary {
  cupId: string;
  roomId: string;
  version: 1;
  matchLength: 'east' | 'south';
  totalMatches: 2 | 3;
  completedMatches: number;
  status: 'waiting' | 'playing' | 'between_matches' | 'completed';
  participants: FamilyCupParticipant[];
  matches: FamilyCupMatchRecord[];
  standings: FamilyCupStanding[];
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

/**
 * P20 20.1: Rank only human participants by final match score.
 * For N humans, placement points from 1st to Nth are N-1 down to 0.
 * Tied human scores share the average points of their tied positions.
 * AI seats never participate in cup points.
 */
export function computeCupMatchPoints(
  participants: readonly FamilyCupParticipant[],
  finalScores: readonly number[],
): Record<string, number> {
  const n = participants.length;
  if (n < 2) return {};
  const entries = participants
    .map((p) => ({
      memberId: p.memberId,
      seatIndex: p.seatIndex,
      score: finalScores[p.seatIndex] ?? 25000,
    }))
    .sort((a, b) => b.score - a.score || a.seatIndex - b.seatIndex);

  const awarded: Record<string, number> = {};
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && entries[j].score === entries[i].score) {
      j++;
    }
    let sumPoints = 0;
    for (let k = i; k < j; k++) {
      sumPoints += n - 1 - k;
    }
    const shared = Math.round((sumPoints / (j - i)) * 100) / 100;
    for (let k = i; k < j; k++) {
      awarded[entries[k].memberId] = shared;
    }
    i = j;
  }
  return awarded;
}

/**
 * P20 20.1: Sort by totalCupPoints desc, then totalMatchScore desc.
 * If both are equal, assign the same shared rank (never break ties by seat or random).
 */
export function computeCupStandings(
  participants: readonly FamilyCupParticipant[],
  matches: readonly FamilyCupMatchRecord[],
): FamilyCupStanding[] {
  const raw = participants.map((p) => {
    let totalCupPoints = 0;
    let totalMatchScore = 0;
    for (const m of matches) {
      totalCupPoints += m.awardedPoints[p.memberId] ?? 0;
      totalMatchScore += m.finalScores[p.seatIndex] ?? 0;
    }
    return {
      memberId: p.memberId,
      nickname: p.nickname,
      avatarPresetId: p.avatarPresetId,
      seatIndex: p.seatIndex,
      rank: 1,
      totalCupPoints: Math.round(totalCupPoints * 100) / 100,
      totalMatchScore,
      matchesPlayed: matches.length,
    };
  });

  raw.sort(
    (a, b) =>
      b.totalCupPoints - a.totalCupPoints ||
      b.totalMatchScore - a.totalMatchScore ||
      a.seatIndex - b.seatIndex,
  );

  for (let idx = 0; idx < raw.length; idx++) {
    if (
      idx > 0 &&
      raw[idx].totalCupPoints === raw[idx - 1].totalCupPoints &&
      raw[idx].totalMatchScore === raw[idx - 1].totalMatchScore
    ) {
      raw[idx].rank = raw[idx - 1].rank;
    } else {
      raw[idx].rank = idx + 1;
    }
  }
  return raw;
}

export interface RoomSummary {
  id: string;
  hostMemberId: string;
  hostNickname: string;
  status: RoomStatus;
  settings: RoomSettings;
  playerCount: number;
  humanCount: number;
  seats: [RoomSeat, RoomSeat, RoomSeat, RoomSeat];
  createdAt: number;
  updatedAt: number;
  revision: number;
  currentMatchId?: string;
  isPaused?: boolean; // 全真人离线时自动暂停
  cup?: FamilyCupSummary | null;
}

export interface RoomCommand {
  protocol: 1;
  commandId: string;
  roomId: string;
  matchId?: string;
  expectedRevision: number;
  type: RoomCommandType;
  payload?: unknown;
}

export type RoomCommandType =
  | 'join_seat'
  | 'leave_seat'
  | 'fill_ai'
  | 'remove_ai'
  | 'set_ready'
  | 'update_settings'
  | 'start_game'
  | 'discard'
  | 'claim'
  | 'riichi'
  | 'tsumo'
  | 'ron'
  | 'pass'
  | 'next_round'
  | 'takeover_control'
  | 'toggle_autoplay'
  | 'resume_game';

export interface PlayerSeatPrivateState {
  seatIndex: number;
  identity: {
    type: 'human' | 'ai';
    name: string;
    avatarPresetId?: string;
    characterId?: string;
  };
  hand: number[]; // 仅本人暗手牌；他人隐藏为 []
  tileCount: number; // 所有席位均可见手牌张数
  melds: RiichiMeld[]; // 公开副露
  discards: number[]; // 牌河
  score: number; // 当前点数
  isRiichi: boolean; // 是否立直
  isDealer: boolean; // 是否当前局庄家
  connected: boolean; // 是否在线
  isAutoplay: boolean; // 是否托管中
  hasControlLease: boolean; // 当前 viewer 是否持有该席位的控制权
  turnOptions: SeatTurnOptions | null; // 仅本人且持有控制权合法操作；他人为 null
  claimOptions: SeatClaimOptions | null; // 仅本人且持有控制权待鸣牌操作；他人为 null
}

export interface PlayerViewSnapshot {
  roomId: string;
  matchId: string;
  viewerSeat: number; // 0..3 本人绝对座次
  isSpectator?: boolean; // 观战时所有暗手牌与操作选项均隐藏
  revision: number;
  status: 'playing' | 'roundEnd' | 'matchEnd';
  isPaused?: boolean;
  round: {
    roundWind: number; // 0: 东, 1: 南
    roundNumber: number;
    honba: number;
    riichiPot: number;
    doraIndicators: number[];
    wallRemaining: number;
    currentPlayer: number;
    phase: string;
    claimTile?: {
      tile: number;
      from: number;
    } | null;
  };
  seats: [
    PlayerSeatPrivateState,
    PlayerSeatPrivateState,
    PlayerSeatPrivateState,
    PlayerSeatPrivateState,
  ];
  serverDeadline: number | null; // 服务器倒计时截止时间戳
  result?: RoundResult | null;
  matchEnd?: {
    ranking: number[];
    finalScores: number[];
  } | null;
}

export type ServerMessage =
  | { type: 'room_update'; room: RoomSummary }
  | { type: 'match_update'; view: PlayerViewSnapshot }
  | {
      type: 'ack';
      commandId: string;
      accepted: boolean;
      code?: string;
      revision: number;
    }
  | { type: 'lease_lost'; roomId: string; memberId: string; newDeviceId: string }
  | { type: 'error'; code: string; messageKey: string };

