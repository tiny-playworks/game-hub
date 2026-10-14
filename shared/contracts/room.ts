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
  isReady: boolean;
  connected: boolean;
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
  | 'next_round';

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
  turnOptions: SeatTurnOptions | null; // 仅本人合法操作；他人为 null
  claimOptions: SeatClaimOptions | null; // 仅本人待鸣牌操作；他人为 null
}

export interface PlayerViewSnapshot {
  roomId: string;
  matchId: string;
  viewerSeat: number; // 0..3 本人绝对座次
  revision: number;
  status: 'playing' | 'roundEnd' | 'matchEnd';
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
  | { type: 'error'; code: string; messageKey: string };
