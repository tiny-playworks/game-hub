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
  type GameState,
  type Meld,
  type LastDiscard,
  type ClaimOption,
} from '@/lib/mahjong';

const HUMAN_SEAT = 0;

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
      const nextPlayer = (player + 1) % 4;
      const claimOption = nextPlayer === HUMAN_SEAT ? buildClaimOption(hands[HUMAN_SEAT], s.melds[HUMAN_SEAT], lastDiscard, HUMAN_SEAT) : null;
      return {
        ...s,
        hands,
        discardPiles,
        lastDiscard,
        phase: 'claim',
        claimOption: nextPlayer === HUMAN_SEAT ? claimOption : null,
        lastDrawnTile: player === HUMAN_SEAT ? null : s.lastDrawnTile,
      };
    });
  }, []);

  const passClaim = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== 'claim' || s.lastDiscard === null) return s;
      const nextPlayer = (s.lastDiscard.fromPlayer + 1) % 4;
      const deck = [...s.deck];
      const hands = s.hands.map((h) => [...h]);
      if (deck.length === 0) {
        const st: GameState = { ...s, isDraw: true, phase: 'discard', lastDiscard: null, claimOption: null };
        const settlement = computeSettlement(st);
        return { ...st, scores: settlement.newScores, lastSettlement: settlement };
      }
      const drawn = deck.pop()!;
      hands[nextPlayer].push(drawn);
      hands[nextPlayer].sort((a, b) => a - b);
      const win = checkWin(hands[nextPlayer], s.melds[nextPlayer]);
      const wasLastTile = deck.length === 0;
      const winResult: GameState['lastWinResult'] = win
        ? getWinFans(hands[nextPlayer], s.melds[nextPlayer], undefined, { isZiMo: true, isHaidilao: wasLastTile })
        : null;
      const lastDrawnTile = !win && nextPlayer === HUMAN_SEAT ? drawn : null;
      const st: GameState = {
        ...s,
        hands,
        deck,
        currentPlayer: nextPlayer,
        phase: 'discard',
        lastDiscard: null,
        claimOption: null,
        winner: win ? nextPlayer : null,
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

  /** AI 随机打出一张牌 */
  const runAiTurn = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== 'discard' || s.currentPlayer === HUMAN_SEAT || s.winner !== null) return s;
      const player = s.currentPlayer;
      const hand = s.hands[player];
      if (hand.length !== 14) return s;
      const idx = Math.floor(Math.random() * hand.length);
      const tile = hand[idx];
      const hands = s.hands.map((h) => [...h]);
      hands[player] = hand.filter((_, i) => i !== idx).sort((a, b) => a - b);
      const discardPiles = s.discardPiles.map((p, i) => (i === player ? [...p, tile] : p));
      const lastDiscard: LastDiscard = { tile, fromPlayer: player };
      const nextPlayer = (player + 1) % 4;
      const claimOption =
        nextPlayer === HUMAN_SEAT
          ? buildClaimOption(hands[HUMAN_SEAT], s.melds[HUMAN_SEAT], lastDiscard, HUMAN_SEAT)
          : null;
      return {
        ...s,
        hands,
        discardPiles,
        lastDiscard,
        phase: 'claim',
        claimOption,
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
