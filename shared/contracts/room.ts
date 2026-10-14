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

