import { RIICHI_TIME_BANK_INITIAL_SECONDS } from '@/lib/riichiClock';
import { rankSeatsByScore, resolveRiichiMatchEnd } from '@/lib/riichiGameEnd';
import { RIICHI_INITIAL_POINTS } from '@/lib/riichiSettlement';
import type {
  ClaimResponse,
  RiichiGameState,
  RiichiLogEntry,
  RiichiMatchEnd,
} from '../types';
import {
  type ActionMeta,
  createRound,
  createStepContext,
  declareAnkan,
  declareKakan,
  declareKyuushu,
  declareTsumo,
  discardTile,
  type RiichiEffect,
  respondClaim,
  type StepContext,
} from './round';
import { type RiichiRuleConfig, resolveRules } from './rules';

export const RIICHI_MATCH_VERSION = 1;
export const MAX_LOG_ENTRIES = 200;

export type RiichiEvent =
  | ({ type: 'discard'; seat: number; tile: number } & ActionMeta)
  | ({ type: 'riichi'; seat: number; tile: number } & ActionMeta)
  | ({ type: 'tsumo'; seat: number } & ActionMeta)
  | ({ type: 'ankan'; seat: number; tiles: number[] } & ActionMeta)
  | ({
      type: 'kakan';
      seat: number;
      meldIndex: number;
      tile: number;
    } & ActionMeta)
  | ({ type: 'kyuushu'; seat: number } & ActionMeta)
  | ({ type: 'claim'; seat: number; response: ClaimResponse } & ActionMeta)
  | { type: 'nextRound' };

export type RiichiMatchStatus = 'playing' | 'roundEnd' | 'matchEnd';

export interface RiichiMatchState {
  version: number;
  seed: number;
  rules: RiichiRuleConfig;
  matchLength: 'east' | 'south';
  round: RiichiGameState;
  status: RiichiMatchStatus;
  matchEnd: RiichiMatchEnd | null;
  /** 每次状态推进 +1；定时回调据此判断自己是否过期 */
  turn: number;
  events: RiichiEvent[];
  /** 当前局开局快照，用于局内回退重放 */
  roundStart: {
    eventIndex: number;
    log: RiichiLogEntry[];
    round: RiichiGameState;
  };
  log: RiichiLogEntry[];
}

export interface StepResult {
  match: RiichiMatchState;
  effects: RiichiEffect[];
}

export interface CreateMatchOptions {
  seed: number;
  matchLength: 'east' | 'south';
  rules?: Partial<RiichiRuleConfig>;
}

const INITIAL_SCORES = [
  RIICHI_INITIAL_POINTS,
  RIICHI_INITIAL_POINTS,
  RIICHI_INITIAL_POINTS,
  RIICHI_INITIAL_POINTS,
];
const INITIAL_TIME_BANKS = [
  RIICHI_TIME_BANK_INITIAL_SECONDS,
  RIICHI_TIME_BANK_INITIAL_SECONDS,
  RIICHI_TIME_BANK_INITIAL_SECONDS,
  RIICHI_TIME_BANK_INITIAL_SECONDS,
];

function appendLogs(
  log: RiichiLogEntry[],
  entries: RiichiLogEntry[],
): RiichiLogEntry[] {
  if (entries.length === 0) return log;
  return [...log, ...entries].slice(-MAX_LOG_ENTRIES);
}

function statusOf(round: RiichiGameState): RiichiMatchStatus {
  return round.phase === 'end' ? 'roundEnd' : 'playing';
}

export function createMatch(options: CreateMatchOptions): StepResult {
  const rules = resolveRules(options.rules);
  const ctx = createStepContext(rules);
  ctx.effects.push({
    type: 'progress',
    event: 'enter-game',
    key: 'enter-game',
  });
  const round = createRound(
    {
      matchSeed: options.seed,
      roundId: 0,
      dealer: 0,
      roundWind: 0,
      roundNumber: 1,
      honba: 0,
      scores: INITIAL_SCORES,
      timeBanks: INITIAL_TIME_BANKS,
      riichiPot: 0,
      matchLength: options.matchLength,
    },
    ctx,
  );
  const log = appendLogs([], ctx.logs);
  return {
    match: {
      version: RIICHI_MATCH_VERSION,
      seed: options.seed,
      rules,
      matchLength: options.matchLength,
      round,
      status: statusOf(round),
      matchEnd: null,
      turn: 0,
      events: [],
      roundStart: { eventIndex: 0, log, round },
      log,
    },
    effects: ctx.effects,
  };
}

/** 本局结束后的连庄 / 本场判定 */
export function getRoundContinuation(round: RiichiGameState): {
  dealerStays: boolean;
  dealerWon: boolean;
  honbaUp: boolean;
} {
  const result = round.result;
  if (!result) return { dealerStays: false, dealerWon: false, honbaUp: false };
  if (result.type === 'win') {
    const dealerWon = result.wins.some((w) => w.winner === round.dealer);
    return { dealerStays: dealerWon, dealerWon, honbaUp: dealerWon };
  }
  if (result.reason === 'exhaustive') {
    return {
      dealerStays: result.tenpaiSeats.includes(round.dealer),
      dealerWon: false,
      honbaUp: true,
    };
  }
  return { dealerStays: true, dealerWon: false, honbaUp: true };
}

/**
 * 一局结束后计算下一局。连庄本场 +1；流局换庄时本场同样 +1；子家和了本场清零。
 */
export function getNextRound(
  dealer: number,
  roundWind: number,
  roundNumber: number,
  honba: number,
  dealerStays: boolean,
  honbaUp = dealerStays,
): { dealer: number; roundWind: number; roundNumber: number; honba: number } {
  const nextHonba = honbaUp ? honba + 1 : 0;
  if (dealerStays) return { dealer, roundWind, roundNumber, honba: nextHonba };
  const nextDealer = (dealer + 1) % 4;
  if (nextDealer === 0) {
    return {
      dealer: 0,
      roundWind: (roundWind + 1) % 4,
      roundNumber: 1,
      honba: nextHonba,
    };
  }
  return {
    dealer: nextDealer,
    roundWind,
    roundNumber: nextDealer + 1,
    honba: nextHonba,
  };
}

function advanceRound(
  match: RiichiMatchState,
  ctx: StepContext,
): RiichiMatchState | null {
  const round = match.round;
  const result = round.result;
  if (match.status !== 'roundEnd' || !result) return null;
  const settlement = result.settlement;
  const { dealerStays, dealerWon, honbaUp } = getRoundContinuation(round);
  ctx.logs.push({
    key: 'riichi.log.scoreLine',
    params: {
      s0: settlement.newScores[0],
      s1: settlement.newScores[1],
      s2: settlement.newScores[2],
      s3: settlement.newScores[3],
    },
  });
  const end = resolveRiichiMatchEnd({
    scores: settlement.newScores,
    roundWind: round.roundWind,
    roundNumber: round.roundNumber,
    dealer: round.dealer,
    dealerStays,
    dealerWon,
    matchLength: match.matchLength,
    rules: match.rules.matchEnd,
  });
  if (end.end && end.reason) {
    ctx.logs.push({
      key: 'riichi.log.matchEnd',
      params: { reasonKey: `riichi.matchEndReason.${end.reason}` },
    });
    return {
      ...match,
      status: 'matchEnd',
      matchEnd: {
        reason: end.reason,
        finalScores: [...settlement.newScores],
        ranking: rankSeatsByScore(settlement.newScores),
      },
    };
  }
  const next = getNextRound(
    round.dealer,
    round.roundWind,
    round.roundNumber,
    round.honba,
    dealerStays,
    honbaUp,
  );
  const nextRound = createRound(
    {
      matchSeed: match.seed,
      roundId: round.roundId + 1,
      dealer: next.dealer,
      roundWind: next.roundWind,
      roundNumber: next.roundNumber,
      honba: next.honba,
      scores: settlement.newScores,
      timeBanks: round.timeBanks,
      riichiPot: settlement.nextRiichiPot,
      matchLength: match.matchLength,
      lastSettlement: {
        payments: settlement.payments,
        deltas: settlement.deltas,
        newScores: settlement.newScores,
        tenpaiSeats:
          result.type === 'draw' && result.reason === 'exhaustive'
            ? result.tenpaiSeats
            : undefined,
      },
    },
    ctx,
  );
  return { ...match, round: nextRound, status: statusOf(nextRound) };
}

function applyRoundEvent(
  round: RiichiGameState,
  event: Exclude<RiichiEvent, { type: 'nextRound' }>,
  ctx: StepContext,
): RiichiGameState | null {
  switch (event.type) {
    case 'discard':
      return discardTile(round, event.seat, event.tile, false, event, ctx);
    case 'riichi':
      return discardTile(round, event.seat, event.tile, true, event, ctx);
    case 'tsumo':
      return declareTsumo(round, event.seat, event, ctx);
    case 'ankan':
      return declareAnkan(round, event.seat, event.tiles, event, ctx);
    case 'kakan':
      return declareKakan(
        round,
        event.seat,
        event.meldIndex,
        event.tile,
        event,
        ctx,
      );
    case 'kyuushu':
      return declareKyuushu(round, event.seat, ctx);
    case 'claim':
      return respondClaim(round, event.seat, event.response, event, ctx);
  }
}

/** 纯函数状态推进；非法事件返回 null，调用方应忽略 */
export function applyEvent(
  match: RiichiMatchState,
  event: RiichiEvent,
): StepResult | null {
  const ctx = createStepContext(match.rules);
  let next: RiichiMatchState | null;
  if (event.type === 'nextRound') {
    next = advanceRound(match, ctx);
  } else {
    if (match.status !== 'playing') return null;
    const round = applyRoundEvent(match.round, event, ctx);
    next = round ? { ...match, round, status: statusOf(round) } : null;
  }
  if (!next) return null;
  const log = appendLogs(next.log, ctx.logs);
  const events = [...match.events, event];
  const startedNewRound =
    event.type === 'nextRound' && next.status !== 'matchEnd';
  return {
    match: {
      ...next,
      log,
      roundStart: startedNewRound
        ? { eventIndex: events.length, log, round: next.round }
        : next.roundStart,
      turn: match.turn + 1,
      events,
    },
    effects: ctx.effects,
  };
}

export function isHumanEvent(event: RiichiEvent): boolean {
  return event.type !== 'nextRound' && event.seat === 0;
}

/** 回退到本局中自家最后一次操作之前；局已结束或本局尚无自家操作时返回 null */
export function undoLastHumanAction(
  match: RiichiMatchState,
): RiichiMatchState | null {
  if (match.status !== 'playing') return null;
  const start = match.roundStart.eventIndex;
  let target = -1;
  for (let i = match.events.length - 1; i >= start; i--) {
    if (isHumanEvent(match.events[i])) {
      target = i;
      break;
    }
  }
  if (target < 0) return null;
  let replayed: RiichiMatchState = {
    ...match,
    round: match.roundStart.round,
    status: statusOf(match.roundStart.round),
    events: match.events.slice(0, start),
    log: match.roundStart.log,
  };
  for (let i = start; i < target; i++) {
    const step = applyEvent(replayed, match.events[i]);
    if (!step) break;
    replayed = step.match;
  }
  return {
    ...replayed,
    turn: match.turn + 1,
    log: appendLogs(replayed.log, [{ key: 'riichi.log.undo' }]),
  };
}

export interface RiichiReplayFile {
  version: number;
  seed: number;
  matchLength: 'east' | 'south';
  rules: RiichiRuleConfig;
  events: RiichiEvent[];
}

export function toReplayFile(match: RiichiMatchState): RiichiReplayFile {
  return {
    version: match.version,
    seed: match.seed,
    matchLength: match.matchLength,
    rules: match.rules,
    events: match.events,
  };
}

/** 从种子与事件序列重放整场对局，返回每一步之后的快照（下标 0 为开局） */
export function replayMatch(file: RiichiReplayFile): RiichiMatchState[] {
  let match = createMatch({
    seed: file.seed,
    matchLength: file.matchLength,
    rules: file.rules,
  }).match;
  const frames = [match];
  for (const event of file.events) {
    const step = applyEvent(match, event);
    if (!step) break;
    match = step.match;
    frames.push(match);
  }
  return frames;
}

/** 仅恢复最终局面；存档入口无需保存每一步快照。 */
export function restoreMatch(file: RiichiReplayFile): RiichiMatchState | null {
  let match = createMatch({
    seed: file.seed,
    matchLength: file.matchLength,
    rules: file.rules,
  }).match;
  for (const event of file.events) {
    const step = applyEvent(match, event);
    if (!step) return null;
    match = step.match;
  }
  return match;
}

export function isReplayFile(value: unknown): value is RiichiReplayFile {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<RiichiReplayFile>;
  const seat = (n: unknown) =>
    Number.isInteger(n) && Number(n) >= 0 && Number(n) < 4;
  const tile = (n: unknown) =>
    Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 36;
  const eventIsValid = (item: unknown): boolean => {
    if (!item || typeof item !== 'object') return false;
    const e = item as Record<string, unknown>;
    if (e.type === 'nextRound') return true;
    if (!seat(e.seat)) return false;
    switch (e.type) {
      case 'discard':
      case 'riichi':
        return tile(e.tile);
      case 'tsumo':
      case 'kyuushu':
        return true;
      case 'ankan':
        return (
          Array.isArray(e.tiles) && e.tiles.length === 4 && e.tiles.every(tile)
        );
      case 'kakan':
        return (
          Number.isInteger(e.meldIndex) &&
          Number(e.meldIndex) >= 0 &&
          tile(e.tile)
        );
      case 'claim': {
        const response = e.response as Record<string, unknown> | null;
        if (!response || typeof response !== 'object') return false;
        if (['pass', 'ron', 'pon', 'minkan'].includes(String(response.type)))
          return true;
        return (
          response.type === 'chi' &&
          Array.isArray(response.tiles) &&
          response.tiles.length === 2 &&
          response.tiles.every(tile)
        );
      }
      default:
        return false;
    }
  };
  return (
    v.version === RIICHI_MATCH_VERSION &&
    Number.isSafeInteger(v.seed) &&
    (v.matchLength === 'east' || v.matchLength === 'south') &&
    Array.isArray(v.events) &&
    v.events.length <= 20000 &&
    v.events.every(eventIsValid) &&
    !!v.rules &&
    typeof v.rules === 'object'
  );
}
