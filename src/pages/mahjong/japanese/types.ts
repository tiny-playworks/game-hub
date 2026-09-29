import type { AbortiveDrawReason } from '@/lib/riichiAbortiveDraw';
import type { FuritenState } from '@/lib/riichiFuriten';
import type { MatchEndReason } from '@/lib/riichiGameEnd';
import type {
  PaymentDetail,
  SettlementResult,
  TsumoPayments,
} from '@/lib/riichiSettlement';

export type { AbortiveDrawReason, MatchEndReason, PaymentDetail };

export type RyuukyokuReason = 'exhaustive' | AbortiveDrawReason;

/** 副露：吃/碰/明杠/加杠；暗杠不算副露，保留门前清 */
export interface RiichiMeld {
  type: 'chi' | 'peng' | 'mingang' | 'angang' | 'kakan';
  tiles: number[];
  /** 被鸣牌的来源座位（暗杠无） */
  fromPlayer?: number;
  /** 鸣入的那张牌 */
  calledTile?: number;
}

export type RiichiLogParamValue = string | number | number[];

/**
 * 可本地化的日志条目。约定：seat/from 为座位号，tile 为牌 id，tiles 为牌 id 数组，
 * 以 Key 结尾的参数为 i18n key，其余参数原样代入。
 */
export interface RiichiLogEntry {
  key: string;
  params?: Record<string, RiichiLogParamValue>;
}

export interface KakanOption {
  meldIndex: number;
  tile: number;
}

/** 当前行牌者在打牌阶段的全部合法操作（摸牌或鸣牌后计算一次并缓存） */
export interface SeatTurnOptions {
  seat: number;
  tsumo: boolean;
  /** 打出后可宣告立直的牌 id */
  riichiDiscards: number[];
  ankan: number[][];
  kakan: KakanOption[];
  kyuushu: boolean;
  /** 允许打出的牌 id（食替禁止 / 立直后仅可摸切） */
  discardable: number[];
}

export interface SeatClaimOptions {
  ron: boolean;
  chi: [number, number][];
  pon: boolean;
  minkan: boolean;
}

export type ClaimResponse =
  | { type: 'pass' }
  | { type: 'ron' }
  | { type: 'chi'; tiles: [number, number] }
  | { type: 'pon' }
  | { type: 'minkan' };

export type ClaimKind = 'discard' | 'kakan' | 'ankan';

/** 鸣牌窗口：所有可响应的座位同时决策，全部响应后按 荣和 > 碰/杠 > 吃 结算 */
export interface ClaimWindow {
  tile: number;
  from: number;
  kind: ClaimKind;
  /** 按座位索引；null 表示该座位无可选操作 */
  options: (SeatClaimOptions | null)[];
  responses: (ClaimResponse | null)[];
}

export interface RiichiYaku {
  id: string;
  name: string;
  han: number;
}

export interface RiichiWinResult {
  winner: number;
  isTsumo: boolean;
  ronFrom: number | null;
  winningTile: number;
  yaku: RiichiYaku[];
  fu: number;
  han: number;
  yakuman: number;
  ten: number;
  tsumoPayments: TsumoPayments | null;
  uraHan: number;
  uraDoraIndicators: number[];
  hand: number[];
  melds: RiichiMeld[];
  paoSeat: number | null;
}

export type RoundResult =
  | { type: 'win'; wins: RiichiWinResult[]; settlement: SettlementResult }
  | {
      type: 'draw';
      reason: RyuukyokuReason;
      tenpaiSeats: number[];
      nagashiSeats: number[];
      settlement: SettlementResult;
    };

export interface LastSettlementSummary {
  payments: PaymentDetail[];
  deltas: number[];
  newScores: number[];
  tenpaiSeats?: number[];
}

export interface RiichiGameState {
  /** 本场对局中的第几局（从 0 开始），用于派生牌山种子与幂等进度 key */
  roundId: number;
  hands: number[][];
  /** 活牌山（可正常摸的牌） */
  wall: number[];
  /** 王牌中的岭上牌（最多 4 张） */
  rinshanTiles: number[];
  /** 开杠时从活牌山末端移入死壁的补充牌 */
  deadWallSupplements: number[];
  /** 王牌中的 5 张宝牌表示牌位 / 5 张里宝牌表示牌位 */
  doraPool: number[];
  uraPool: number[];
  /** 已翻开的宝牌表示牌（开局 1 张，每开杠追加 1 张） */
  doraIndicators: number[];
  /** 与已翻开宝牌同数量的里宝牌表示牌（仅立直和了时使用） */
  uraDoraIndicators: number[];
  discardPiles: number[][];
  /** 立直宣言牌在牌河中的下标（用于横置显示） */
  riichiDiscardIndex: (number | null)[];
  /** 该座位是否有舍牌被他家鸣走（流局满贯判定） */
  discardCalled: boolean[];
  /** 该座位立直后，全场打出且其未荣和的牌（对该家安全） */
  riichiSafeTiles: number[][];
  melds: RiichiMeld[][];
  currentPlayer: number;
  drawnTile: number | null;
  /** 当前 drawnTile 是否来自杠后的岭上补牌 */
  lastDrawWasRinshan: boolean;
  phase: 'discard' | 'claim' | 'end';
  claim: ClaimWindow | null;
  /** 最近一张舍牌（高亮与鸣牌展示用） */
  lastDiscard: number | null;
  lastDiscardFrom: number | null;
  turnOptions: SeatTurnOptions | null;
  lastAction: RiichiLogEntry | null;
  roundWind: number;
  roundNumber: number;
  honba: number;
  dealer: number;
  scores: number[];
  timeBanks: number[];
  riichiPot: number;
  riichiDeclared: boolean[];
  doubleRiichi: boolean[];
  /** 立直后一巡内且无人鸣牌则为 true，用于一发 */
  ippatsuPossible: boolean[];
  /** 立直宣言牌尚在鸣牌窗口中的座位；通过后才支付 1000 点立直棒 */
  riichiPending: number | null;
  furitenStates: FuritenState[];
  /** 该座位尚未打出第一张牌且全场无人鸣牌（两立直/天地和/九种九牌） */
  firstTurn: boolean[];
  /** 鸣牌后本巡禁止打出的基础牌型（食替） */
  kuikaeForbidden: number[];
  /** 第 4 个杠成立（多人开杠）后，下一张舍牌无人荣和即四开杠流局 */
  suukaikanPending: boolean;
  /** 大三元 / 大四喜的包牌责任者 */
  paoSeat: (number | null)[];
  timeoutEvents: RiichiLogEntry[];
  matchLength: 'east' | 'south';
  result: RoundResult | null;
  lastSettlement?: LastSettlementSummary;
}

export interface RiichiMatchEnd {
  reason: MatchEndReason;
  finalScores: number[];
  ranking: number[];
}
