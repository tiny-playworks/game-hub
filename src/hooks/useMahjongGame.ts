import { useCallback, useState } from 'react';
import {
  createShuffledDeck,
  deal,
  checkWin,
  getWinFans,
  computeSettlement,
  getChiOptions,
  canPeng,
  canMingang,
  getJiagangOptions,
  getTileCountsSeen,
  getWaitingTiles,
  estimateKuaiHuValue,
  isYaoJiu,
  isZiTile,
  type GameState,
  type Meld,
  type LastDiscard,
  type ClaimOption,
  type ClaimRound,
} from '@/lib/mahjong';

const HUMAN_SEAT = 0;

/** 手牌中对子个数（相同牌出现次数>=2 的牌型数） */
function countPairs(hand: number[]): number {
  const counts = new Map<number, number>();
  for (const t of hand) counts.set(t, (counts.get(t) ?? 0) + 1);
  let pairs = 0;
  for (const c of counts.values()) if (c >= 2) pairs++;
  return pairs;
}

/**
 * 对一种「吃」法打分：顺子类型（边张差/嵌张中/两面好）+ 与手牌剩余牌的连贯性。
 * 返回 0~3+，越高越值得吃。
 */
function scoreChiOption(
  hand: number[],
  option: [number, number],
  eatenTile: number,
): number {
  const [a, b] = option;
  const seq = [a, b, eatenTile].sort((x, y) => x - y);
  const s0 = seq[0];
  const s2 = seq[2];
  const suit = Math.floor(s0 / 9);
  const r0 = s0 % 9;
  const r2 = s2 % 9;
  // 边张：123 或 789；嵌张：吃中间；其余为两面
  let typeScore = 2;
  if ((r0 === 0 && r2 === 2) || (r0 === 6 && r2 === 8)) typeScore = 0; // 边张
  else if (r2 - r0 === 2 && option[0] === s0 && option[1] === s2) typeScore = 1; // 嵌张（吃中间）
  else typeScore = 2; // 两面
  // 剩余手牌（各去掉一张 a、一张 b）中与这支顺子能搭上的牌
  const rest = [...hand];
  const ia = rest.indexOf(a);
  if (ia >= 0) rest.splice(ia, 1);
  const ib = rest.indexOf(b);
  if (ib >= 0) rest.splice(ib, 1);
  let connection = 0;
  const low = suit * 9;
  const high = suit * 9 + 8;
  for (const t of rest) {
    if (t < low || t > high) continue;
    if (t === s0 - 1 || t === s2 + 1) connection += 1.5; // 直接延伸
    if (t === s0 - 2 || t === s2 + 2) connection += 0.5;
  }
  return typeScore + Math.min(connection, 1.5);
}

/**
 * AI 是否选择碰：考虑已有面子数、对子数；庄家/残局时更保守（策略 rule_id 7）。
 */
function aiWantsPeng(
  hand: number[],
  melds: Meld[],
  _tile: number,
  state?: GameState | null,
  player?: number,
): boolean {
  const pairCount = countPairs(hand);
  const meldCount = melds.length;
  if (pairCount >= 4) return Math.random() < 0.18;
  let prob = 0.35;
  if (meldCount <= 1) prob = 0.65;
  else if (meldCount === 2) prob = 0.5;
  if (state && player !== undefined && (state.dealer === player || state.deck.length < 20)) {
    prob *= 0.6; // 庄家保守、残局防守
  }
  return Math.random() < prob;
}

/** AI 是否选择明杠：庄家/残局时更保守（策略 rule_id 7） */
function aiWantsGang(
  _hand: number[],
  melds: Meld[],
  state?: GameState | null,
  player?: number,
): boolean {
  let prob = melds.length >= 3 ? 0.9 : 0.75;
  if (state && player !== undefined && (state.dealer === player || state.deck.length < 20)) {
    prob *= 0.55;
  }
  return Math.random() < prob;
}

/** 推进要牌轮次：下一家或下一阶段；返回 null 表示进入吃后无人吃则摸牌 */
function advanceClaimRound(r: ClaimRound): ClaimRound | null {
  if (r.index + 1 < 3) return { phase: r.phase, index: r.index + 1 };
  if (r.phase === 'hu') return { phase: 'gang', index: 0 };
  if (r.phase === 'gang') return { phase: 'peng', index: 0 };
  if (r.phase === 'peng') return { phase: 'chi', index: 0 };
  return null; // 吃阶段只有下家，无人吃则摸牌
}

/** 下家摸牌（要牌轮无人要时）：流局/自摸判定，并清空 claim 相关状态 */
function applyPassState(s: GameState): GameState {
  if (s.lastDiscard === null) return s;
  const 下家 = (s.lastDiscard.fromPlayer + 1) % 4;
  const deck = [...s.deck];
  const hands = s.hands.map((h) => [...h]);
  if (deck.length === 0) {
    const st: GameState = { ...s, isDraw: true, phase: 'discard', lastDiscard: null, claimOption: null, claimRound: null, claimPlayer: null };
    const settlement = computeSettlement(st);
    return { ...st, scores: settlement.newScores, lastSettlement: settlement };
  }
  const drawn = deck.pop()!;
  hands[下家].push(drawn);
  hands[下家].sort((a, b) => a - b);
  const win = checkWin(hands[下家], s.melds[下家]);
  const wasLastTile = deck.length === 0;
  const winResult: GameState['lastWinResult'] = win
    ? getWinFans(hands[下家], s.melds[下家], undefined, { isZiMo: true, isHaidilao: wasLastTile })
    : null;
  const lastDrawnTile = !win && 下家 === HUMAN_SEAT ? drawn : null;
  const st: GameState = {
    ...s,
    hands,
    deck,
    currentPlayer: 下家,
    phase: 'discard',
    lastDiscard: null,
    claimOption: null,
    claimRound: null,
    claimPlayer: null,
    winner: win ? 下家 : null,
    lastWinResult: winResult ?? s.lastWinResult,
    isDraw: !win && wasLastTile,
    lastHuFromPlayer: win ? null : s.lastHuFromPlayer,
    lastDrawnTile: win ? s.lastDrawnTile : lastDrawnTile,
  };
  if (win || st.isDraw) {
    const settlement = computeSettlement(st);
    return { ...st, scores: settlement.newScores, lastSettlement: settlement };
  }
  return st;
}

/**
 * AI 是否选择吃，以及选哪种吃法。庄家/残局时更保守（策略 rule_id 7）。
 */
function aiChooseChi(
  hand: number[],
  melds: Meld[],
  chiOptions: [number, number][],
  lastTile: number,
  state?: GameState | null,
  player?: number,
): { doChi: boolean; option: [number, number] | null } {
  if (chiOptions.length === 0) return { doChi: false, option: null };
  const meldCount = melds.length;
  const scored = chiOptions.map((opt) => ({
    option: opt,
    score: scoreChiOption(hand, opt, lastTile),
  }));
  scored.sort((x, y) => y.score - x.score);
  const best = scored[0];
  if (best.score < 0.5) return { doChi: false, option: null };
  let baseProb = 0.35;
  if (meldCount <= 1) baseProb = 0.6;
  else if (meldCount === 2) baseProb = 0.45;
  if (state && player !== undefined && (state.dealer === player || state.deck.length < 20)) {
    baseProb *= 0.6;
  }
  const prob = Math.min(0.85, baseProb + best.score * 0.12);
  if (Math.random() >= prob) return { doChi: false, option: null };
  return { doChi: true, option: best.option };
}

function buildClaimOption(
  hand: number[],
  melds: Meld[],
  last: LastDiscard,
  myIndex: number,
): ClaimOption | null {
  const opt: ClaimOption = {};
  const chiOptions = getChiOptions(hand, last.tile, last.fromPlayer, myIndex);
  if (chiOptions.length > 0) opt.chi = chiOptions;
  if (canPeng(hand, last.tile)) opt.peng = true;
  if (canMingang(hand, last.tile)) opt.gang = true;
  const hu = checkWin(hand, melds, last.tile);
  if (hu) opt.hu = true;
  if (Object.keys(opt).length === 0) return null;
  return opt;
}

export function useMahjongGame() {
  const [state, setState] = useState<GameState | null>(null);

  const startGame = useCallback(() => {
    const deck = createShuffledDeck();
    const dealer = 0;
    const [hands, wall] = deal(deck, dealer);
    setState({
      hands,
      melds: [[], [], [], []],
      discardPiles: [[], [], [], []],
      deck: wall,
      currentPlayer: dealer,
      phase: 'discard',
      lastDiscard: null,
      claimOption: null,
      claimPlayer: null,
      claimRound: null,
      winner: null,
      humanSeat: HUMAN_SEAT,
      dealer,
      lastWinResult: null,
      isDraw: false,
      baseScore: 1,
      scores: [0, 0, 0, 0],
      gangRecords: [],
      lastHuFromPlayer: null,
      lastSettlement: null,
      lastDrawnTile: null,
    });
  }, []);

  const discard = useCallback((player: number, tileIndex: number) => {
    setState((s) => {
      if (!s || s.phase !== 'discard' || s.currentPlayer !== player || s.winner !== null) return s;
      const hands = s.hands.map((h) => [...h]);
      const tile = hands[player][tileIndex];
      hands[player].splice(tileIndex, 1);
      hands[player].sort((a, b) => a - b);
      const discardPiles = s.discardPiles.map((p, i) => (i === player ? [...p, tile] : p));
      const lastDiscard: LastDiscard = { tile, fromPlayer: player };
      return {
        ...s,
        hands,
        discardPiles,
        lastDiscard,
        phase: 'claim',
        claimOption: null,
        claimPlayer: null,
        claimRound: { phase: 'hu', index: 0 },
        lastDrawnTile: player === HUMAN_SEAT ? null : s.lastDrawnTile,
      };
    });
  }, []);

  /** 人类点「过」：推进要牌轮次；若已到吃阶段且下家过，则下家摸牌 */
  const passClaim = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== 'claim' || s.lastDiscard === null || s.claimRound === null) return s;
      const nextRound = advanceClaimRound(s.claimRound);
      if (nextRound === null) return applyPassState(s);
      return { ...s, claimRound: nextRound, claimOption: null, claimPlayer: null };
    });
  }, []);

  const doHu = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== 'claim' || !s.claimOption?.hu || s.lastDiscard === null) return s;
      const winResult = getWinFans(
        s.hands[HUMAN_SEAT],
        s.melds[HUMAN_SEAT],
        s.lastDiscard.tile,
        { isZiMo: false },
      );
      const st: GameState = {
        ...s,
        winner: HUMAN_SEAT,
        phase: 'discard',
        lastDiscard: null,
        claimOption: null,
        claimRound: null,
        claimPlayer: null,
        lastWinResult: winResult ?? null,
        lastHuFromPlayer: s.lastDiscard.fromPlayer,
      };
      const settlement = computeSettlement(st);
      return { ...st, scores: settlement.newScores, lastSettlement: settlement };
    });
  }, []);

  const doPeng = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== 'claim' || !s.claimOption?.peng || s.lastDiscard === null) return s;
      const player = HUMAN_SEAT;
      const tile = s.lastDiscard.tile;
      const hands = s.hands.map((h) => [...h]);
      const melds = s.melds.map((m) => [...m]);
      const idx1 = hands[player].indexOf(tile);
      hands[player].splice(idx1, 1);
      const idx2 = hands[player].indexOf(tile);
      hands[player].splice(idx2, 1);
      melds[player].push({ type: 'peng', tiles: [tile, tile, tile], fromPlayer: s.lastDiscard.fromPlayer });
      const discardPiles = s.discardPiles.map((p, i) => (i === s.lastDiscard!.fromPlayer ? p.slice(0, -1) : p));
      return {
        ...s,
        hands,
        melds,
        discardPiles,
        currentPlayer: player,
        phase: 'discard',
        lastDiscard: null,
        claimOption: null,
        claimRound: null,
        claimPlayer: null,
      };
    });
  }, []);

  const doGang = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== 'claim' || !s.claimOption?.gang || s.lastDiscard === null) return s;
      const player = HUMAN_SEAT;
      const tile = s.lastDiscard.tile;
      const hands = s.hands.map((h) => [...h]);
      const melds = s.melds.map((m) => [...m]);
      const gangRecords = [...(s.gangRecords ?? []), { type: 'mingang' as const, player, fromPlayer: s.lastDiscard.fromPlayer }];
      for (let i = 0; i < 3; i++) {
        const idx = hands[player].indexOf(tile);
        hands[player].splice(idx, 1);
      }
      melds[player].push({ type: 'mingang', tiles: [tile, tile, tile, tile], fromPlayer: s.lastDiscard.fromPlayer });
      const discardPiles = s.discardPiles.map((p, i) => (i === s.lastDiscard!.fromPlayer ? p.slice(0, -1) : p));
      const deck = [...s.deck];
      const 补牌 = deck.length > 0 ? deck.pop()! : null;
      if (补牌 !== null) {
        hands[player].push(补牌);
        hands[player].sort((a, b) => a - b);
        const win = checkWin(hands[player], melds[player]);
        const winResult: GameState['lastWinResult'] = win
          ? getWinFans(hands[player], melds[player], undefined, { isZiMo: true, isGangShang: true })
          : null;
        const st: GameState = {
          ...s,
          hands,
          melds,
          discardPiles,
          deck,
          gangRecords,
          currentPlayer: player,
          phase: 'discard',
          lastDiscard: null,
          claimOption: null,
          claimRound: null,
          claimPlayer: null,
          winner: win ? player : null,
          lastWinResult: winResult ?? s.lastWinResult,
          lastHuFromPlayer: win ? null : s.lastHuFromPlayer,
          lastDrawnTile: win ? null : (player === HUMAN_SEAT ? 补牌 : s.lastDrawnTile),
        };
        if (win) {
          const settlement = computeSettlement(st);
          return { ...st, scores: settlement.newScores, lastSettlement: settlement };
        }
        return st;
      }
      return {
        ...s,
        hands,
        melds,
        discardPiles,
        deck,
        gangRecords,
        currentPlayer: player,
        phase: 'discard',
        lastDiscard: null,
        claimOption: null,
        claimRound: null,
        claimPlayer: null,
      };
    });
  }, []);

  const doChi = useCallback((option: [number, number]) => {
    setState((s) => {
      if (!s || s.phase !== 'claim' || !s.claimOption?.chi || s.lastDiscard === null) return s;
      const [a, b] = option;
      const player = HUMAN_SEAT;
      const tile = s.lastDiscard.tile;
      const hands = s.hands.map((h) => [...h]);
      const melds = s.melds.map((m) => [...m]);
      const seq = [a, b, tile].sort((x, y) => x - y);
      const ia = hands[player].indexOf(a);
      hands[player].splice(ia, 1);
      const ib = hands[player].indexOf(b);
      hands[player].splice(ib, 1);
      melds[player].push({ type: 'chi', tiles: seq, fromPlayer: s.lastDiscard.fromPlayer });
      const discardPiles = s.discardPiles.map((p, i) => (i === s.lastDiscard!.fromPlayer ? p.slice(0, -1) : p));
      return {
        ...s,
        hands,
        melds,
        discardPiles,
        currentPlayer: player,
        phase: 'discard',
        lastDiscard: null,
        claimOption: null,
        claimRound: null,
        claimPlayer: null,
      };
    });
  }, []);

  const doJiagang = useCallback((meldIndex: number) => {
    setState((s) => {
      if (!s || s.phase !== 'discard' || s.currentPlayer !== HUMAN_SEAT || s.winner !== null) return s;
      const indices = getJiagangOptions(s.hands[HUMAN_SEAT], s.melds[HUMAN_SEAT]);
      if (!indices.includes(meldIndex)) return s;
      const player = HUMAN_SEAT;
      const melds = s.melds.map((m) => [...m]);
      const m = melds[player][meldIndex];
      if (m.type !== 'peng' || m.tiles.length !== 3) return s;
      const t = m.tiles[0];
      const fromPlayer = m.fromPlayer ?? player;
      const gangRecords = [...(s.gangRecords ?? []), { type: 'jiagang' as const, player, fromPlayer }];
      const hands = s.hands.map((h) => [...h]);
      const idx = hands[player].indexOf(t);
      if (idx === -1) return s;
      hands[player].splice(idx, 1);
      const newPlayerMelds = [...melds[player]];
      newPlayerMelds[meldIndex] = { type: 'jiagang' as const, tiles: [t, t, t, t], fromPlayer: m.fromPlayer };
      melds[player] = newPlayerMelds;
      const deck = [...s.deck];
      const 补牌 = deck.length > 0 ? deck.pop()! : null;
      if (补牌 !== null) {
        hands[player].push(补牌);
        hands[player].sort((a, b) => a - b);
        const win = checkWin(hands[player], melds[player]);
        const winResult: GameState['lastWinResult'] = win
          ? getWinFans(hands[player], melds[player], undefined, { isZiMo: true, isGangShang: true })
          : null;
        const st: GameState = {
          ...s,
          hands,
          melds,
          deck,
          gangRecords,
          phase: 'discard',
          winner: win ? player : null,
          lastWinResult: winResult ?? s.lastWinResult,
          lastHuFromPlayer: win ? null : s.lastHuFromPlayer,
          lastDrawnTile: win ? null : (player === HUMAN_SEAT ? 补牌 : s.lastDrawnTile),
        };
        if (win) {
          const settlement = computeSettlement(st);
          return { ...st, scores: settlement.newScores, lastSettlement: settlement };
        }
        return st;
      }
      return { ...s, hands, melds, deck, gangRecords };
    });
  }, []);

  const doAngang = useCallback((tileType: number) => {
    setState((s) => {
      if (!s || s.phase !== 'discard' || s.currentPlayer !== HUMAN_SEAT || s.winner !== null) return s;
      const player = HUMAN_SEAT;
      const hands = s.hands.map((h) => [...h]);
      const melds = s.melds.map((m) => [...m]);
      const gangRecords = [...(s.gangRecords ?? []), { type: 'angang' as const, player }];
      for (let i = 0; i < 4; i++) {
        const idx = hands[player].indexOf(tileType);
        hands[player].splice(idx, 1);
      }
      melds[player].push({ type: 'angang', tiles: [tileType, tileType, tileType, tileType] });
      const deck = [...s.deck];
      const 补牌 = deck.length > 0 ? deck.pop()! : null;
      if (补牌 !== null) {
        hands[player].push(补牌);
        hands[player].sort((a, b) => a - b);
        const win = checkWin(hands[player], melds[player]);
        const winResult: GameState['lastWinResult'] = win
          ? getWinFans(hands[player], melds[player], undefined, { isZiMo: true, isGangShang: true })
          : null;
        const st: GameState = {
          ...s,
          hands,
          melds,
          deck,
          gangRecords,
          phase: 'discard',
          winner: win ? player : null,
          lastWinResult: winResult ?? s.lastWinResult,
          lastHuFromPlayer: win ? null : s.lastHuFromPlayer,
          lastDrawnTile: win ? null : (player === HUMAN_SEAT ? 补牌 : s.lastDrawnTile),
        };
        if (win) {
          const settlement = computeSettlement(st);
          return { ...st, scores: settlement.newScores, lastSettlement: settlement };
        }
        return st;
      }
      return { ...s, hands, melds, deck, gangRecords };
    });
  }, []);

  const doZiMo = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== 'discard' || s.currentPlayer !== HUMAN_SEAT || s.winner !== null) return s;
      const hand = s.hands[HUMAN_SEAT];
      const melds = s.melds[HUMAN_SEAT];
      if (checkWin(hand, melds)) {
        const winResult = getWinFans(hand, melds, undefined, {
          isZiMo: true,
          isHaidilao: s.deck.length === 0,
        });
        const st: GameState = {
          ...s,
          winner: HUMAN_SEAT,
          lastWinResult: winResult ?? null,
          lastHuFromPlayer: null,
        };
        const settlement = computeSettlement(st);
        return { ...st, scores: settlement.newScores, lastSettlement: settlement };
      }
      return s;
    });
  }, []);

  /**
   * 要牌轮次处理：胡/杠/碰 按 下家→对家→上家 顺序轮询，吃仅下家。
   * 任意一家打出的牌，三家都可抢胡/杠/碰；人类会看到按钮，AI 在此内决策。
   */
  function processClaimRound(s: GameState): GameState {
    if (s.phase !== 'claim' || s.lastDiscard === null) return s;
    const from = s.lastDiscard.fromPlayer;
    const order: [number, number, number] = [(from + 1) % 4, (from + 2) % 4, (from + 3) % 4];
    const 下家 = order[0];
    let round: ClaimRound | null = s.claimRound ?? { phase: 'hu', index: 0 };

    const clearClaim = (st: GameState): GameState =>
      ({ ...st, claimRound: null, claimPlayer: null });

    const applyPass = (): GameState => applyPassState(s);

    const applyHu = (player: number): GameState => {
      const winResult = getWinFans(
        s.hands[player],
        s.melds[player],
        s.lastDiscard!.tile,
        { isZiMo: false },
      );
      const st: GameState = {
        ...s,
        winner: player,
        phase: 'discard',
        lastDiscard: null,
        claimOption: null,
        claimRound: null,
        claimPlayer: null,
        lastWinResult: winResult ?? null,
        lastHuFromPlayer: s.lastDiscard!.fromPlayer,
      };
      const settlement = computeSettlement(st);
      return { ...st, scores: settlement.newScores, lastSettlement: settlement };
    };

    const applyGang = (player: number): GameState => {
      const tile = s.lastDiscard!.tile;
      const hands = s.hands.map((h) => [...h]);
      const melds = s.melds.map((m) => [...m]);
      const gangRecords = [...(s.gangRecords ?? []), { type: 'mingang' as const, player, fromPlayer: s.lastDiscard!.fromPlayer }];
      for (let i = 0; i < 3; i++) {
        const idx = hands[player].indexOf(tile);
        hands[player].splice(idx, 1);
      }
      melds[player].push({ type: 'mingang', tiles: [tile, tile, tile, tile], fromPlayer: s.lastDiscard!.fromPlayer });
      const discardPiles = s.discardPiles.map((p, i) => (i === s.lastDiscard!.fromPlayer ? p.slice(0, -1) : p));
      const deck = [...s.deck];
      const 补牌 = deck.length > 0 ? deck.pop()! : null;
      if (补牌 !== null) {
        hands[player].push(补牌);
        hands[player].sort((a, b) => a - b);
        const win = checkWin(hands[player], melds[player]);
        const winResult: GameState['lastWinResult'] = win
          ? getWinFans(hands[player], melds[player], undefined, { isZiMo: true, isGangShang: true })
          : null;
        const st: GameState = {
          ...s,
          hands,
          melds,
          discardPiles,
          deck,
          gangRecords,
          currentPlayer: player,
          phase: 'discard',
          lastDiscard: null,
          claimOption: null,
          claimRound: null,
          claimPlayer: null,
          winner: win ? player : null,
          lastWinResult: winResult ?? s.lastWinResult,
          lastHuFromPlayer: win ? null : s.lastHuFromPlayer,
          lastDrawnTile: win ? null : (player === HUMAN_SEAT ? 补牌 : s.lastDrawnTile),
        };
        if (win) {
          const settlement = computeSettlement(st);
          return { ...st, scores: settlement.newScores, lastSettlement: settlement };
        }
        return clearClaim(st);
      }
      return clearClaim({
        ...s,
        hands,
        melds,
        discardPiles,
        deck,
        gangRecords,
        currentPlayer: player,
        phase: 'discard',
        lastDiscard: null,
        claimOption: null,
      });
    };

    const applyPeng = (player: number): GameState => {
      const tile = s.lastDiscard!.tile;
      const hands = s.hands.map((h) => [...h]);
      const melds = s.melds.map((m) => [...m]);
      const idx1 = hands[player].indexOf(tile);
      hands[player].splice(idx1, 1);
      const idx2 = hands[player].indexOf(tile);
      hands[player].splice(idx2, 1);
      melds[player].push({ type: 'peng', tiles: [tile, tile, tile], fromPlayer: s.lastDiscard!.fromPlayer });
      const discardPiles = s.discardPiles.map((p, i) => (i === s.lastDiscard!.fromPlayer ? p.slice(0, -1) : p));
      return clearClaim({
        ...s,
        hands,
        melds,
        discardPiles,
        currentPlayer: player,
        phase: 'discard',
        lastDiscard: null,
        claimOption: null,
      });
    };

    const applyChi = (player: number, option: [number, number]): GameState => {
      const [a, b] = option;
      const tile = s.lastDiscard!.tile;
      const hands = s.hands.map((h) => [...h]);
      const melds = s.melds.map((m) => [...m]);
      const seq = [a, b, tile].sort((x, y) => x - y);
      const ia = hands[player].indexOf(a);
      hands[player].splice(ia, 1);
      const ib = hands[player].indexOf(b);
      hands[player].splice(ib, 1);
      melds[player].push({ type: 'chi', tiles: seq, fromPlayer: s.lastDiscard!.fromPlayer });
      const discardPiles = s.discardPiles.map((p, i) => (i === s.lastDiscard!.fromPlayer ? p.slice(0, -1) : p));
      return clearClaim({
        ...s,
        hands,
        melds,
        discardPiles,
        currentPlayer: player,
        phase: 'discard',
        lastDiscard: null,
        claimOption: null,
      });
    };

    while (round !== null) {
      const player = order[round.index];

      if (round.phase === 'hu') {
        if (checkWin(s.hands[player], s.melds[player], s.lastDiscard.tile)) {
          if (player === HUMAN_SEAT) {
            return { ...s, claimRound: round, claimPlayer: player, claimOption: { hu: true } };
          }
          return applyHu(player);
        }
        round = advanceClaimRound(round);
        continue;
      }

      if (round.phase === 'gang') {
        if (canMingang(s.hands[player], s.lastDiscard.tile)) {
          if (player === HUMAN_SEAT) {
            return { ...s, claimRound: round, claimPlayer: player, claimOption: { gang: true } };
          }
          if (aiWantsGang(s.hands[player], s.melds[player], s, player)) return applyGang(player);
        }
        round = advanceClaimRound(round);
        continue;
      }

      if (round.phase === 'peng') {
        if (canPeng(s.hands[player], s.lastDiscard.tile)) {
          if (player === HUMAN_SEAT) {
            return { ...s, claimRound: round, claimPlayer: player, claimOption: { peng: true } };
          }
          if (aiWantsPeng(s.hands[player], s.melds[player], s.lastDiscard.tile, s, player)) return applyPeng(player);
        }
        round = advanceClaimRound(round);
        continue;
      }

      // 吃：仅下家
      if (round.phase === 'chi' && round.index === 0) {
        const opt = buildClaimOption(s.hands[下家], s.melds[下家], s.lastDiscard, 下家);
        if (opt?.chi && opt.chi.length > 0) {
          if (下家 === HUMAN_SEAT) {
            return { ...s, claimRound: round, claimPlayer: 下家, claimOption: { chi: opt.chi } };
          }
          const decision = aiChooseChi(s.hands[下家], s.melds[下家], opt.chi, s.lastDiscard.tile, s, 下家);
          if (decision.doChi && decision.option) return applyChi(下家, decision.option);
        }
        return applyPass();
      }

      round = advanceClaimRound(round);
    }

    return applyPass();
  }

  const runAiClaim = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== 'claim' || s.lastDiscard === null) return s;
      return processClaimRound(s);
    });
  }, []);

  /** 评估打某张牌后手牌的“搭子价值”：同牌数 + 同花色相邻牌数，越大越不想打 */
  function discardScore(hand: number[], excludeIndex: number): number {
    const t = hand[excludeIndex];
    let same = 0;
    let adjacent = 0;
    const suit = t < 9 ? 0 : t < 18 ? 1 : t < 27 ? 2 : -1; // 字牌无顺子
    for (let i = 0; i < hand.length; i++) {
      if (i === excludeIndex) continue;
      const u = hand[i];
      if (u === t) same++;
      if (suit >= 0 && u >= suit * 9 && u < suit * 9 + 9) {
        if (u === t - 1 || u === t + 1) adjacent++;
      }
    }
    return same + adjacent;
  }

  /**
   * 顶级策略舍牌：舍牌顺序 孤张字牌→幺九→中张；防守/听牌时只打熟张（牌池≥2）。
   * keepValue 越高越保留，选 keepValue 最小的打出。
   */
  function strategyKeepValue(
    hand: number[],
    countsSeen: number[],
    defenseMode: boolean,
    isTingPai: boolean,
    excludeIndex: number,
  ): number {
    const tile = hand[excludeIndex];
    const base = discardScore(hand, excludeIndex);
    let keep = base;
    const seen = countsSeen[tile] ?? 0;
    // 舍牌优先级：孤张字牌最想打 → 幺九孤张 → 中张
    if (isZiTile(tile)) {
      if (base <= 1) keep -= 3;
      else keep -= 1;
    } else if (isYaoJiu(tile) && base <= 1) {
      keep -= 2;
    }
    // 防守规则：生张（牌池<2）不主动打
    if (defenseMode && seen < 2) keep += 6;
    // 听牌后只打熟张
    if (isTingPai && seen < 2) keep += 4;
    return keep;
  }

  /** AI 出牌：顶级策略（记牌、舍牌顺序、防守、听牌只打熟张） */
  const runAiTurn = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== 'discard' || s.currentPlayer === HUMAN_SEAT || s.winner !== null) return s;
      const player = s.currentPlayer;
      const hand = s.hands[player];
      if (hand.length !== 14) return s;
      const countsSeen = getTileCountsSeen(s.discardPiles, s.melds);
      const kuaiHu = estimateKuaiHuValue(hand, s.melds[player]);
      const defenseMode =
        s.deck.length < 20 || player === s.dealer || kuaiHu > 6; // 残局/庄家/难胡时偏防守
      let isTingPai = false;
      for (let i = 0; i < hand.length; i++) {
        const rest = hand.filter((_, j) => j !== i);
        if (getWaitingTiles(rest, s.melds[player]).length > 0) {
          isTingPai = true;
          break;
        }
      }
      let idx = 0;
      let minKeep = strategyKeepValue(hand, countsSeen, defenseMode, isTingPai, 0);
      for (let i = 1; i < hand.length; i++) {
        const k = strategyKeepValue(hand, countsSeen, defenseMode, isTingPai, i);
        if (k < minKeep) {
          minKeep = k;
          idx = i;
        } else if (k === minKeep && Math.random() < 0.5) {
          idx = i;
        }
      }
      const tile = hand[idx];
      const hands = s.hands.map((h) => [...h]);
      hands[player] = hand.filter((_, i) => i !== idx).sort((a, b) => a - b);
      const discardPiles = s.discardPiles.map((p, i) => (i === player ? [...p, tile] : p));
      const lastDiscard: LastDiscard = { tile, fromPlayer: player };
      return {
        ...s,
        hands,
        discardPiles,
        lastDiscard,
        phase: 'claim',
        claimOption: null,
        claimPlayer: null,
        claimRound: { phase: 'hu', index: 0 },
      };
    });
  }, []);

  const needAiDiscard =
    state !== null &&
    state.phase === 'discard' &&
    state.currentPlayer !== HUMAN_SEAT &&
    state.winner === null &&
    state.hands[state.currentPlayer].length === 14;

  const needPassClaim =
    state !== null &&
    state.phase === 'claim' &&
    state.lastDiscard !== null &&
    state.claimOption === null;

  return {
    state,
    startGame,
    discard,
    passClaim,
    runAiClaim,
    doHu,
    doPeng,
    doGang,
    doChi,
    doJiagang,
    doAngang,
    doZiMo,
    runAiTurn,
    needAiDiscard,
    needPassClaim,
  };
}
