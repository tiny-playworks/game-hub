import { createRiichiDeck, getBaseTile, isYaochuu } from '@/lib/mahjongRiichi';
import {
  type AbortiveDrawReason,
  countKans,
  shouldAbortOnSuuchaRiichi,
  shouldAbortOnSuufonRenda,
} from '@/lib/riichiAbortiveDraw';
import { consumeTimeBankSeconds } from '@/lib/riichiClock';
import {
  applyRonDeclinedFuriten,
  clearDoujunFuriten,
  createInitialFuritenState,
} from '@/lib/riichiFuriten';
import type { RiichiProgressEvent } from '@/lib/riichiProgress';
import {
  settleNagashiMangan,
  settleRyuukyoku,
  settleWins,
  type WinnerSettlementInput,
} from '@/lib/riichiSettlement';
import { mixSeed, mulberry32 } from '@/lib/seededRandom';
import type {
  ClaimKind,
  ClaimResponse,
  LastSettlementSummary,
  RiichiGameState,
  RiichiLogEntry,
  RiichiMeld,
  RiichiWinResult,
  RyuukyokuReason,
} from '../types';
import { evaluateSeatWin, paoYakumanCount, toWinResult } from './evaluate';
import { getWaits, isTenpai, removeTiles, sortHand, takeByBase } from './hand';
import {
  computeCallTurnOptions,
  computeClaimOptions,
  computeDrawTurnOptions,
  getKuikaeForbiddenBases,
  RIICHI_COST,
} from './options';
import type { RiichiRuleConfig } from './rules';

export type RiichiSound =
  | 'discard'
  | 'draw'
  | 'chi'
  | 'pon'
  | 'kan'
  | 'riichi'
  | 'tsumo'
  | 'ron'
  | 'ryuukyoku';

export type RiichiEffect =
  | { type: 'sound'; sound: RiichiSound; seat: number }
  | { type: 'progress'; event: RiichiProgressEvent; key: string };

/** 一次状态推进中累积的副作用与日志 */
export interface StepContext {
  rules: RiichiRuleConfig;
  effects: RiichiEffect[];
  logs: RiichiLogEntry[];
}

export function createStepContext(rules: RiichiRuleConfig): StepContext {
  return { rules, effects: [], logs: [] };
}

function log(ctx: StepContext, entry: RiichiLogEntry): RiichiLogEntry {
  ctx.logs.push(entry);
  return entry;
}

function progress(
  ctx: StepContext,
  state: RiichiGameState,
  event: RiichiProgressEvent,
): void {
  ctx.effects.push({ type: 'progress', event, key: `${state.roundId}:${event}` });
}

function sound(ctx: StepContext, s: RiichiSound, seat: number): void {
  ctx.effects.push({ type: 'sound', sound: s, seat });
}

const replaceAt = <T>(arr: readonly T[], index: number, value: T): T[] =>
  arr.map((v, i) => (i === index ? value : v));

export interface CreateRoundParams {
  matchSeed: number;
  roundId: number;
  dealer: number;
  roundWind: number;
  roundNumber: number;
  honba: number;
  scores: number[];
  timeBanks: number[];
  riichiPot: number;
  matchLength: 'east' | 'south';
  lastSettlement?: LastSettlementSummary;
}

/** 洗牌、配牌 13 张、切出 14 张王牌（岭上 4 + 宝牌 5 + 里宝 5），并由庄家第一摸开局 */
export function createRound(
  params: CreateRoundParams,
  ctx: StepContext,
): RiichiGameState {
  const deck = createRiichiDeck(
    mulberry32(mixSeed(params.matchSeed, params.roundId)),
  );
  const hands: number[][] = [[], [], [], []];
  for (let i = 0; i < 52; i++) hands[i % 4].push(deck[i]);
  const rest = deck.slice(52);
  const dead = rest.slice(-14);
  const doraPool = dead.slice(0, 5);
  const uraPool = dead.slice(5, 10);
  const state: RiichiGameState = {
    roundId: params.roundId,
    hands: hands.map(sortHand),
    wall: rest.slice(0, -14),
    rinshanTiles: dead.slice(10, 14),
    doraPool,
    uraPool,
    doraIndicators: [doraPool[0]],
    uraDoraIndicators: [uraPool[0]],
    discardPiles: [[], [], [], []],
    riichiDiscardIndex: [null, null, null, null],
    discardCalled: [false, false, false, false],
    riichiSafeTiles: [[], [], [], []],
    melds: [[], [], [], []],
    currentPlayer: params.dealer,
    drawnTile: null,
    lastDrawWasRinshan: false,
    phase: 'discard',
    claim: null,
    lastDiscard: null,
    lastDiscardFrom: null,
    turnOptions: null,
    lastAction: null,
    roundWind: params.roundWind,
    roundNumber: params.roundNumber,
    honba: params.honba,
    dealer: params.dealer,
    scores: [...params.scores],
    timeBanks: [...params.timeBanks],
    riichiPot: params.riichiPot,
    riichiDeclared: [false, false, false, false],
    doubleRiichi: [false, false, false, false],
    ippatsuPossible: [false, false, false, false],
    riichiPending: null,
    furitenStates: [0, 1, 2, 3].map(() => createInitialFuritenState()),
    firstTurn: [true, true, true, true],
    kuikaeForbidden: [],
    suukaikanPending: false,
    paoSeat: [null, null, null, null],
    timeoutEvents: [],
    matchLength: params.matchLength,
    result: null,
    lastSettlement: params.lastSettlement,
  };
  log(ctx, {
    key: 'riichi.log.roundStart',
    params: {
      windKey: `game.mahjong.winds.${params.roundWind}`,
      round: params.roundNumber,
      honba: params.honba,
    },
  });
  return drawTile(state, params.dealer, ctx, false);
}

function revealKanDora(state: RiichiGameState): RiichiGameState {
  const n = Math.min(state.doraPool.length, state.doraIndicators.length + 1);
  return {
    ...state,
    doraIndicators: state.doraPool.slice(0, n),
    uraDoraIndicators: state.uraPool.slice(0, n),
  };
}

/** 摸牌（普通 / 岭上）。活牌山为空时荒牌流局。 */
export function drawTile(
  state: RiichiGameState,
  seat: number,
  ctx: StepContext,
  rinshan: boolean,
): RiichiGameState {
  if (!rinshan && state.wall.length === 0) return endExhaustiveDraw(state, ctx);
  const wall = [...state.wall];
  const rinshanTiles = [...state.rinshanTiles];
  let tile: number | undefined;
  if (rinshan) {
    tile = rinshanTiles.shift();
    // 王牌保持 14 张：活牌山最后一张补入王牌
    wall.pop();
  } else {
    tile = wall.shift();
  }
  if (tile === undefined) return endExhaustiveDraw(state, ctx);
  const next: RiichiGameState = {
    ...state,
    wall,
    rinshanTiles,
    hands: replaceAt(state.hands, seat, sortHand([...state.hands[seat], tile])),
    furitenStates: replaceAt(
      state.furitenStates,
      seat,
      clearDoujunFuriten(state.furitenStates[seat]),
    ),
    currentPlayer: seat,
    drawnTile: tile,
    lastDrawWasRinshan: rinshan,
    phase: 'discard',
    claim: null,
    kuikaeForbidden: [],
  };
  if (seat === 0) sound(ctx, 'draw', seat);
  return {
    ...next,
    turnOptions: computeDrawTurnOptions(next, seat, ctx.rules),
  };
}

function consumeTime(
  state: RiichiGameState,
  seat: number,
  elapsed: number | undefined,
): number[] {
  if (!elapsed || elapsed <= 0) return state.timeBanks;
  return replaceAt(
    state.timeBanks,
    seat,
    consumeTimeBankSeconds(state.timeBanks[seat], elapsed),
  );
}

export interface ActionMeta {
  elapsed?: number;
  timeout?: boolean;
}

/** 打牌（含立直宣言牌），随后打开鸣牌窗口 */
export function discardTile(
  state: RiichiGameState,
  seat: number,
  tile: number,
  riichi: boolean,
  meta: ActionMeta,
  ctx: StepContext,
): RiichiGameState | null {
  const options = state.turnOptions;
  if (
    state.phase !== 'discard' ||
    state.currentPlayer !== seat ||
    !options ||
    options.seat !== seat
  ) {
    return null;
  }
  if (riichi ? !options.riichiDiscards.includes(tile) : !options.discardable.includes(tile)) {
    return null;
  }
  const hand = removeTiles(state.hands[seat], [tile]);
  if (!hand) return null;
  const pile = [...state.discardPiles[seat], tile];
  const totalBefore = state.discardPiles.reduce((s, p) => s + p.length, 0);
  const entry = log(ctx, {
    key: riichi ? 'riichi.log.riichi' : 'riichi.log.discard',
    params: { seat, tile },
  });
  if (meta.timeout) {
    log(ctx, { key: 'riichi.log.timeoutDiscard', params: { seat, tile } });
  }
  sound(ctx, riichi ? 'riichi' : 'discard', seat);
  if (riichi && seat === 0) progress(ctx, state, 'declare-riichi');
  const next: RiichiGameState = {
    ...state,
    hands: replaceAt(state.hands, seat, hand),
    discardPiles: replaceAt(state.discardPiles, seat, pile),
    riichiDiscardIndex: riichi
      ? replaceAt(state.riichiDiscardIndex, seat, pile.length - 1)
      : state.riichiDiscardIndex,
    riichiDeclared: riichi
      ? replaceAt(state.riichiDeclared, seat, true)
      : state.riichiDeclared,
    doubleRiichi:
      riichi && state.firstTurn[seat]
        ? replaceAt(state.doubleRiichi, seat, true)
        : state.doubleRiichi,
    riichiPending: riichi ? seat : null,
    ippatsuPossible:
      !riichi && state.riichiDeclared[seat]
        ? replaceAt(state.ippatsuPossible, seat, false)
        : state.ippatsuPossible,
    firstTurn: replaceAt(state.firstTurn, seat, false),
    timeBanks: consumeTime(state, seat, meta.elapsed),
    timeoutEvents: meta.timeout
      ? [
          ...state.timeoutEvents,
          { key: 'riichi.log.timeoutDiscard', params: { seat, tile } },
        ].slice(-20)
      : state.timeoutEvents,
    drawnTile: null,
    lastDrawWasRinshan: false,
    turnOptions: null,
    kuikaeForbidden: [],
    lastDiscard: tile,
    lastDiscardFrom: seat,
    lastAction: entry,
    lastSettlement: totalBefore === 0 ? undefined : state.lastSettlement,
  };
  return openClaimWindow(next, tile, seat, 'discard', ctx);
}

function openClaimWindow(
  state: RiichiGameState,
  tile: number,
  from: number,
  kind: ClaimKind,
  ctx: StepContext,
): RiichiGameState {
  const options = computeClaimOptions(state, tile, from, kind, ctx.rules);
  const next: RiichiGameState = {
    ...state,
    phase: 'claim',
    claim: {
      tile,
      from,
      kind,
      options,
      responses: [null, null, null, null],
    },
  };
  if (options.every((o) => o === null)) return resolveClaimWindow(next, ctx);
  return next;
}

function isResponseAllowed(
  response: ClaimResponse,
  options: NonNullable<RiichiGameState['claim']>['options'][number],
): boolean {
  if (!options) return false;
  switch (response.type) {
    case 'pass':
      return true;
    case 'ron':
      return options.ron;
    case 'pon':
      return options.pon;
    case 'minkan':
      return options.minkan;
    case 'chi':
      return options.chi.some(
        ([a, b]) =>
          (a === response.tiles[0] && b === response.tiles[1]) ||
          (a === response.tiles[1] && b === response.tiles[0]),
      );
  }
}

/** 记录一家的鸣牌响应；所有可响应座位都表态后统一结算 */
export function respondClaim(
  state: RiichiGameState,
  seat: number,
  response: ClaimResponse,
  meta: ActionMeta,
  ctx: StepContext,
): RiichiGameState | null {
  const claim = state.claim;
  if (state.phase !== 'claim' || !claim) return null;
  if (claim.responses[seat] !== null) return null;
  if (!isResponseAllowed(response, claim.options[seat])) return null;
  if (meta.timeout) {
    log(ctx, { key: 'riichi.log.timeoutPass', params: { seat } });
  }
  const next: RiichiGameState = {
    ...state,
    timeBanks: consumeTime(state, seat, meta.elapsed),
    timeoutEvents: meta.timeout
      ? [
          ...state.timeoutEvents,
          { key: 'riichi.log.timeoutPass', params: { seat } },
        ].slice(-20)
      : state.timeoutEvents,
    claim: {
      ...claim,
      responses: replaceAt(claim.responses, seat, response),
    },
  };
  const pending = [0, 1, 2, 3].some(
    (s) => next.claim?.options[s] && next.claim.responses[s] === null,
  );
  return pending ? next : resolveClaimWindow(next, ctx);
}

/** 见逃：待牌中的牌被放过后进入同巡振听（立直中为永久振听） */
function applyMissedFuriten(
  state: RiichiGameState,
  tile: number,
  from: number,
): RiichiGameState {
  const base = getBaseTile(tile);
  const furitenStates = state.furitenStates.map((f, seat) => {
    if (seat === from) return f;
    if (!getWaits(state.hands[seat], state.melds[seat]).includes(base)) return f;
    return applyRonDeclinedFuriten(f, state.riichiDeclared[seat]);
  });
  return { ...state, furitenStates };
}

/** 立直宣言牌通过（无人荣和）后支付立直棒并开启一发 */
function settleRiichiDeposit(state: RiichiGameState): RiichiGameState {
  const seat = state.riichiPending;
  if (seat === null) return state;
  return {
    ...state,
    riichiPending: null,
    scores: replaceAt(state.scores, seat, state.scores[seat] - RIICHI_COST),
    riichiPot: state.riichiPot + RIICHI_COST,
    ippatsuPossible: replaceAt(state.ippatsuPossible, seat, true),
  };
}

function markSuukaikan(state: RiichiGameState): RiichiGameState {
  const { total, seats } = countKans(state.melds);
  return total === 4 && seats >= 2 ? { ...state, suukaikanPending: true } : state;
}

function resolveClaimWindow(
  state: RiichiGameState,
  ctx: StepContext,
): RiichiGameState {
  const claim = state.claim;
  if (!claim) return state;
  const { tile, from, kind, responses } = claim;
  const order = [1, 2, 3].map((d) => (from + d) % 4);
  const rons = order.filter((s) => responses[s]?.type === 'ron');
  if (rons.length > 0) {
    if (rons.length === 3 && ctx.rules.sanchahouDraw) {
      return endAbortiveDraw(state, 'sanchahou', ctx);
    }
    const winners = ctx.rules.doubleRon ? rons : [rons[0]];
    return endWithWins(state, winners, false, tile, from, kind, ctx);
  }

  let next = settleRiichiDeposit(applyMissedFuriten(state, tile, from));
  next = {
    ...next,
    claim: null,
    riichiSafeTiles: next.riichiSafeTiles.map((safe, seat) =>
      seat !== from && next.riichiDeclared[seat] ? [...safe, tile] : safe,
    ),
  };

  if (kind === 'ankan') return drawTile(next, from, ctx, true);
  if (kind === 'kakan') {
    return drawTile(markSuukaikan(revealKanDora(next)), from, ctx, true);
  }

  if (shouldAbortOnSuuchaRiichi(next.riichiDeclared) && next.riichiPending === null && state.riichiPending !== null) {
    return endAbortiveDraw(next, 'suucha', ctx);
  }
  if (shouldAbortOnSuufonRenda(next.discardPiles, next.melds)) {
    return endAbortiveDraw(next, 'suufon', ctx);
  }
  if (next.suukaikanPending) return endAbortiveDraw(next, 'suukaikan', ctx);

  const caller = order.find(
    (s) => responses[s]?.type === 'pon' || responses[s]?.type === 'minkan',
  );
  if (caller !== undefined) {
    const response = responses[caller];
    return response?.type === 'minkan'
      ? applyMinkan(next, caller, tile, from, ctx)
      : applyPon(next, caller, tile, from, ctx);
  }
  const chiSeat = order.find((s) => responses[s]?.type === 'chi');
  const chiResponse = chiSeat === undefined ? null : responses[chiSeat];
  if (chiSeat !== undefined && chiResponse?.type === 'chi') {
    return applyChi(next, chiSeat, tile, from, chiResponse.tiles, ctx);
  }
  return drawTile(next, (from + 1) % 4, ctx, false);
}

function takeCalledTileFromRiver(
  state: RiichiGameState,
  from: number,
): Pick<RiichiGameState, 'discardPiles' | 'discardCalled'> {
  return {
    discardPiles: replaceAt(
      state.discardPiles,
      from,
      state.discardPiles[from].slice(0, -1),
    ),
    discardCalled: replaceAt(state.discardCalled, from, true),
  };
}

const DRAGON_BASES = [31, 32, 33];
const WIND_BASES = [27, 28, 29, 30];

function completedSets(melds: RiichiMeld[], bases: number[]): number {
  return bases.filter((b) =>
    melds.some(
      (m) => m.type !== 'chi' && getBaseTile(m.tiles[0]) === b,
    ),
  ).length;
}

/** 碰 / 明杠第 3 组三元牌或第 4 组风牌时记录包牌责任者 */
function updatePao(
  state: RiichiGameState,
  seat: number,
  melds: RiichiMeld[],
  tile: number,
  from: number,
): (number | null)[] {
  const base = getBaseTile(tile);
  const dragon = DRAGON_BASES.includes(base) && completedSets(melds, DRAGON_BASES) === 3;
  const wind = WIND_BASES.includes(base) && completedSets(melds, WIND_BASES) === 4;
  return dragon || wind ? replaceAt(state.paoSeat, seat, from) : state.paoSeat;
}

function afterCallCommon(
  state: RiichiGameState,
  seat: number,
  from: number,
): RiichiGameState {
  return {
    ...state,
    ...takeCalledTileFromRiver(state, from),
    ippatsuPossible: [false, false, false, false],
    firstTurn: [false, false, false, false],
    furitenStates: replaceAt(
      state.furitenStates,
      seat,
      clearDoujunFuriten(state.furitenStates[seat]),
    ),
    currentPlayer: seat,
    phase: 'discard',
    claim: null,
    lastDiscard: null,
    lastDiscardFrom: null,
    drawnTile: null,
    lastDrawWasRinshan: false,
  };
}

function applyChi(
  state: RiichiGameState,
  seat: number,
  tile: number,
  from: number,
  pair: [number, number],
  ctx: StepContext,
): RiichiGameState {
  const hand = removeTiles(state.hands[seat], pair);
  if (!hand) return drawTile(state, (from + 1) % 4, ctx, false);
  const meld: RiichiMeld = {
    type: 'chi',
    tiles: sortHand([...pair, tile]),
    fromPlayer: from,
    calledTile: tile,
  };
  const entry = log(ctx, { key: 'riichi.log.chi', params: { seat, tiles: meld.tiles } });
  sound(ctx, 'chi', seat);
  const next: RiichiGameState = {
    ...afterCallCommon(state, seat, from),
    hands: replaceAt(state.hands, seat, hand),
    melds: replaceAt(state.melds, seat, [...state.melds[seat], meld]),
    kuikaeForbidden: ctx.rules.kuikae ? getKuikaeForbiddenBases(tile, pair) : [],
    lastAction: entry,
  };
  return { ...next, turnOptions: computeCallTurnOptions(next, seat) };
}

function applyPon(
  state: RiichiGameState,
  seat: number,
  tile: number,
  from: number,
  ctx: StepContext,
): RiichiGameState {
  const taken = takeByBase(state.hands[seat], getBaseTile(tile), 2);
  if (!taken) return drawTile(state, (from + 1) % 4, ctx, false);
  const meld: RiichiMeld = {
    type: 'peng',
    tiles: [...taken.taken, tile],
    fromPlayer: from,
    calledTile: tile,
  };
  const melds = [...state.melds[seat], meld];
  const entry = log(ctx, { key: 'riichi.log.pon', params: { seat, tile } });
  sound(ctx, 'pon', seat);
  const next: RiichiGameState = {
    ...afterCallCommon(state, seat, from),
    hands: replaceAt(state.hands, seat, taken.rest),
    melds: replaceAt(state.melds, seat, melds),
    paoSeat: ctx.rules.pao ? updatePao(state, seat, melds, tile, from) : state.paoSeat,
    kuikaeForbidden: ctx.rules.kuikae ? getKuikaeForbiddenBases(tile, null) : [],
    lastAction: entry,
  };
  return { ...next, turnOptions: computeCallTurnOptions(next, seat) };
}

function applyMinkan(
  state: RiichiGameState,
  seat: number,
  tile: number,
  from: number,
  ctx: StepContext,
): RiichiGameState {
  const taken = takeByBase(state.hands[seat], getBaseTile(tile), 3);
  if (!taken) return drawTile(state, (from + 1) % 4, ctx, false);
  const meld: RiichiMeld = {
    type: 'mingang',
    tiles: [...taken.taken, tile],
    fromPlayer: from,
    calledTile: tile,
  };
  const melds = [...state.melds[seat], meld];
  const entry = log(ctx, { key: 'riichi.log.minkan', params: { seat, tile } });
  sound(ctx, 'kan', seat);
  const next: RiichiGameState = {
    ...afterCallCommon(state, seat, from),
    hands: replaceAt(state.hands, seat, taken.rest),
    melds: replaceAt(state.melds, seat, melds),
    paoSeat: ctx.rules.pao ? updatePao(state, seat, melds, tile, from) : state.paoSeat,
    lastAction: entry,
  };
  return drawTile(markSuukaikan(revealKanDora(next)), seat, ctx, true);
}

function sameTileSet(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

export function declareAnkan(
  state: RiichiGameState,
  seat: number,
  tiles: number[],
  meta: ActionMeta,
  ctx: StepContext,
): RiichiGameState | null {
  const options = state.turnOptions;
  if (
    state.phase !== 'discard' ||
    state.currentPlayer !== seat ||
    !options?.ankan.some((o) => sameTileSet(o, tiles))
  ) {
    return null;
  }
  const hand = removeTiles(state.hands[seat], tiles);
  if (!hand) return null;
  const entry = log(ctx, { key: 'riichi.log.ankan', params: { seat, tile: tiles[0] } });
  sound(ctx, 'kan', seat);
  const next: RiichiGameState = {
    ...state,
    hands: replaceAt(state.hands, seat, hand),
    melds: replaceAt(state.melds, seat, [
      ...state.melds[seat],
      { type: 'angang', tiles: [...tiles] },
    ]),
    ippatsuPossible: [false, false, false, false],
    firstTurn: [false, false, false, false],
    timeBanks: consumeTime(state, seat, meta.elapsed),
    drawnTile: null,
    lastDrawWasRinshan: false,
    turnOptions: null,
    lastAction: entry,
  };
  return openClaimWindow(
    markSuukaikan(revealKanDora(next)),
    tiles[0],
    seat,
    'ankan',
    ctx,
  );
}

export function declareKakan(
  state: RiichiGameState,
  seat: number,
  meldIndex: number,
  tile: number,
  meta: ActionMeta,
  ctx: StepContext,
): RiichiGameState | null {
  const options = state.turnOptions;
  if (
    state.phase !== 'discard' ||
    state.currentPlayer !== seat ||
    !options?.kakan.some((o) => o.meldIndex === meldIndex && o.tile === tile)
  ) {
    return null;
  }
  const hand = removeTiles(state.hands[seat], [tile]);
  if (!hand) return null;
  const melds = state.melds[seat].map((m, i) =>
    i === meldIndex
      ? { ...m, type: 'kakan' as const, tiles: [...m.tiles, tile] }
      : m,
  );
  const entry = log(ctx, { key: 'riichi.log.kakan', params: { seat, tile } });
  sound(ctx, 'kan', seat);
  const next: RiichiGameState = {
    ...state,
    hands: replaceAt(state.hands, seat, hand),
    melds: replaceAt(state.melds, seat, melds),
    ippatsuPossible: [false, false, false, false],
    firstTurn: [false, false, false, false],
    timeBanks: consumeTime(state, seat, meta.elapsed),
    drawnTile: null,
    lastDrawWasRinshan: false,
    turnOptions: null,
    lastAction: entry,
  };
  return openClaimWindow(next, tile, seat, 'kakan', ctx);
}

export function declareTsumo(
  state: RiichiGameState,
  seat: number,
  meta: ActionMeta,
  ctx: StepContext,
): RiichiGameState | null {
  if (
    state.phase !== 'discard' ||
    state.currentPlayer !== seat ||
    !state.turnOptions?.tsumo ||
    state.drawnTile === null
  ) {
    return null;
  }
  const timed = { ...state, timeBanks: consumeTime(state, seat, meta.elapsed) };
  return endWithWins(timed, [seat], true, state.drawnTile, seat, 'discard', ctx);
}

export function declareKyuushu(
  state: RiichiGameState,
  seat: number,
  ctx: StepContext,
): RiichiGameState | null {
  if (
    state.phase !== 'discard' ||
    state.currentPlayer !== seat ||
    !state.turnOptions?.kyuushu
  ) {
    return null;
  }
  return endAbortiveDraw(state, 'kyuushu', ctx);
}

function paoShareFor(
  evaluation: ReturnType<typeof evaluateSeatWin>,
  state: RiichiGameState,
  seat: number,
): number {
  const pao = paoYakumanCount(evaluation);
  const paoSeat = state.paoSeat[seat];
  if (paoSeat === null || evaluation.yakuman <= 0) return 0;
  const count = pao.daisangen + pao.daisuushi;
  return count > 0 ? Math.min(1, count / evaluation.yakuman) : 0;
}

function endWithWins(
  state: RiichiGameState,
  winners: number[],
  isTsumo: boolean,
  tile: number,
  from: number,
  kind: ClaimKind,
  ctx: StepContext,
): RiichiGameState {
  const wins: RiichiWinResult[] = [];
  const inputs: WinnerSettlementInput[] = [];
  for (const seat of winners) {
    const evaluation = evaluateSeatWin({
      state,
      seat,
      isTsumo,
      winningTile: tile,
      chankan: !isTsumo && kind !== 'discard',
      rules: ctx.rules,
    });
    if (!evaluation.legalWin) continue;
    const share = ctx.rules.pao ? paoShareFor(evaluation, state, seat) : 0;
    const paoSeat = share > 0 ? state.paoSeat[seat] : null;
    wins.push(
      toWinResult(state, seat, isTsumo, tile, isTsumo ? null : from, evaluation, paoSeat),
    );
    inputs.push({
      winner: seat,
      isTsumo,
      baseTen: evaluation.totalPoints,
      tsumoPayments: evaluation.tsumoPayments,
      paoSeat,
      paoShare: share,
    });
    const points = evaluation.totalPoints;
    log(ctx, {
      key: isTsumo
        ? evaluation.yakuman > 0
          ? 'riichi.log.tsumoYakuman'
          : 'riichi.log.tsumo'
        : evaluation.yakuman > 0
          ? 'riichi.log.ronYakuman'
          : 'riichi.log.ron',
      params: {
        seat,
        from,
        tile,
        fu: evaluation.fu,
        han: evaluation.han,
        yakuman: evaluation.yakuman,
        points,
      },
    });
    if (seat === 0) {
      progress(ctx, state, 'win-hand');
      if (isTsumo) progress(ctx, state, 'tsumo-win');
    }
  }
  if (wins.length === 0) return state;
  sound(ctx, isTsumo ? 'tsumo' : 'ron', wins[0].winner);
  progress(ctx, state, 'finish-round');
  const settlement = settleWins({
    scores: state.scores,
    dealer: state.dealer,
    honba: state.honba,
    riichiPot: state.riichiPot,
    ronFrom: isTsumo ? null : from,
    wins: inputs,
  });
  return {
    ...state,
    phase: 'end',
    claim: null,
    turnOptions: null,
    riichiPending: null,
    lastAction: ctx.logs[ctx.logs.length - 1] ?? state.lastAction,
    result: { type: 'win', wins, settlement },
  };
}

function isNagashi(state: RiichiGameState, seat: number): boolean {
  const pile = state.discardPiles[seat];
  return (
    pile.length > 0 && !state.discardCalled[seat] && pile.every(isYaochuu)
  );
}

function endExhaustiveDraw(
  state: RiichiGameState,
  ctx: StepContext,
): RiichiGameState {
  const tenpaiSeats = [0, 1, 2, 3].filter((seat) =>
    isTenpai(state.hands[seat], state.melds[seat]),
  );
  const nagashiSeats = ctx.rules.nagashiMangan
    ? [0, 1, 2, 3].filter((seat) => isNagashi(state, seat))
    : [];
  const settlement =
    nagashiSeats.length > 0
      ? settleNagashiMangan(state.scores, state.dealer, nagashiSeats, state.riichiPot)
      : settleRyuukyoku(state.scores, tenpaiSeats, state.riichiPot);
  for (const seat of nagashiSeats) {
    log(ctx, { key: 'riichi.log.nagashi', params: { seat } });
  }
  return finishDraw(state, 'exhaustive', tenpaiSeats, nagashiSeats, settlement, ctx);
}

function endAbortiveDraw(
  state: RiichiGameState,
  reason: AbortiveDrawReason,
  ctx: StepContext,
): RiichiGameState {
  return finishDraw(
    state,
    reason,
    [],
    [],
    {
      newScores: [...state.scores],
      deltas: [0, 0, 0, 0],
      payments: [],
      nextRiichiPot: state.riichiPot,
    },
    ctx,
  );
}

function finishDraw(
  state: RiichiGameState,
  reason: RyuukyokuReason,
  tenpaiSeats: number[],
  nagashiSeats: number[],
  settlement: ReturnType<typeof settleRyuukyoku>,
  ctx: StepContext,
): RiichiGameState {
  const entry = log(ctx, {
    key: 'riichi.log.ryuukyoku',
    params: { reasonKey: `riichi.drawReason.${reason}` },
  });
  sound(ctx, 'ryuukyoku', state.currentPlayer);
  progress(ctx, state, 'finish-round');
  return {
    ...state,
    phase: 'end',
    claim: null,
    turnOptions: null,
    drawnTile: null,
    riichiPending: null,
    lastAction: entry,
    result: { type: 'draw', reason, tenpaiSeats, nagashiSeats, settlement },
  };
}
