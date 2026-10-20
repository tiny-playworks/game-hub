import type { GomokuStone } from '../../src/lib/gomoku';
import type { Board } from '../../src/lib/xiangqi';
import type { Card, Hand } from '../../src/lib/doudizhu';

export const FAMILY_GAME_IDS = ['gomoku', 'xiangqi', 'doudizhu'] as const;
export type FamilyGameId = (typeof FAMILY_GAME_IDS)[number];
export type FamilyGameDifficulty = 'easy' | 'normal' | 'hard';
export type GameRoomStatus = 'waiting' | 'playing' | 'paused' | 'finished';
export type FamilyArcadeSource = 'family-arcade';
export type GameOutcome = 'win' | 'lose' | 'draw';

export interface GameRoomSettings {
  difficulty: FamilyGameDifficulty;
  firstPlayer: 'random' | 'host' | 'opponent';
  clock: { totalSeconds: number; incrementSeconds: number } | null;
  undoLimit: 0 | 1 | 3;
  turnSeconds: 10 | 15 | 30;
}

export type GameRoomSeat =
  | { type: 'empty'; seatIndex: number }
  | { type: 'ai'; seatIndex: number; difficulty: FamilyGameDifficulty }
  | {
      type: 'human'; seatIndex: number; memberId: string; nickname: string;
      avatarPresetId: string; ready: boolean; connected: boolean;
      autoplay: boolean; exited: boolean;
    };

export interface GameRoomResult {
  source: FamilyArcadeSource;
  matchId: string;
  reason: 'board' | 'resign' | 'draw' | 'timeout' | 'abandoned' | 'expired';
  outcomes: GameOutcome[] | null;
  coinsByMember: Record<string, number>;
  counted: boolean;
  spring?: boolean;
  multiplier?: number;
}

export interface GameRoomSummary {
  schema: 1;
  id: string;
  gameId: FamilyGameId;
  hostMemberId: string;
  hostNickname: string;
  status: GameRoomStatus;
  revision: number;
  settings: GameRoomSettings;
  seats: GameRoomSeat[];
  spectators: { memberId: string; nickname: string }[];
  matchId: string | null;
  firstSeat: number;
  roundNumber: number;
  pausedAt: number | null;
  createdAt: number;
  updatedAt: number;
  result: GameRoomResult | null;
}

export interface GomokuRoomBoard {
  gameId: 'gomoku';
  board: GomokuStone[];
  currentSeat: number;
  lastMove: number | null;
  winningLine: number[];
  ply: number;
}

export interface XiangqiRoomBoard {
  gameId: 'xiangqi';
  board: Board;
  currentSeat: number;
  lastMove: { from: [number, number]; to: [number, number] } | null;
  ply: number;
  inCheck: boolean;
}

export interface DoudizhuRoomBoard {
  gameId: 'doudizhu';
  phase: 'bidding' | 'playing' | 'finished';
  currentSeat: number;
  landlord: number | null;
  hand: Card[];
  handCounts: number[];
  bottomCards: Card[];
  bids: { seat: number; score: number }[];
  highestBid: number;
  lastPlay: { player: number; hand: Hand } | null;
  playedCards: Card[];
  canPass: boolean;
  spring: boolean;
  multiplier: number;
  dealNumber: number;
  ply: number;
}

export type GameBoardView = GomokuRoomBoard | XiangqiRoomBoard | DoudizhuRoomBoard;
export interface GameRoomView {
  room: GameRoomSummary;
  viewerSeat: number | null;
  isSpectator: boolean;
  hasControl: boolean;
  board: GameBoardView | null;
  deadline: number | null;
  clockRemaining: number[] | null;
  serverNow: number;
  offer: { kind: 'draw' | 'undo'; seat: number } | null;
  undoUsed: number[];
}

export type GameAction =
  | { type: 'place'; index: number }
  | { type: 'move'; from: [number, number]; to: [number, number] }
  | { type: 'bid'; score: number }
  | { type: 'play'; cards: Card[] }
  | { type: 'pass' };

export interface GameRoomCommand {
  protocol: 1;
  commandId: string;
  roomId: string;
  expectedRevision: number;
  type: 'join' | 'leave' | 'ready' | 'ai' | 'settings' | 'start' | 'rematch'
    | 'takeover' | 'action' | 'resign' | 'end' | 'offer' | 'respond';
  payload?: {
    seatIndex?: number;
    ready?: boolean;
    remove?: boolean;
    settings?: Partial<GameRoomSettings>;
    action?: GameAction;
    kind?: 'draw' | 'undo';
    accept?: boolean;
  };
}

export interface GameRoomAck {
  accepted: boolean;
  commandId: string;
  revision: number;
  code?: string;
  view: GameRoomView | null;
}

export type GameRoomServerMessage =
  | { type: 'game_room'; view: GameRoomView }
  | { type: 'game_ack'; ack: GameRoomAck }
  | { type: 'game_error'; code: string };

export interface FamilyHeadToHead {
  gameId: FamilyGameId;
  memberId: string;
  nickname: string;
  opponentId: string;
  opponentNickname: string;
  relation: 'duel' | 'team' | 'opponent';
  wins: number;
  losses: number;
  draws: number;
}
