import { useCallback, useEffect, useState } from 'react';
import {
  calculateFanSichuan,
  calculateGangSettlement,
  canMingangSichuan,
  canPengSichuan,
  checkWinSichuan,
  getJiagangOptionsSichuan,
  getPlayerQueMenOptions,
  initSichuanGame,
  type SichuanGameState,
  type SuitType,
} from '@/lib/mahjongSichuan';

const HUMAN_SEAT = 0;
const SEAT_NAMES = ['自家', '下家', '对家', '上家'];

type ClaimOption = {
  hu?: boolean;
  gang?: boolean;
  peng?: boolean;
};

/** 川麻无吃牌，仅胡/杠/碰 */
function buildClaimOption(
  s: SichuanGameState,
  player: number,
): ClaimOption | null {
  if (
    s.phase !== 'claim' ||
    s.lastDiscard === null ||
    s.lastDiscardFrom === null
  )
    return null;
  const hand = s.hands[player];
  const melds = s.melds[player];
  const tile = s.lastDiscard;
  const queMen = s.queMen[player];
  const opt: ClaimOption = {};
  if (canPengSichuan(hand, tile)) opt.peng = true;
  if (canMingangSichuan(hand, tile)) opt.gang = true;
  const hu = checkWinSichuan(hand, melds, queMen, tile);
  if (hu) opt.hu = true;
  if (Object.keys(opt).length === 0) return null;
  return opt;
}

/** 川麻要牌轮次：胡 > 杠 > 碰，无吃 */
function advanceClaimRound(
  round: { phase: 'hu' | 'gang' | 'peng'; index: number },
  _fromPlayer: number,
): { phase: 'hu' | 'gang' | 'peng'; index: number } | null {
  if (round.phase === 'hu') {
    if (round.index + 1 < 3) return { phase: 'hu', index: round.index + 1 };
    return { phase: 'gang', index: 0 };
  }
  if (round.phase === 'gang') {
    if (round.index + 1 < 3) return { phase: 'gang', index: round.index + 1 };
    return { phase: 'peng', index: 0 };
  }
  if (round.phase === 'peng') {
    if (round.index + 1 < 3) return { phase: 'peng', index: round.index + 1 };
    return null; // 无人碰则下家摸牌
  }
  return null;
}

/** 计分：单局得分 = 基础分 × 最终番数（番数为乘算结果），加上杠分 */
function computeSettlement(
  s: SichuanGameState,
  winner: number,
  isZimo: boolean,
  fromPlayer?: number,
): { newScores: number[] } {
  const hand = s.hands[winner];
  const melds = s.melds[winner];
  const queMen = s.queMen[winner];
  const { fan } = calculateFanSichuan(hand, melds, isZimo, queMen);
  const baseScore = 1;
  const amount = baseScore * fan;
  const newScores = [...s.scores];
  if (isZimo) {
    for (let i = 0; i < 4; i++) {
      if (i !== winner) {
        newScores[i] -= amount;
        newScores[winner] += amount;
      }
    }
  } else if (fromPlayer !== undefined) {
    newScores[fromPlayer] -= amount;
    newScores[winner] += amount;
  }
  const gangScores = calculateGangSettlement(s.gangRecords, baseScore);
  for (let i = 0; i < 4; i++) {
    newScores[i] += gangScores[i];
  }
  return { newScores };
}

export function useSichuanMahjongGame() {
  const [state, setState] = useState<SichuanGameState | null>(null);

  const startGame = useCallback(() => {
    setState(initSichuanGame(0));
  }, []);

  const declareQueMen = useCallback((player: number, suit: SuitType) => {
    setState((s) => {
      if (!s || s.phase !== 'queMen' || s.isQueMenDeclared[player]) return s;
      const options = getPlayerQueMenOptions(s.hands[player]);
      if (!options.includes(suit)) return s;
      const queMen = [...s.queMen];
      const isQueMenDeclared = [...s.isQueMenDeclared];
      queMen[player] = suit;
      isQueMenDeclared[player] = true;
      const allDeclared = isQueMenDeclared.every(Boolean);
      return {
        ...s,
        queMen,
        isQueMenDeclared,
        phase: allDeclared ? 'discard' : 'queMen',
      };
    });
  }, []);

  const discard = useCallback((player: number, tileIndex: number) => {
    setState((s) => {
      if (
        !s ||
        s.phase !== 'discard' ||
        s.currentPlayer !== player ||
        s.isGameOver
      )
        return s;
      const hands = s.hands.map((h) => [...h]);
      const tile = hands[player][tileIndex];
      hands[player].splice(tileIndex, 1);
      hands[player].sort((a, b) => a - b);
      const discardPiles = s.discardPiles.map((p, i) =>
        i === player ? [...p, tile] : p,
      );
      const fromPlayer = player;
      const order: [number, number, number] = [
        (fromPlayer + 1) % 4,
        (fromPlayer + 2) % 4,
        (fromPlayer + 3) % 4,
      ];
      const firstClaimPlayer = order[0];
      const opt = buildClaimOption(
        {
          ...s,
          hands,
          discardPiles,
          lastDiscard: tile,
          lastDiscardFrom: fromPlayer,
        },
        firstClaimPlayer,
      );
      if (!opt) {
        const 下家 = (fromPlayer + 1) % 4;
        const deck = [...s.wall];
        if (deck.length === 0) {
          return {
            ...s,
            hands,
            discardPiles,
            lastDiscard: tile,
            lastDiscardFrom: fromPlayer,
            phase: 'gameOver',
            isGameOver: true,
          };
        }
        const drawn = deck.pop();
        if (drawn === undefined)
          return {
            ...s,
            hands,
            discardPiles,
            lastDiscard: tile,
            lastDiscardFrom: fromPlayer,
            phase: 'gameOver',
            isGameOver: true,
          };
        hands[下家].push(drawn);
        hands[下家].sort((a, b) => a - b);
        const queMen = s.queMen[下家];
        const win = checkWinSichuan(hands[下家], s.melds[下家], queMen);
        if (win) {
          const { newScores } = computeSettlement(
            { ...s, hands } as SichuanGameState,
            下家,
            true,
          );
          return {
            ...s,
            hands,
            discardPiles,
            wall: deck,
            currentPlayer: 下家,
            phase: 'gameOver',
            isGameOver: true,
            huPlayers: [...s.huPlayers, 下家],
            scores: newScores,
            lastDiscard: null,
            lastDiscardFrom: null,
          };
        }
        return {
          ...s,
          hands,
          discardPiles,
          wall: deck,
          currentPlayer: 下家,
          phase: 'discard',
          drawnTile: 下家 === HUMAN_SEAT ? drawn : null,
          lastDiscard: null,
          lastDiscardFrom: null,
        };
      }
      return {
        ...s,
        hands,
        discardPiles,
        drawnTile: null,
        lastDiscard: tile,
        lastDiscardFrom: fromPlayer,
        phase: 'claim',
        claimOption: opt,
        claimPlayer: firstClaimPlayer,
        claimRound: { phase: 'hu', index: 0 },
      };
    });
  }, []);

  const passClaim = useCallback(() => {
    setState((s) => {
      if (
        !s ||
        s.phase !== 'claim' ||
        s.lastDiscard === null ||
        s.lastDiscardFrom === null ||
        s.claimRound === null
      )
        return s;
      const fromPlayer = s.lastDiscardFrom;
      const 下家 = (fromPlayer + 1) % 4;
      const order: [number, number, number] = [
        (fromPlayer + 1) % 4,
        (fromPlayer + 2) % 4,
        (fromPlayer + 3) % 4,
      ];
      const nextRound = advanceClaimRound(s.claimRound, fromPlayer);
      if (nextRound === null) {
        const deck = [...s.wall];
        const hands = s.hands.map((h) => [...h]);
        if (deck.length === 0) {
          return {
            ...s,
            phase: 'gameOver',
            isGameOver: true,
            claimOption: null,
            claimPlayer: null,
            claimRound: null,
            lastDiscard: null,
            lastDiscardFrom: null,
          };
        }
        const drawn = deck.pop();
        if (drawn === undefined)
          return {
            ...s,
            phase: 'gameOver',
            isGameOver: true,
            claimOption: null,
            claimPlayer: null,
            claimRound: null,
            lastDiscard: null,
            lastDiscardFrom: null,
          };
        hands[下家].push(drawn);
        hands[下家].sort((a, b) => a - b);
        const queMen = s.queMen[下家];
        const win = checkWinSichuan(hands[下家], s.melds[下家], queMen);
        if (win) {
          const { newScores } = computeSettlement(
            { ...s, hands } as SichuanGameState,
            下家,
            true,
          );
          return {
            ...s,
            hands,
            wall: deck,
            currentPlayer: 下家,
            phase: 'gameOver',
            isGameOver: true,
            huPlayers: [...s.huPlayers, 下家],
            scores: newScores,
            claimOption: null,
            claimPlayer: null,
            claimRound: null,
            lastDiscard: null,
            lastDiscardFrom: null,
          };
        }
        return {
          ...s,
          hands,
          wall: deck,
          currentPlayer: 下家,
          phase: 'discard',
          drawnTile: 下家 === HUMAN_SEAT ? drawn : null,
          claimOption: null,
          claimPlayer: null,
          claimRound: null,
          lastDiscard: null,
          lastDiscardFrom: null,
        };
      }
      const player = order[nextRound.index];
      const opt = buildClaimOption(
        {
          ...s,
          lastDiscard: s.lastDiscard,
          lastDiscardFrom: s.lastDiscardFrom,
        } as SichuanGameState,
        player,
      );
      if (!opt) {
        const 下家 = (fromPlayer + 1) % 4;
        const deck = [...s.wall];
        const hands = s.hands.map((h) => [...h]);
        if (deck.length === 0) {
          return {
            ...s,
            phase: 'gameOver',
            isGameOver: true,
            claimOption: null,
            claimPlayer: null,
            claimRound: null,
            lastDiscard: null,
            lastDiscardFrom: null,
          };
        }
        const drawn = deck.pop();
        if (drawn === undefined)
          return {
            ...s,
            phase: 'gameOver',
            isGameOver: true,
            claimOption: null,
            claimPlayer: null,
            claimRound: null,
            lastDiscard: null,
            lastDiscardFrom: null,
          };
        hands[下家].push(drawn);
        hands[下家].sort((a, b) => a - b);
        const queMen = s.queMen[下家];
        const win = checkWinSichuan(hands[下家], s.melds[下家], queMen);
        if (win) {
          const { newScores } = computeSettlement(
            { ...s, hands } as SichuanGameState,
            下家,
            true,
          );
          return {
            ...s,
            hands,
            wall: deck,
            currentPlayer: 下家,
            phase: 'gameOver',
            isGameOver: true,
            huPlayers: [...s.huPlayers, 下家],
            scores: newScores,
            claimOption: null,
            claimPlayer: null,
            claimRound: null,
            lastDiscard: null,
            lastDiscardFrom: null,
          };
        }
        return {
          ...s,
          hands,
          wall: deck,
          currentPlayer: 下家,
          phase: 'discard',
          drawnTile: 下家 === HUMAN_SEAT ? drawn : null,
          claimOption: null,
          claimPlayer: null,
          claimRound: null,
          lastDiscard: null,
          lastDiscardFrom: null,
        };
      }
      return {
        ...s,
        claimRound: nextRound,
        claimOption: opt,
        claimPlayer: player,
      };
    });
  }, []);

  const doHu = useCallback(() => {
    setState((s) => {
      if (
        !s ||
        s.phase !== 'claim' ||
        !s.claimOption?.hu ||
        s.lastDiscard === null ||
        s.lastDiscardFrom === null ||
        s.claimPlayer !== HUMAN_SEAT
      )
        return s;
      const { newScores } = computeSettlement(
        s,
        HUMAN_SEAT,
        false,
        s.lastDiscardFrom,
      );
      return {
        ...s,
        phase: 'gameOver',
        isGameOver: true,
        huPlayers: [...s.huPlayers, HUMAN_SEAT],
        scores: newScores,
        claimOption: null,
        claimPlayer: null,
        claimRound: null,
        lastDiscard: null,
        lastDiscardFrom: null,
      };
    });
  }, []);

  const doPeng = useCallback(() => {
    setState((s) => {
      if (
        !s ||
        s.phase !== 'claim' ||
        !s.claimOption?.peng ||
        s.lastDiscard === null ||
        s.lastDiscardFrom === null ||
        s.claimPlayer !== HUMAN_SEAT
      )
        return s;
      const tile = s.lastDiscard;
      const hands = s.hands.map((h) => [...h]);
      const melds = s.melds.map((m) => [...m]);
      const idx1 = hands[HUMAN_SEAT].indexOf(tile);
      hands[HUMAN_SEAT].splice(idx1, 1);
      const idx2 = hands[HUMAN_SEAT].indexOf(tile);
      hands[HUMAN_SEAT].splice(idx2, 1);
      melds[HUMAN_SEAT].push({
        type: 'peng',
        tiles: [tile, tile, tile],
        fromPlayer: s.lastDiscardFrom,
      });
      const discardPiles = s.discardPiles.map((p, i) =>
        i === s.lastDiscardFrom ? p.slice(0, -1) : p,
      );
      return {
        ...s,
        hands,
        melds,
        discardPiles,
        currentPlayer: HUMAN_SEAT,
        phase: 'discard',
        claimOption: null,
        claimPlayer: null,
        claimRound: null,
        lastDiscard: null,
        lastDiscardFrom: null,
      };
    });
  }, []);

  const doGang = useCallback(() => {
    setState((s) => {
      if (
        !s ||
        s.phase !== 'claim' ||
        !s.claimOption?.gang ||
        s.lastDiscard === null ||
        s.lastDiscardFrom === null ||
        s.claimPlayer !== HUMAN_SEAT
      )
        return s;
      const tile = s.lastDiscard;
      const hands = s.hands.map((h) => [...h]);
      const melds = s.melds.map((m) => [...m]);
      const gangRecords = [
        ...s.gangRecords,
        {
          player: HUMAN_SEAT,
          type: 'mingGang' as const,
          tile,
          round: s.roundNumber,
        },
      ];
      for (let i = 0; i < 3; i++) {
        const idx = hands[HUMAN_SEAT].indexOf(tile);
        hands[HUMAN_SEAT].splice(idx, 1);
      }
      melds[HUMAN_SEAT].push({
        type: 'minggang',
        tiles: [tile, tile, tile, tile],
        fromPlayer: s.lastDiscardFrom,
      });
      const discardPiles = s.discardPiles.map((p, i) =>
        i === s.lastDiscardFrom ? p.slice(0, -1) : p,
      );
      const deck = [...s.wall];
      const 补牌 = deck.length > 0 ? (deck.pop() ?? null) : null;
      if (补牌 !== null) {
        hands[HUMAN_SEAT].push(补牌);
        hands[HUMAN_SEAT].sort((a, b) => a - b);
        const queMen = s.queMen[HUMAN_SEAT];
        const win = checkWinSichuan(
          hands[HUMAN_SEAT],
          melds[HUMAN_SEAT],
          queMen,
        );
        if (win) {
          const { newScores } = computeSettlement(
            { ...s, hands, melds, gangRecords } as SichuanGameState,
            HUMAN_SEAT,
            true,
          );
          return {
            ...s,
            hands,
            melds,
            wall: deck,
            discardPiles,
            gangRecords,
            phase: 'gameOver',
            isGameOver: true,
            huPlayers: [...s.huPlayers, HUMAN_SEAT],
            scores: newScores,
            claimOption: null,
            claimPlayer: null,
            claimRound: null,
            lastDiscard: null,
            lastDiscardFrom: null,
          };
        }
        return {
          ...s,
          hands,
          melds,
          wall: deck,
          discardPiles,
          gangRecords,
          currentPlayer: HUMAN_SEAT,
          phase: 'discard',
          drawnTile: 补牌,
          claimOption: null,
          claimPlayer: null,
          claimRound: null,
          lastDiscard: null,
          lastDiscardFrom: null,
        };
      }
      return {
        ...s,
        hands,
        melds,
        wall: deck,
        discardPiles,
        gangRecords,
        currentPlayer: HUMAN_SEAT,
        phase: 'discard',
        claimOption: null,
        claimPlayer: null,
        claimRound: null,
        lastDiscard: null,
        lastDiscardFrom: null,
      };
    });
  }, []);

  const doJiagang = useCallback((meldIndex: number) => {
    setState((s) => {
      if (
        !s ||
        s.phase !== 'discard' ||
        s.currentPlayer !== HUMAN_SEAT ||
        s.isGameOver
      )
        return s;
      const indices = getJiagangOptionsSichuan(
        s.hands[HUMAN_SEAT],
        s.melds[HUMAN_SEAT],
      );
      if (!indices.includes(meldIndex)) return s;
      const melds = s.melds.map((m) => [...m]);
      const m = melds[HUMAN_SEAT][meldIndex];
      if (m.type !== 'peng' || m.tiles.length !== 3) return s;
      const t = m.tiles[0];
      const gangRecords = [
        ...s.gangRecords,
        {
          player: HUMAN_SEAT,
          type: 'jiaGang' as const,
          tile: t,
          round: s.roundNumber,
          fromPlayer: m.fromPlayer,
        },
      ];
      const hands = s.hands.map((h) => [...h]);
      const idx = hands[HUMAN_SEAT].indexOf(t);
      if (idx === -1) return s;
      hands[HUMAN_SEAT].splice(idx, 1);
      const newPlayerMelds = [...melds[HUMAN_SEAT]];
      newPlayerMelds[meldIndex] = {
        type: 'jiagang',
        tiles: [t, t, t, t],
        fromPlayer: m.fromPlayer,
      };
      melds[HUMAN_SEAT] = newPlayerMelds;
      const deck = [...s.wall];
      const 补牌 = deck.length > 0 ? (deck.pop() ?? null) : null;
      if (补牌 !== null) {
        hands[HUMAN_SEAT].push(补牌);
        hands[HUMAN_SEAT].sort((a, b) => a - b);
        const queMen = s.queMen[HUMAN_SEAT];
        const win = checkWinSichuan(
          hands[HUMAN_SEAT],
          melds[HUMAN_SEAT],
          queMen,
        );
        if (win) {
          const { newScores } = computeSettlement(
            { ...s, hands, melds, gangRecords } as SichuanGameState,
            HUMAN_SEAT,
            true,
          );
          return {
            ...s,
            hands,
            melds,
            wall: deck,
            gangRecords,
            phase: 'gameOver',
            isGameOver: true,
            huPlayers: [...s.huPlayers, HUMAN_SEAT],
            scores: newScores,
            lastDiscard: null,
            lastDiscardFrom: null,
          };
        }
        return {
          ...s,
          hands,
          melds,
          wall: deck,
          gangRecords,
          currentPlayer: HUMAN_SEAT,
          phase: 'discard',
          drawnTile: 补牌,
          lastDiscard: null,
          lastDiscardFrom: null,
        };
      }
      return {
        ...s,
        hands,
        melds,
        wall: deck,
        gangRecords,
        currentPlayer: HUMAN_SEAT,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
      };
    });
  }, []);

  const doAngang = useCallback((tileType: number) => {
    setState((s) => {
      if (
        !s ||
        s.phase !== 'discard' ||
        s.currentPlayer !== HUMAN_SEAT ||
        s.isGameOver
      )
        return s;
      const hands = s.hands.map((h) => [...h]);
      const melds = s.melds.map((m) => [...m]);
      const gangRecords = [
        ...s.gangRecords,
        {
          player: HUMAN_SEAT,
          type: 'anGang' as const,
          tile: tileType,
          round: s.roundNumber,
        },
      ];
      for (let i = 0; i < 4; i++) {
        const idx = hands[HUMAN_SEAT].indexOf(tileType);
        hands[HUMAN_SEAT].splice(idx, 1);
      }
      melds[HUMAN_SEAT].push({
        type: 'angang',
        tiles: [tileType, tileType, tileType, tileType],
      });
      const deck = [...s.wall];
      const 补牌 = deck.length > 0 ? (deck.pop() ?? null) : null;
      if (补牌 !== null) {
        hands[HUMAN_SEAT].push(补牌);
        hands[HUMAN_SEAT].sort((a, b) => a - b);
        const queMen = s.queMen[HUMAN_SEAT];
        const win = checkWinSichuan(
          hands[HUMAN_SEAT],
          melds[HUMAN_SEAT],
          queMen,
        );
        if (win) {
          const { newScores } = computeSettlement(
            { ...s, hands, melds, gangRecords } as SichuanGameState,
            HUMAN_SEAT,
            true,
          );
          return {
            ...s,
            hands,
            melds,
            wall: deck,
            gangRecords,
            phase: 'gameOver',
            isGameOver: true,
            huPlayers: [...s.huPlayers, HUMAN_SEAT],
            scores: newScores,
            lastDiscard: null,
            lastDiscardFrom: null,
          };
        }
        return {
          ...s,
          hands,
          melds,
          wall: deck,
          gangRecords,
          currentPlayer: HUMAN_SEAT,
          phase: 'discard',
          drawnTile: 补牌,
          lastDiscard: null,
          lastDiscardFrom: null,
        };
      }
      return {
        ...s,
        hands,
        melds,
        wall: deck,
        gangRecords,
        currentPlayer: HUMAN_SEAT,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
      };
    });
  }, []);

  const doZiMo = useCallback(() => {
    setState((s) => {
      if (
        !s ||
        s.phase !== 'discard' ||
        s.currentPlayer !== HUMAN_SEAT ||
        s.isGameOver
      )
        return s;
      const hand = s.hands[HUMAN_SEAT];
      const melds = s.melds[HUMAN_SEAT];
      const queMen = s.queMen[HUMAN_SEAT];
      if (checkWinSichuan(hand, melds, queMen)) {
        const { newScores } = computeSettlement(s, HUMAN_SEAT, true);
        return {
          ...s,
          phase: 'gameOver',
          isGameOver: true,
          huPlayers: [...s.huPlayers, HUMAN_SEAT],
          scores: newScores,
          lastDiscard: null,
          lastDiscardFrom: null,
        };
      }
      return s;
    });
  }, []);

  const needAiDiscard =
    state?.phase === 'discard' &&
    state.currentPlayer !== HUMAN_SEAT &&
    !state.isGameOver;
  const needPassClaim =
    state?.phase === 'claim' &&
    state.claimPlayer !== null &&
    state.claimPlayer !== HUMAN_SEAT;

  const runAiTurn = useCallback(() => {
    if (!needAiDiscard || !state) return;
    const player = state.currentPlayer;
    const hand = state.hands[player];
    if (hand.length === 0) return;
    const idx = Math.floor(Math.random() * hand.length);
    discard(player, idx);
  }, [needAiDiscard, state, discard]);

  const runAiClaim = useCallback(() => {
    if (!needPassClaim || !state) return;
    passClaim();
  }, [needPassClaim, state, passClaim]);

  useEffect(() => {
    if (!needAiDiscard) return;
    const t = setTimeout(runAiTurn, 600);
    return () => clearTimeout(t);
  }, [needAiDiscard, runAiTurn]);

  useEffect(() => {
    if (!needPassClaim) return;
    const t = setTimeout(runAiClaim, 400);
    return () => clearTimeout(t);
  }, [needPassClaim, runAiClaim]);

  return {
    state,
    startGame,
    declareQueMen,
    discard,
    passClaim,
    doHu,
    doPeng,
    doGang,
    doJiagang,
    doAngang,
    doZiMo,
    SEAT_NAMES,
  };
}
