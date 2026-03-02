import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRiichiSounds } from '@/hooks/useRiichiSounds';
import {
  calcFu,
  calcScore,
  canMingangRiichi,
  canPengRiichi,
  computeYaku,
  countDoraInHand,
  getAngangOptionsRiichi,
  getBaseTile,
  getChiOptionsRiichi,
  getDoraFromIndicator,
  getTileLabel,
  getTotalHan,
  hasYaku,
  isWinShapeRiichi,
  type YakuResult,
} from '@/lib/mahjongRiichi';
import {
  canDeclareKyuushuKyuuhai,
  shouldAbortOnSuuchaRiichi,
  shouldAbortOnSuufonRenda,
  shouldAbortOnSuukaikan,
} from '@/lib/riichiAbortiveDraw';
import {
  applyAiRiichiState,
  canAiRonOnClaim,
  chooseAiClaimActionAgainstRiichi,
  chooseAiDefensiveDiscardWithMeta,
  shouldAiDeclareRiichi,
  shouldAiFoldClaimAgainstRiichi,
} from '@/lib/riichiAi';
import { canOfferRon, resolveClaimPass } from '@/lib/riichiClaimFlow';
import {
  consumeTimeBankSeconds,
  getTurnTotalSeconds,
  isTurnTimeout,
} from '@/lib/riichiClock';
import {
  applyRonDeclinedFuriten,
  createInitialFuritenState,
  isRonForbiddenByFuriten,
} from '@/lib/riichiFuriten';
import {
  type MatchEndReason,
  rankSeatsByScore,
  resolveRiichiMatchEnd,
} from '@/lib/riichiGameEnd';
import {
  buildRiichiInput,
  calcWithRiichiRs,
  type GameStateForRs,
} from '@/lib/riichiRsAdapter';
import {
  type PaymentDetail,
  settleRyuukyoku,
  settleWin,
} from '@/lib/riichiSettlement';
import {
  DEFAULT_SCORES,
  DEFAULT_TIME_BANKS,
  MAX_HISTORY,
  MAX_LOG,
  SEAT_NAMES,
} from './constants';
import {
  enrichWinResultWithUra,
  resolveWinBaseTen,
} from './gameLogic/winResult';
import { initRiichiGame } from './gameState';
import {
  canSeatRonByRules,
  clearSeatDoujunStates,
  countVisibleTilesByBase,
  formatPoints,
  getDecisionSeat,
  getMatchEndReasonText,
  getNextRound,
  getSeatWind,
  getTenpaiSeatsForDraw,
  needsTimedDecision,
  summarizeWinnerPayments,
} from './helpers';
import type { RiichiGameState, RiichiMeld } from './types';

export function useRiichiGame() {
  const sounds = useRiichiSounds();
  const [view, setView] = useState<'rules' | 'game'>('rules');
  const [matchLength, setMatchLength] = useState<'east' | 'south'>('east');
  const [game, setGame] = useState<RiichiGameState | null>(null);
  const [history, setHistory] = useState<RiichiGameState[]>([]);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [winResult, setWinResult] = useState<{
    winner: number;
    isTsumo: boolean;
    yaku: YakuResult[];
    fu?: number;
    han?: number;
    ten?: number;
    uraHan?: number;
    uraDoraIndicators?: number[];
  } | null>(null);
  const [showGuide, setShowGuide] = useState(true); // 新手引导状态
  const [declinedRonToken, setDeclinedRonToken] = useState<string | null>(null);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const [matchEnd, setMatchEnd] = useState<{
    reason: MatchEndReason;
    finalScores: number[];
    ranking: number[];
  } | null>(null);
  const prevGameRef = useRef<RiichiGameState | null>(null);
  const undoingRef = useRef(false);
  const addLogRef = useRef<(msg: string) => void>(() => {});
  const turnClockRef = useRef<{ player: number; startedAt: number } | null>(
    null,
  );
  const lowTimeWarnedTurnRef = useRef<string | null>(null);

  const addLog = useCallback((msg: string) => {
    const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
    setGameLog((l) => [...l, line].slice(-MAX_LOG));
  }, []);
  addLogRef.current = addLog;

  useEffect(() => {
    if (!game) {
      prevGameRef.current = null;
      return;
    }
    if (undoingRef.current) {
      undoingRef.current = false;
      prevGameRef.current = game;
      return;
    }
    if (prevGameRef.current != null) {
      try {
        setHistory((h) =>
          [...h, JSON.parse(JSON.stringify(prevGameRef.current))].slice(
            -MAX_HISTORY,
          ),
        );
      } catch {
        // skip clone if too large
      }
    }
    prevGameRef.current = game;
  }, [game]);

  useEffect(() => {
    const id = window.setInterval(() => setClockNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const getElapsedSecondsForSeat = useCallback((seat: number): number => {
    const c = turnClockRef.current;
    if (!c || c.player !== seat) return 0;
    return Math.max(0, (Date.now() - c.startedAt) / 1000);
  }, []);

  const consumeSeatTimeBank = useCallback(
    (state: RiichiGameState, seat: number): number[] => {
      const elapsed = getElapsedSecondsForSeat(seat);
      if (elapsed <= 0) return state.timeBanks;
      return state.timeBanks.map((tb, i) =>
        i === seat ? consumeTimeBankSeconds(tb, elapsed) : tb,
      );
    },
    [getElapsedSecondsForSeat],
  );

  useEffect(() => {
    if (!game || !needsTimedDecision(game)) {
      turnClockRef.current = null;
      return;
    }
    const decisionSeat = getDecisionSeat(game);
    const current = turnClockRef.current;
    if (!current || current.player !== decisionSeat) {
      turnClockRef.current = { player: decisionSeat, startedAt: Date.now() };
    }
  }, [
    game?.phase,
    game?.currentPlayer,
    game?.claimIndex,
    game?.lastDiscard,
    game?.lastDiscardFrom,
    game?.drawnTile,
    game?.hands?.[game?.currentPlayer ?? 0]?.length,
    game,
  ]);

  useEffect(() => {
    if (!game || !needsTimedDecision(game)) return;
    const player = getDecisionSeat(game);
    const c = turnClockRef.current;
    if (!c || c.player !== player) return;
    const elapsed = Math.max(0, (clockNowMs - c.startedAt) / 1000);
    if (!isTurnTimeout(game.timeBanks[player], elapsed)) return;
    setGame((g) => {
      if (!g || !needsTimedDecision(g) || getDecisionSeat(g) !== player)
        return g;
      const nextBanks = g.timeBanks.map((tb, i) =>
        i === player ? consumeTimeBankSeconds(tb, elapsed) : tb,
      );
      if (g.phase === 'claim' && g.lastDiscardFrom !== null) {
        const ronDeclined = canSeatRonByRules(g, player);
        const nextFuritenStates = ronDeclined
          ? g.furitenStates.map((s, i) =>
              i === player
                ? applyRonDeclinedFuriten(
                    s ?? createInitialFuritenState(),
                    g.riichiDeclared[player],
                  )
                : s,
            )
          : g.furitenStates;
        const passResult = resolveClaimPass(g.claimIndex, g.wall.length);
        if (passResult.type === 'next') {
          addLogRef.current(`${SEAT_NAMES[player]} 要牌超时，自动过`);
          turnClockRef.current = null;
          return {
            ...g,
            timeBanks: nextBanks,
            furitenStates: nextFuritenStates,
            claimIndex: passResult.nextClaimIndex,
            lastClaimMsg: `${SEAT_NAMES[player]} 超时自动过`,
          };
        }
        const nextPlayer = (g.lastDiscardFrom + 1) % 4;
        if (passResult.type === 'ryuukyoku') {
          addLogRef.current(`${SEAT_NAMES[player]} 要牌超时，自动过（流局）`);
          turnClockRef.current = null;
          return {
            ...g,
            timeBanks: nextBanks,
            furitenStates: nextFuritenStates,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: nextPlayer,
            lastClaimMsg: `${SEAT_NAMES[player]} 超时自动过`,
            ryuukyoku: true,
            ryuukyokuReason: '荒牌',
          };
        }
        const draw = g.wall[0];
        const newWall = g.wall.slice(1);
        const newHands = g.hands.map((h) => [...h]);
        newHands[nextPlayer].push(draw);
        newHands[nextPlayer].sort(
          (a, b) => getBaseTile(a) - getBaseTile(b) || a - b,
        );
        addLogRef.current(`${SEAT_NAMES[player]} 要牌超时，自动过`);
        turnClockRef.current = null;
        return {
          ...g,
          timeBanks: nextBanks,
          furitenStates: clearSeatDoujunStates(nextFuritenStates, nextPlayer),
          hands: newHands,
          wall: newWall,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: nextPlayer,
          drawnTile: draw,
          lastClaimMsg: `${SEAT_NAMES[player]} 超时自动过`,
        };
      }
      const toDiscard = g.drawnTile ?? g.hands[player][0];
      if (toDiscard === undefined) return g;
      const hand = [...g.hands[player]];
      const idx = hand.indexOf(toDiscard);
      if (idx < 0) return g;
      hand.splice(idx, 1);
      const piles = g.discardPiles.map((q) => [...q]);
      piles[player].push(toDiscard);
      const nextPlayer = (player + 1) % 4;
      addLogRef.current(
        `${SEAT_NAMES[player]} 超时，自动打出 ${getTileLabel(toDiscard)}`,
      );
      const timeoutEvent = `${SEAT_NAMES[player]} 超时自动打出 ${getTileLabel(toDiscard)}`;
      turnClockRef.current = null;
      const nextState: RiichiGameState = {
        ...g,
        timeoutEvents: [...g.timeoutEvents, timeoutEvent].slice(-20),
        timeBanks: nextBanks,
        hands: g.hands.map((h, i) => (i === player ? hand : h)),
        discardPiles: piles,
        currentPlayer: nextPlayer,
        drawnTile: null,
        phase: 'claim',
        lastDiscard: toDiscard,
        lastDiscardFrom: player,
        claimIndex: 0,
        lastClaimMsg: `${SEAT_NAMES[player]} 超时自动出牌`,
      };
      if (shouldAbortOnSuuchaRiichi(nextState.riichiDeclared)) {
        addLogRef.current('流局（四家立直）');
        return {
          ...nextState,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          ryuukyoku: true,
          ryuukyokuReason: '四家立直',
        };
      }
      if (shouldAbortOnSuufonRenda(nextState.discardPiles, nextState.melds)) {
        addLogRef.current('流局（四风连打）');
        return {
          ...nextState,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          ryuukyoku: true,
          ryuukyokuReason: '四风连打',
        };
      }
      return nextState;
    });
  }, [clockNowMs, game]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    undoingRef.current = true;
    setHistory((h) => h.slice(0, -1));
    setGame(prev);
    addLog('回退一步');
  }, [history.length, addLog, history[history.length - 1]]);

  const startGame = useCallback(() => {
    setHistory([]);
    setGameLog([]);
    setWinResult(null);
    setMatchEnd(null);
    setDeclinedRonToken(null);
    setGame(
      initRiichiGame(
        0,
        0,
        1,
        0,
        DEFAULT_SCORES,
        DEFAULT_TIME_BANKS,
        0,
        undefined,
        matchLength,
      ),
    );
    setView('game');
    addLog(matchLength === 'east' ? '东风场 新一局' : '南风场 新一局');
  }, [addLog, matchLength]);

  const discard = useCallback(
    (player: number, tile: number) => {
      if (!game || game.phase !== 'discard') return;
      const hands = game.hands.map((h) => [...h]);
      const piles = game.discardPiles.map((p) => [...p]);
      const idx = hands[player].indexOf(tile);
      if (idx === -1) return;
      hands[player].splice(idx, 1);
      piles[player].push(tile);
      addLog(`自家 打出 ${getTileLabel(tile)}`);
      if (player === 0) sounds.playDiscard();
      const nextTimeBanks = consumeSeatTimeBank(game, player);
      turnClockRef.current = null;
      const nextState: RiichiGameState = {
        ...game,
        timeBanks: nextTimeBanks,
        hands,
        discardPiles: piles,
        drawnTile: null,
        phase: 'claim',
        lastDiscard: tile,
        lastDiscardFrom: game.currentPlayer,
        claimIndex: 0,
        lastClaimMsg: null,
      };
      if (shouldAbortOnSuuchaRiichi(nextState.riichiDeclared)) {
        addLog('流局（四家立直）');
        sounds.playRyuukyoku();
        setGame({
          ...nextState,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          ryuukyoku: true,
          ryuukyokuReason: '四家立直',
        });
        return;
      }
      if (shouldAbortOnSuufonRenda(nextState.discardPiles, nextState.melds)) {
        addLog('流局（四风连打）');
        sounds.playRyuukyoku();
        setGame({
          ...nextState,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          ryuukyoku: true,
          ryuukyokuReason: '四风连打',
        });
        return;
      }
      setGame(nextState);
    },
    [game, addLog, sounds, consumeSeatTimeBank],
  );

  const passClaim = useCallback(() => {
    if (!game || game.phase !== 'claim' || game.lastDiscardFrom === null)
      return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const ronDeclined = canSeatRonByRules(game, 0);
    const nextFuritenStates = ronDeclined
      ? game.furitenStates.map((s, i) =>
          i === 0
            ? applyRonDeclinedFuriten(
                s ?? createInitialFuritenState(),
                game.riichiDeclared[0],
              )
            : s,
        )
      : game.furitenStates;
    const passResult = resolveClaimPass(game.claimIndex, game.wall.length);
    if (passResult.type === 'next') {
      addLog('自家 过');
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: nextFuritenStates,
        claimIndex: passResult.nextClaimIndex,
        lastClaimMsg: null,
      });
      return;
    }
    const nextPlayer = (game.lastDiscardFrom + 1) % 4;
    if (passResult.type === 'ryuukyoku') {
      addLog('流局（荒牌）');
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: nextFuritenStates,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: nextPlayer,
        lastClaimMsg: null,
        ryuukyoku: true,
        ryuukyokuReason: '荒牌',
      });
      return;
    }
    const draw = game.wall[0];
    const newWall = game.wall.slice(1);
    const newHands = game.hands.map((h) => [...h]);
    newHands[nextPlayer].push(draw);
    newHands[nextPlayer].sort(
      (a, b) => getBaseTile(a) - getBaseTile(b) || a - b,
    );
    setGame({
      ...game,
      timeBanks: timedBanks,
      hands: newHands,
      wall: newWall,
      furitenStates: clearSeatDoujunStates(nextFuritenStates, nextPlayer),
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      currentPlayer: nextPlayer,
      drawnTile: draw,
      lastClaimMsg: null,
    });
  }, [game, addLog, consumeSeatTimeBank]);

  const doChi = useCallback(
    (option: [number, number]) => {
      if (
        !game ||
        game.phase !== 'claim' ||
        game.lastDiscard === null ||
        game.lastDiscardFrom === null
      )
        return;
      const ronDeclined = canSeatRonByRules(game, 0);
      const timedBanks = consumeSeatTimeBank(game, 0);
      turnClockRef.current = null;
      const nextFuritenStates = ronDeclined
        ? game.furitenStates.map((s, i) =>
            i === 0
              ? applyRonDeclinedFuriten(
                  s ?? createInitialFuritenState(),
                  game.riichiDeclared[0],
                )
              : s,
          )
        : game.furitenStates;
      const [a, b] = option;
      const hands = game.hands.map((h) => [...h]);
      const melds = game.melds.map((m) => [...m]);
      const h0 = hands[0];
      const ia = h0.indexOf(a);
      const ib = h0.indexOf(b);
      if (ia === -1 || ib === -1) return;
      h0.splice(Math.max(ia, ib), 1);
      h0.splice(Math.min(ia, ib), 1);
      melds[0] = [
        ...melds[0],
        {
          type: 'chi' as const,
          tiles: [a, b, game.lastDiscard].sort(
            (x, y) => getBaseTile(x) - getBaseTile(y) || x - y,
          ),
          fromPlayer: game.lastDiscardFrom,
        },
      ];
      const piles = game.discardPiles.map((q) => [...q]);
      if (piles[game.lastDiscardFrom].length > 0)
        piles[game.lastDiscardFrom].pop();
      addLog(`自家 吃 ${getTileLabel(a)}${getTileLabel(b)}`);
      sounds.playChi();
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: nextFuritenStates,
        hands,
        melds,
        discardPiles: piles,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: 0,
        lastClaimMsg: null,
      });
    },
    [game, addLog, sounds, consumeSeatTimeBank],
  );

  const doPeng = useCallback(() => {
    if (!game || game.phase !== 'claim' || game.lastDiscard === null) return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const ronDeclined = canSeatRonByRules(game, 0);
    const nextFuritenStates = ronDeclined
      ? game.furitenStates.map((s, i) =>
          i === 0
            ? applyRonDeclinedFuriten(
                s ?? createInitialFuritenState(),
                game.riichiDeclared[0],
              )
            : s,
        )
      : game.furitenStates;
    const base = getBaseTile(game.lastDiscard);
    const h0 = [...game.hands[0]];
    const indices: number[] = [];
    for (let i = 0; i < h0.length && indices.length < 2; i++) {
      if (getBaseTile(h0[i]) === base) indices.push(i);
    }
    if (indices.length < 2) return;
    const tiles = [game.lastDiscard, h0[indices[0]], h0[indices[1]]];
    indices
      .sort((x, y) => y - x)
      .forEach((i) => {
        h0.splice(i, 1);
      });
    const hands = game.hands.map((h, i) => (i === 0 ? h0 : h));
    const melds = game.melds.map((m, i) =>
      i === 0 ? [...m, { type: 'peng' as const, tiles }] : m,
    );
    const piles = game.discardPiles.map((q) => [...q]);
    const from = game.lastDiscardFrom ?? 0;
    if (piles[from].length > 0) piles[from].pop();
    addLog('自家 碰');
    sounds.playPon();
    setGame({
      ...game,
      timeBanks: timedBanks,
      furitenStates: nextFuritenStates,
      hands,
      melds,
      discardPiles: piles,
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      currentPlayer: 0,
      lastClaimMsg: null,
    });
  }, [game, addLog, sounds, consumeSeatTimeBank]);

  /** 获取听牌信息（需传入 game 以取 roundWind/dealer） */
  const getWaitingTilesRiichi = useCallback(
    (
      hand: number[],
      melds: RiichiMeld[],
      gameState?: RiichiGameState | null,
      options?: { seat?: number; isTsumo?: boolean; treatAsRiichi?: boolean },
    ): number[] => {
      if (hand.length !== 13) return [];
      const seat = options?.seat ?? 0;
      const waiting: number[] = [];
      for (let t = 0; t < 34; t++) {
        const testHand = [...hand, t];
        if (isWinShapeRiichi(testHand, melds)) {
          const ctx = {
            hand: testHand,
            melds: melds.map((m) => ({ tiles: m.tiles })),
            isMenzhen: melds.every((m) => m.type === 'angang'),
            isTsumo: options?.isTsumo ?? true,
            isRiichi:
              options?.treatAsRiichi ??
              gameState?.riichiDeclared[seat] ??
              false,
            ippatsuPossible: false,
            seatWind: getSeatWind(
              gameState?.roundWind ?? 0,
              seat,
              gameState?.dealer ?? 0,
            ),
            roundWind: gameState?.roundWind ?? 0,
          };
          if (hasYaku(ctx)) {
            waiting.push(t);
          }
        }
      }
      return waiting;
    },
    [],
  );

  /** 立直宣告：门前清听牌时可宣告，扣除1000点棒 */
  const doRiichi = useCallback(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.riichiDeclared[0]
    )
      return;

    // 检查是否门前清
    const melds = game.melds[0];
    const isMenzen = melds.every((m) => m.type === 'angang');
    if (!isMenzen) return;

    // 检查是否听牌
    const waitingTiles = getWaitingTilesRiichi(game.hands[0], melds, game, {
      seat: 0,
      isTsumo: false,
      treatAsRiichi: true,
    });
    if (waitingTiles.length === 0) return;
    if (game.scores[0] < 1000) {
      addLog('点数不足 1000，不能立直');
      return;
    }

    addLog('自家 立直宣言！（-1000 点）');
    sounds.playRiichi();

    setGame({
      ...game,
      scores: game.scores.map((v, i) => (i === 0 ? v - 1000 : v)),
      riichiPot: game.riichiPot + 1000,
      riichiDeclared: game.riichiDeclared.map((declared, i) =>
        i === 0 ? true : declared,
      ),
      lastClaimMsg: '立直宣言！听牌固定，不能换牌',
    });
  }, [game, addLog, getWaitingTilesRiichi, sounds]);

  /** 听牌提示：可胡的牌（含形听无役）+ 剩余张数 + 番数/无役。13 张时当前听牌；14 张时各打牌选项的听牌。 */
  const tenpaiHint = useMemo(() => {
    if (!game || game.ryuukyoku) return null;
    const hand = game.hands[0];
    const melds = game.melds[0];
    const visibleCounts = countVisibleTilesByBase(game);
    const remaining = (baseTile: number) =>
      Math.max(0, 4 - (visibleCounts[baseTile] ?? 0));
    const doraTypes = [getDoraFromIndicator(game.doraIndicator)];

    /** 形听：能组成和牌形的所有待牌（含无役） */
    const getWaitingTilesShapeOnly = (
      hand13: number[],
      meldList: RiichiMeld[],
    ): number[] => {
      if (hand13.length !== 13) return [];
      const out: number[] = [];
      for (let t = 0; t < 34; t++) {
        if (isWinShapeRiichi([...hand13, t], meldList)) out.push(t);
      }
      return out;
    };

    const getHanForWaitingTile = (
      hand13: number[],
      baseTile: number,
    ): number => {
      const handWithWin = [...hand13, baseTile];
      const ctx = {
        hand: handWithWin,
        melds: melds.map((m) => ({ tiles: m.tiles })),
        meldsTyped: melds,
        isMenzhen: melds.every((m) => m.type === 'angang'),
        isTsumo: true,
        isRiichi: game.riichiDeclared[0],
        ippatsuPossible: false,
        seatWind: getSeatWind(game.roundWind, 0, game.dealer),
        roundWind: game.roundWind,
      };
      const yaku = computeYaku(ctx);
      const allTiles = [...handWithWin, ...melds.flatMap((m) => m.tiles)];
      const doraHan = countDoraInHand(allTiles, doraTypes, true);
      return getTotalHan(yaku) + doraHan;
    };

    const formatWait = (hand13: number[], baseTile: number): string => {
      const han = getHanForWaitingTile(hand13, baseTile);
      const hanStr = han > 0 ? `${han}番` : '无役';
      return `${getTileLabel(baseTile)}(剩${remaining(baseTile)}, ${hanStr})`;
    };

    if (hand.length === 13) {
      const waitingShape = getWaitingTilesShapeOnly(hand, melds);
      if (waitingShape.length === 0) return null;
      const uniqueBase = [...new Set(waitingShape.map(getBaseTile))];
      return {
        kind: 'current' as const,
        line: `听牌：${uniqueBase.map((b) => formatWait(hand, b)).join(' ')}`,
        waiting: uniqueBase,
        remaining,
      };
    }
    if (hand.length === 14) {
      const options: {
        discardTile: number;
        discardLabel: string;
        waiting: number[];
        line: string;
      }[] = [];
      for (let i = 0; i < hand.length; i++) {
        const handWithout = hand.filter((_, j) => j !== i);
        const waitingShape = getWaitingTilesShapeOnly(handWithout, melds);
        if (waitingShape.length === 0) continue;
        const uniqueBase = [...new Set(waitingShape.map(getBaseTile))];
        options.push({
          discardTile: hand[i],
          discardLabel: getTileLabel(hand[i]),
          waiting: uniqueBase,
          line: `打 ${getTileLabel(hand[i])} 听 ${uniqueBase.map((b) => formatWait(handWithout, b)).join(' ')}`,
        });
      }
      if (options.length === 0) return null;
      return { kind: 'choices' as const, options, remaining };
    }
    return null;
  }, [game]);

  const doKyuushuKyuuhai = useCallback(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.hands[0].length !== 14
    )
      return;
    const isFirstTurnSelf = game.discardPiles[0].length === 0;
    if (!isFirstTurnSelf) return;
    if (!canDeclareKyuushuKyuuhai(game.hands[0])) return;
    addLog('自家 九种九牌，途中流局');
    sounds.playRyuukyoku();
    setGame({
      ...game,
      ryuukyoku: true,
      ryuukyokuReason: '九种九牌',
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      lastClaimMsg: null,
    });
  }, [game, addLog, sounds]);

  const doMingang = useCallback(() => {
    if (
      !game ||
      game.phase !== 'claim' ||
      game.lastDiscard === null ||
      game.wall.length === 0
    )
      return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const ronDeclined = canSeatRonByRules(game, 0);
    const nextFuritenStates = ronDeclined
      ? game.furitenStates.map((s, i) =>
          i === 0
            ? applyRonDeclinedFuriten(
                s ?? createInitialFuritenState(),
                game.riichiDeclared[0],
              )
            : s,
        )
      : game.furitenStates;
    const base = getBaseTile(game.lastDiscard);
    const h0 = [...game.hands[0]];
    const indices: number[] = [];
    for (let i = 0; i < h0.length && indices.length < 3; i++) {
      if (getBaseTile(h0[i]) === base) indices.push(i);
    }
    if (indices.length < 3) return;
    const tiles = [game.lastDiscard, ...indices.map((i) => h0[i])];
    indices
      .sort((x, y) => y - x)
      .forEach((i) => {
        h0.splice(i, 1);
      });
    const handAfterKan = [...h0];
    const rinshan = game.wall[0];
    const newWall = game.wall.slice(1);
    h0.push(rinshan);
    h0.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
    const hands = game.hands.map((h, i) => (i === 0 ? h0 : h));
    const melds = game.melds.map((m, i) =>
      i === 0 ? [...m, { type: 'mingang' as const, tiles }] : m,
    );
    const piles = game.discardPiles.map((q) => [...q]);
    const from = game.lastDiscardFrom ?? 0;
    if (piles[from].length > 0) piles[from].pop();
    addLog(`自家 明杠 ${getTileLabel(game.lastDiscard)}`);
    sounds.playKan();
    if (shouldAbortOnSuukaikan(melds)) {
      addLog('流局（四开杠）');
      sounds.playRyuukyoku();
      setGame({
        ...game,
        timeBanks: timedBanks,
        furitenStates: clearSeatDoujunStates(nextFuritenStates, 0),
        hands: game.hands.map((h, i) => (i === 0 ? handAfterKan : h)),
        melds,
        discardPiles: piles,
        wall: game.wall,
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: 0,
        drawnTile: null,
        lastClaimMsg: null,
        ryuukyoku: true,
        ryuukyokuReason: '四开杠',
      });
      return;
    }
    setGame({
      ...game,
      timeBanks: timedBanks,
      furitenStates: clearSeatDoujunStates(nextFuritenStates, 0),
      hands,
      melds,
      discardPiles: piles,
      wall: newWall,
      phase: 'discard',
      lastDiscard: null,
      lastDiscardFrom: null,
      claimIndex: 0,
      currentPlayer: 0,
      drawnTile: rinshan,
      lastClaimMsg: null,
    });
  }, [game, addLog, sounds, consumeSeatTimeBank]);

  /** 暗杠：从手牌移除 4 张，加暗杠面子，摸岭上 1 张（暗杠不算副露） */
  const doAngang = useCallback(
    (fourTiles: number[]) => {
      if (
        !game ||
        game.phase !== 'discard' ||
        game.currentPlayer !== 0 ||
        game.wall.length === 0
      )
        return;
      const h0 = [...game.hands[0]];
      for (const t of fourTiles) {
        const i = h0.indexOf(t);
        if (i === -1) return;
        h0.splice(i, 1);
      }
      if (h0.length !== 10) return;
      const handAfterKan = [...h0];
      const rinshan = game.wall[0];
      const newWall = game.wall.slice(1);
      h0.push(rinshan);
      h0.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
      const melds = game.melds.map((m, i) =>
        i === 0 ? [...m, { type: 'angang' as const, tiles: fourTiles }] : m,
      );
      if (shouldAbortOnSuukaikan(melds)) {
        addLog('流局（四开杠）');
        sounds.playRyuukyoku();
        setGame({
          ...game,
          hands: game.hands.map((h, i) => (i === 0 ? handAfterKan : h)),
          melds,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: 0,
          drawnTile: null,
          lastClaimMsg: null,
          ryuukyoku: true,
          ryuukyokuReason: '四开杠',
        });
        return;
      }
      sounds.playKan();
      setGame({
        ...game,
        hands: game.hands.map((h, i) => (i === 0 ? h0 : h)),
        melds,
        wall: newWall,
        furitenStates: clearSeatDoujunStates(game.furitenStates, 0),
      });
    },
    [game, addLog, sounds],
  );

  const angangOptions =
    game?.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === 14
      ? getAngangOptionsRiichi(game.hands[0])
      : [];
  const canKyuushuKyuuhai =
    game?.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === 14 &&
    game.discardPiles[0].length === 0 &&
    canDeclareKyuushuKyuuhai(game.hands[0]);

  // 荒牌流局：自家待摸牌但牌墙已空
  useEffect(() => {
    if (
      !game ||
      game.ryuukyoku ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.drawnTile !== null ||
      game.wall.length !== 0 ||
      game.hands[0].length !== 13
    )
      return;
    addLog('流局（荒牌）');
    sounds.playRyuukyoku();
    setGame((g) =>
      !g ? g : { ...g, ryuukyoku: true, ryuukyokuReason: '荒牌' },
    );
  }, [
    game?.phase,
    game?.currentPlayer,
    game?.drawnTile,
    game?.wall?.length,
    game?.hands?.[0]?.length,
    game?.ryuukyoku,
    game,
    addLog,
    sounds,
  ]);

  // 自家回合且手牌 13 张时先摸牌（庄家第一巡除外）；仅在出牌阶段
  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer !== 0 ||
      game.drawnTile !== null ||
      game.wall.length === 0 ||
      game.hands[0].length !== 13
    )
      return;
    sounds.playDraw();
    const draw = game.wall[0];
    const newWall = game.wall.slice(1);
    const newHands = game.hands.map((h) => [...h]);
    newHands[0].push(draw);
    newHands[0].sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
    setGame((g) =>
      !g
        ? g
        : {
            ...g,
            hands: newHands,
            wall: newWall,
            drawnTile: draw,
            furitenStates: clearSeatDoujunStates(g.furitenStates, 0),
          },
    );
  }, [
    game?.currentPlayer,
    game?.drawnTile,
    game?.wall.length,
    game?.hands[0]?.length,
    game,
    sounds,
  ]);

  // AI 回合 1：未摸牌时先摸牌（与出牌拆开）；仅出牌阶段；碰/吃/杠后手牌已 11 张不再摸
  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile !== null ||
      game.wall.length === 0 ||
      game.hands[game.currentPlayer].length !== 13
    )
      return;
    const p = game.currentPlayer;
    const draw = game.wall[0];
    const newWall = game.wall.slice(1);
    const newHands = game.hands.map((h) => [...h]);
    newHands[p].push(draw);
    newHands[p].sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
    setGame((g) =>
      !g
        ? g
        : {
            ...g,
            hands: newHands,
            wall: newWall,
            drawnTile: draw,
            furitenStates: clearSeatDoujunStates(g.furitenStates, p),
          },
    );
  }, [game?.currentPlayer, game?.drawnTile, game?.wall.length, game]);

  // AI 碰/吃/杠后：手牌 11 张，直接打出一张（不摸牌），并进入要牌阶段（立即更新，避免 setTimeout 被清理或竞态）
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile !== null ||
      game.hands[game.currentPlayer].length !== 11
    )
      return;
    const p = game.currentPlayer;
    setGame((g) => {
      if (
        !g ||
        g.phase !== 'discard' ||
        g.currentPlayer !== p ||
        g.drawnTile !== null
      )
        return g;
      const hp = g.hands[p];
      if (hp.length !== 11) return g;
      const hand = [...hp];
      const toDiscard = hand[0];
      hand.shift();
      const piles = g.discardPiles.map((q) => [...q]);
      piles[p].push(toDiscard);
      const elapsed = getElapsedSecondsForSeat(p);
      const nextTimeBanks = g.timeBanks.map((tb, i) =>
        i === p ? consumeTimeBankSeconds(tb, elapsed) : tb,
      );
      turnClockRef.current = null;
      return {
        ...g,
        timeBanks: nextTimeBanks,
        hands: g.hands.map((h, i) => (i === p ? hand : h)),
        discardPiles: piles,
        phase: 'claim',
        lastDiscard: toDiscard,
        lastDiscardFrom: p,
        claimIndex: 0,
        currentPlayer: (p + 1) % 4,
        lastClaimMsg: null,
      };
    });
  }, [
    game?.phase,
    game?.currentPlayer,
    game?.drawnTile,
    game?.hands,
    game,
    getElapsedSecondsForSeat,
  ]);

  // AI 回合 2：已摸牌则 500ms 后出牌（独立 effect）；仅出牌阶段
  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'discard' ||
      game.currentPlayer === 0 ||
      game.drawnTile === null
    )
      return;
    const p = game.currentPlayer;
    const tid = setTimeout(() => {
      setGame((g) => {
        if (!g || g.currentPlayer !== p || g.drawnTile === null) return g;
        const hand = [...g.hands[p]];
        const tsumoCtx = buildYakuCtx(p, hand, true);
        if (
          isWinShapeRiichi(hand, g.melds[p]) &&
          tsumoCtx &&
          hasYaku(tsumoCtx)
        ) {
          const yaku = computeYaku(tsumoCtx);
          const han = getTotalHan(yaku);
          const fu = calcFu({
            isTsumo: true,
            isMenzhen: g.melds[p].every((m) => m.type === 'angang'),
            hasPinfu: yaku.some((y) => y.id === 'pinfu'),
            isChiitoitsu: yaku.some((y) => y.id === 'chiitoitsu'),
          });
          addLogRef.current(`${SEAT_NAMES[p]} 自摸！`);
          sounds.playTsumo();
          const ten = calcScore(fu, han, g.dealer === p, true);
          const enriched = enrichWinResultWithUra({
            state: g,
            winner: p,
            isTsumo: true,
            handWithWin: hand,
            yaku,
            han,
            fu,
            ten,
          });
          setWinResult({
            winner: p,
            isTsumo: true,
            yaku: enriched.yaku,
            han: enriched.han,
            fu: enriched.fu,
            ten: enriched.ten,
            uraHan: enriched.uraHan,
            uraDoraIndicators: enriched.uraDoraIndicators,
          });
          return g;
        }

        const doAiRiichi = shouldAiDeclareRiichi({
          alreadyRiichi: g.riichiDeclared[p],
          isMenzen: g.melds[p].every((m) => m.type === 'angang'),
          score: g.scores[p],
          waitingCount: getWaitingTilesRiichi(hand, g.melds[p], g, {
            seat: p,
            isTsumo: false,
            treatAsRiichi: true,
          }).length,
          random: Math.random(),
        });

        const angOpts = getAngangOptionsRiichi(hand);
        if (angOpts.length > 0 && g.wall.length > 0 && Math.random() < 0.2) {
          const fourTiles = [...angOpts[0]];
          const consumed = [...fourTiles];
          const h = hand.filter((t) => {
            const i = consumed.indexOf(t);
            if (i >= 0) {
              consumed.splice(i, 1);
              return false;
            }
            return true;
          });
          if (h.length !== 10) return g;
          const rinshan = g.wall[0];
          h.push(rinshan);
          h.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
          const aiRiichiLocked = g.riichiDeclared[p];
          const defensiveChoice = !aiRiichiLocked
            ? chooseAiDefensiveDiscardWithMeta({
                hand: h,
                aiSeat: p,
                riichiDeclared: g.riichiDeclared,
                discardPiles: g.discardPiles,
                doraIndicators: [g.doraIndicator],
              })
            : null;
          const defensiveDiscard = defensiveChoice?.tile ?? null;
          const toDiscard = aiRiichiLocked
            ? rinshan
            : (defensiveDiscard ?? rinshan);
          const idx = h.indexOf(toDiscard);
          if (idx === -1) return g;
          h.splice(idx, 1);
          const melds = g.melds.map((m, i) =>
            i === p ? [...m, { type: 'angang' as const, tiles: fourTiles }] : m,
          );
          const piles = g.discardPiles.map((q) => [...q]);
          piles[p].push(toDiscard);
          if (
            !aiRiichiLocked &&
            defensiveChoice &&
            defensiveChoice.tile !== null &&
            defensiveChoice.reason
          ) {
            addLogRef.current(`${SEAT_NAMES[p]} ${defensiveChoice.reason}`);
          }
          if (doAiRiichi) {
            addLogRef.current(`${SEAT_NAMES[p]} 立直宣言！（-1000 点）`);
            sounds.playRiichi();
          }
          const elapsed = getElapsedSecondsForSeat(p);
          const timedBanks = g.timeBanks.map((tb, i) =>
            i === p ? consumeTimeBankSeconds(tb, elapsed) : tb,
          );
          turnClockRef.current = null;
          const nextRiichi = doAiRiichi
            ? applyAiRiichiState(g.scores, g.riichiDeclared, g.riichiPot, p)
            : null;
          const nextState: RiichiGameState = {
            ...g,
            timeBanks: timedBanks,
            scores: nextRiichi?.scores ?? g.scores,
            riichiPot: nextRiichi?.riichiPot ?? g.riichiPot,
            riichiDeclared: nextRiichi?.riichiDeclared ?? g.riichiDeclared,
            hands: g.hands.map((h0, i) => (i === p ? h : h0)),
            melds,
            wall: g.wall.slice(1),
            discardPiles: piles,
            currentPlayer: (p + 1) % 4,
            drawnTile: null,
            phase: 'claim',
            lastDiscard: toDiscard,
            lastDiscardFrom: p,
            claimIndex: 0,
            lastClaimMsg: doAiRiichi
              ? `${SEAT_NAMES[p]} 立直宣言！（-1000 点）`
              : null,
          };
          if (shouldAbortOnSuukaikan(nextState.melds)) {
            addLogRef.current('流局（四开杠）');
            sounds.playRyuukyoku();
            return {
              ...nextState,
              phase: 'discard',
              lastDiscard: null,
              lastDiscardFrom: null,
              claimIndex: 0,
              ryuukyoku: true,
              ryuukyokuReason: '四开杠',
            };
          }
          if (shouldAbortOnSuuchaRiichi(nextState.riichiDeclared)) {
            addLogRef.current('流局（四家立直）');
            sounds.playRyuukyoku();
            return {
              ...nextState,
              phase: 'discard',
              lastDiscard: null,
              lastDiscardFrom: null,
              claimIndex: 0,
              ryuukyoku: true,
              ryuukyokuReason: '四家立直',
            };
          }
          if (
            shouldAbortOnSuufonRenda(nextState.discardPiles, nextState.melds)
          ) {
            addLogRef.current('流局（四风连打）');
            sounds.playRyuukyoku();
            return {
              ...nextState,
              phase: 'discard',
              lastDiscard: null,
              lastDiscardFrom: null,
              claimIndex: 0,
              ryuukyoku: true,
              ryuukyokuReason: '四风连打',
            };
          }
          return nextState;
        }
        const aiRiichiLocked = g.riichiDeclared[p];
        const defensiveChoice = !aiRiichiLocked
          ? chooseAiDefensiveDiscardWithMeta({
              hand,
              aiSeat: p,
              riichiDeclared: g.riichiDeclared,
              discardPiles: g.discardPiles,
              doraIndicators: [g.doraIndicator],
            })
          : null;
        const defensiveDiscard = defensiveChoice?.tile ?? null;
        const toDiscard = aiRiichiLocked
          ? g.drawnTile
          : (defensiveDiscard ?? g.drawnTile);
        const idx = hand.indexOf(toDiscard);
        if (idx === -1) return g;
        hand.splice(idx, 1);
        const piles = g.discardPiles.map((q) => [...q]);
        piles[p].push(toDiscard);
        const next = (p + 1) % 4;
        if (
          !aiRiichiLocked &&
          defensiveChoice &&
          defensiveChoice.tile !== null &&
          defensiveChoice.reason
        ) {
          addLogRef.current(`${SEAT_NAMES[p]} ${defensiveChoice.reason}`);
        }
        if (doAiRiichi) {
          addLogRef.current(`${SEAT_NAMES[p]} 立直宣言！（-1000 点）`);
          sounds.playRiichi();
        }
        const elapsed = getElapsedSecondsForSeat(p);
        const timedBanks = g.timeBanks.map((tb, i) =>
          i === p ? consumeTimeBankSeconds(tb, elapsed) : tb,
        );
        turnClockRef.current = null;
        const nextRiichi = doAiRiichi
          ? applyAiRiichiState(g.scores, g.riichiDeclared, g.riichiPot, p)
          : null;
        const nextState: RiichiGameState = {
          ...g,
          timeBanks: timedBanks,
          scores: nextRiichi?.scores ?? g.scores,
          riichiPot: nextRiichi?.riichiPot ?? g.riichiPot,
          riichiDeclared: nextRiichi?.riichiDeclared ?? g.riichiDeclared,
          hands: g.hands.map((h, i) => (i === p ? hand : h)),
          discardPiles: piles,
          currentPlayer: next,
          drawnTile: null,
          phase: 'claim',
          lastDiscard: toDiscard,
          lastDiscardFrom: p,
          claimIndex: 0,
          lastClaimMsg: doAiRiichi
            ? `${SEAT_NAMES[p]} 立直宣言！（-1000 点）`
            : null,
        };
        if (shouldAbortOnSuuchaRiichi(nextState.riichiDeclared)) {
          addLogRef.current('流局（四家立直）');
          sounds.playRyuukyoku();
          return {
            ...nextState,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            ryuukyoku: true,
            ryuukyokuReason: '四家立直',
          };
        }
        if (shouldAbortOnSuufonRenda(nextState.discardPiles, nextState.melds)) {
          addLogRef.current('流局（四风连打）');
          sounds.playRyuukyoku();
          return {
            ...nextState,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            ryuukyoku: true,
            ryuukyokuReason: '四风连打',
          };
        }
        return nextState;
      });
    }, 500);
    return () => clearTimeout(tid);
  }, [game?.currentPlayer, game?.drawnTile, game]);

  const isMyTurn =
    game?.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.wall.length >= 0;
  const isClaimPhase = game?.phase === 'claim' && game.lastDiscard !== null;
  const claimPlayer =
    game?.phase === 'claim' && game.lastDiscardFrom !== null
      ? (game.lastDiscardFrom + 1 + game.claimIndex) % 4
      : null;
  const isMyClaim = isClaimPhase && claimPlayer === 0;
  const currentClaimToken =
    game &&
    isClaimPhase &&
    game.lastDiscardFrom !== null &&
    game.lastDiscard !== null
      ? `${game.roundWind}:${game.roundNumber}:${game.honba}:${game.wall.length}:${game.lastDiscardFrom}:${game.lastDiscard}:${game.discardPiles[game.lastDiscardFrom]?.length ?? 0}`
      : null;
  /** 立直后禁止吃/碰/明杠（技能：立直约束） */
  const riichiNoClaim = game?.riichiDeclared[0] ?? false;
  const chiOptions =
    game &&
    isMyClaim &&
    !riichiNoClaim &&
    game.lastDiscard !== null &&
    game.lastDiscardFrom !== null
      ? getChiOptionsRiichi(
          game.hands[0],
          game.lastDiscard,
          game.lastDiscardFrom,
          0,
        )
      : [];
  const canPeng =
    game &&
    isMyClaim &&
    !riichiNoClaim &&
    game.lastDiscard !== null &&
    canPengRiichi(game.hands[0], game.lastDiscard);
  const canMingang =
    game &&
    isMyClaim &&
    !riichiNoClaim &&
    game.lastDiscard !== null &&
    canMingangRiichi(game.hands[0], game.lastDiscard);

  /** 构建役判定上下文（自家）；立直/一发按当前局状态传入 */
  const buildYakuCtx = useCallback(
    (seat: number, hand: number[], isTsumo: boolean) => {
      if (!game) return null;
      const melds = game.melds[seat];
      const menzen = melds.every((m) => m.type === 'angang');
      return {
        hand,
        melds: melds.map((m) => ({ tiles: m.tiles })),
        meldsTyped: melds,
        isMenzhen: menzen,
        isTsumo,
        isRiichi: game.riichiDeclared[seat],
        ippatsuPossible: false, // 一发需立直后一巡内和了，可后续按巡数细化
        seatWind: getSeatWind(game.roundWind, seat, game.dealer),
        roundWind: game.roundWind,
      };
    },
    [game],
  );

  const getRonWaitingTilesForSeat = useCallback(
    (seat: number, state: RiichiGameState): number[] =>
      getWaitingTilesRiichi(state.hands[seat], state.melds[seat], state, {
        seat,
        isTsumo: false,
      }),
    [getWaitingTilesRiichi],
  );

  const isSeatFuriten = useCallback(
    (seat: number, state: RiichiGameState): boolean =>
      isRonForbiddenByFuriten({
        waitingTiles: getRonWaitingTilesForSeat(seat, state),
        ownDiscards: state.discardPiles[seat],
        state: state.furitenStates[seat] ?? createInitialFuritenState(),
      }),
    [getRonWaitingTilesForSeat],
  );

  const markSeatRonDeclined = useCallback((seat: number) => {
    setGame((g) => {
      if (!g) return g;
      const furitenStates = g.furitenStates.map((s, i) =>
        i === seat
          ? applyRonDeclinedFuriten(
              s ?? createInitialFuritenState(),
              g.riichiDeclared[seat],
            )
          : s,
      );
      return { ...g, furitenStates };
    });
  }, []);

  const canTsumo =
    game &&
    game.phase === 'discard' &&
    game.currentPlayer === 0 &&
    game.hands[0].length === 14 &&
    isWinShapeRiichi(game.hands[0], game.melds[0]) &&
    (() => {
      const ctx = buildYakuCtx(0, game.hands[0], true);
      return ctx ? hasYaku(ctx) : false;
    })();

  const canRon =
    game &&
    (() => {
      const lastD = game.lastDiscard;
      if (lastD === null) return false;
      const handWithClaim = [...game.hands[0], lastD];
      const winShape = isWinShapeRiichi(handWithClaim, game.melds[0]);
      const ctx = buildYakuCtx(0, handWithClaim, false);
      const yakuReady = ctx ? hasYaku(ctx) : false;
      const furitenBlocked = isSeatFuriten(0, game);
      return canOfferRon({
        phase: game.phase,
        lastDiscard: game.lastDiscard,
        lastDiscardFrom: game.lastDiscardFrom,
        currentClaimToken,
        declinedRonToken,
        isWinShape: winShape,
        hasYaku: yakuReady && !furitenBlocked,
      });
    })();

  const hasNonRonClaimOption = chiOptions.length > 0 || canPeng || canMingang;
  const hasAnyClaimOption = hasNonRonClaimOption || canRon;
  const decisionSeat =
    game && needsTimedDecision(game) ? getDecisionSeat(game) : null;
  const decisionSeatRemainSeconds =
    game && decisionSeat !== null
      ? (() => {
          const c = turnClockRef.current;
          if (!c || c.player !== decisionSeat) {
            return getTurnTotalSeconds(game.timeBanks[decisionSeat]);
          }
          const elapsed = Math.max(0, (clockNowMs - c.startedAt) / 1000);
          return Math.max(
            0,
            Math.ceil(
              getTurnTotalSeconds(game.timeBanks[decisionSeat]) - elapsed,
            ),
          );
        })()
      : null;
  const currentTurnRemainSeconds =
    game && decisionSeat === 0 ? decisionSeatRemainSeconds : null;
  const timerTextClass = (seat: number): string => {
    const active = decisionSeat === seat && decisionSeatRemainSeconds != null;
    if (!active) return 'text-[#a8dadc]';
    if (decisionSeatRemainSeconds <= 3)
      return 'text-red-300 animate-pulse font-semibold';
    if (decisionSeatRemainSeconds <= 8) return 'text-amber-300 font-semibold';
    return 'text-emerald-300';
  };

  const decisionTurnKey =
    game && decisionSeat !== null
      ? `${game.phase}:${decisionSeat}:${game.currentPlayer}:${game.claimIndex}:${game.lastDiscardFrom ?? -1}:${game.lastDiscard ?? -1}`
      : null;

  useEffect(() => {
    if (!game || decisionSeat !== 0 || currentTurnRemainSeconds == null) return;
    if (currentTurnRemainSeconds > 3 || currentTurnRemainSeconds <= 0) return;
    if (!decisionTurnKey) return;
    if (lowTimeWarnedTurnRef.current === decisionTurnKey) return;
    sounds.playTimeWarning();
    lowTimeWarnedTurnRef.current = decisionTurnKey;
  }, [game, decisionSeat, currentTurnRemainSeconds, decisionTurnKey, sounds]);
  const myFuritenReason =
    game && isClaimPhase
      ? (() => {
          const waits = getRonWaitingTilesForSeat(0, game);
          const st = game.furitenStates[0] ?? createInitialFuritenState();
          const sutehai = isRonForbiddenByFuriten({
            waitingTiles: waits,
            ownDiscards: game.discardPiles[0],
            state: { ...st, doujun: false, riichi: false, sutehai: false },
          });
          if (st.riichi) return '立直振听（本局不可荣和）';
          if (st.doujun) return '同巡振听（下次摸牌后解除）';
          if (sutehai) return '舍张振听（当前听牌牌种与自家河重复）';
          return null;
        })()
      : null;

  /** 自摸：当前手牌 14 张且和牌形+有役；优先用 riichi-rs 算分 */
  const doTsumo = useCallback(() => {
    if (!game || !canTsumo) return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const hand = game.hands[0];
    const stateForRs: GameStateForRs = {
      hand,
      melds: game.melds[0],
      doraIndicator: game.doraIndicator,
      roundWind: game.roundWind,
      dealer: game.dealer,
      riichiDeclared: game.riichiDeclared,
      wallLength: game.wall.length,
      lastDiscard: game.lastDiscard,
    };
    const input = buildRiichiInput(stateForRs, true);
    const rs = calcWithRiichiRs(input);
    if (rs && rs.yaku.length > 0) {
      addLog(`自家 自摸！${rs.fu}符 ${rs.han}番 ${rs.ten}点`);
      sounds.playTsumo();
      const enriched = enrichWinResultWithUra({
        state: game,
        winner: 0,
        isTsumo: true,
        handWithWin: hand,
        yaku: rs.yaku,
        fu: rs.fu,
        han: rs.han,
        ten: rs.ten,
      });
      setWinResult({
        winner: 0,
        isTsumo: true,
        yaku: enriched.yaku,
        fu: enriched.fu,
        han: enriched.han,
        ten: enriched.ten,
        uraHan: enriched.uraHan,
        uraDoraIndicators: enriched.uraDoraIndicators,
      });
      setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
      return;
    }
    const ctx = buildYakuCtx(0, hand, true);
    if (!ctx) return;
    const yaku = computeYaku(ctx);
    if (yaku.length === 0) return;
    addLog(`自家 自摸！役: ${yaku.map((y) => y.name).join(' ')}`);
    sounds.playTsumo();
    const han = getTotalHan(yaku);
    const fu = calcFu({
      isTsumo: true,
      isMenzhen: game.melds[0].every((m) => m.type === 'angang'),
      hasPinfu: yaku.some((yy) => yy.id === 'pinfu'),
      isChiitoitsu: yaku.some((yy) => yy.id === 'chiitoitsu'),
    });
    const ten = calcScore(fu, han, game.dealer === 0, true);
    const enriched = enrichWinResultWithUra({
      state: game,
      winner: 0,
      isTsumo: true,
      handWithWin: hand,
      yaku,
      fu,
      han,
      ten,
    });
    setWinResult({
      winner: 0,
      isTsumo: true,
      yaku: enriched.yaku,
      fu: enriched.fu,
      han: enriched.han,
      ten: enriched.ten,
      uraHan: enriched.uraHan,
      uraDoraIndicators: enriched.uraDoraIndicators,
    });
    setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
  }, [game, canTsumo, buildYakuCtx, addLog, sounds, consumeSeatTimeBank]);

  /** 荣和：要牌阶段别人打的牌能胡；优先用 riichi-rs 算分 */
  const doRon = useCallback(() => {
    if (!game || !canRon || game.lastDiscard === null) return;
    const timedBanks = consumeSeatTimeBank(game, 0);
    turnClockRef.current = null;
    const handWithClaim = [...game.hands[0], game.lastDiscard];
    const stateForRs: GameStateForRs = {
      hand: handWithClaim,
      melds: game.melds[0],
      doraIndicator: game.doraIndicator,
      roundWind: game.roundWind,
      dealer: game.dealer,
      riichiDeclared: game.riichiDeclared,
      wallLength: game.wall.length,
      lastDiscard: game.lastDiscard,
    };
    const input = buildRiichiInput(stateForRs, false, game.lastDiscard);
    const rs = calcWithRiichiRs(input);
    if (rs && rs.yaku.length > 0) {
      addLog(
        `自家 荣和 ${getTileLabel(game.lastDiscard)}！${rs.fu}符 ${rs.han}番 ${rs.ten}点`,
      );
      sounds.playRon();
      const enriched = enrichWinResultWithUra({
        state: game,
        winner: 0,
        isTsumo: false,
        handWithWin: handWithClaim,
        yaku: rs.yaku,
        fu: rs.fu,
        han: rs.han,
        ten: rs.ten,
      });
      setWinResult({
        winner: 0,
        isTsumo: false,
        yaku: enriched.yaku,
        fu: enriched.fu,
        han: enriched.han,
        ten: enriched.ten,
        uraHan: enriched.uraHan,
        uraDoraIndicators: enriched.uraDoraIndicators,
      });
      setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
      return;
    }
    const ctx = buildYakuCtx(0, handWithClaim, false);
    if (!ctx) return;
    const yaku = computeYaku(ctx);
    if (yaku.length === 0) return;
    addLog(
      `自家 荣和 ${getTileLabel(game.lastDiscard)}！役: ${yaku.map((y) => y.name).join(' ')}`,
    );
    sounds.playRon();
    const han = getTotalHan(yaku);
    const fu = calcFu({
      isTsumo: false,
      isMenzhen: game.melds[0].every((m) => m.type === 'angang'),
      hasPinfu: yaku.some((yy) => yy.id === 'pinfu'),
      isChiitoitsu: yaku.some((yy) => yy.id === 'chiitoitsu'),
    });
    const ten = calcScore(fu, han, game.dealer === 0, false);
    const enriched = enrichWinResultWithUra({
      state: game,
      winner: 0,
      isTsumo: false,
      handWithWin: handWithClaim,
      yaku,
      fu,
      han,
      ten,
    });
    setWinResult({
      winner: 0,
      isTsumo: false,
      yaku: enriched.yaku,
      fu: enriched.fu,
      han: enriched.han,
      ten: enriched.ten,
      uraHan: enriched.uraHan,
      uraDoraIndicators: enriched.uraDoraIndicators,
    });
    setGame((g) => (g ? { ...g, timeBanks: timedBanks } : g));
  }, [game, canRon, buildYakuCtx, addLog, sounds, consumeSeatTimeBank]);

  const passRonOpportunity = useCallback(() => {
    if (!currentClaimToken) return;
    markSeatRonDeclined(0);
    setGame((g) => (g ? { ...g, timeBanks: consumeSeatTimeBank(g, 0) } : g));
    turnClockRef.current = null;
    setDeclinedRonToken(currentClaimToken);
    addLog('自家 过（放弃荣和）');
  }, [currentClaimToken, addLog, markSeatRonDeclined, consumeSeatTimeBank]);

  /** 胡牌后进入下一局 */
  const proceedToNextRound = useCallback(() => {
    if (!game || !winResult) return;
    const baseTen = resolveWinBaseTen(winResult, game);
    const settlement = settleWin({
      scores: game.scores,
      winner: winResult.winner,
      isTsumo: winResult.isTsumo,
      baseTen,
      dealer: game.dealer,
      honba: game.honba,
      riichiPot: game.riichiPot,
      ronFrom: game.lastDiscardFrom,
    });
    const scoreLine = SEAT_NAMES.map(
      (name, i) => `${name} ${formatPoints(settlement.newScores[i])}`,
    ).join(' · ');
    addLog(`本局结算：${scoreLine}`);
    const dealerWon = game.dealer === winResult.winner;
    const end = resolveRiichiMatchEnd({
      scores: settlement.newScores,
      roundWind: game.roundWind,
      roundNumber: game.roundNumber,
      dealer: game.dealer,
      dealerStays: dealerWon,
      matchLength: game.matchLength,
    });
    if (end.end && end.reason) {
      setWinResult(null);
      setDeclinedRonToken(null);
      setMatchEnd({
        reason: end.reason,
        finalScores: settlement.newScores,
        ranking: rankSeatsByScore(settlement.newScores),
      });
      addLog(`牌局结束：${getMatchEndReasonText(end.reason)}`);
      return;
    }
    const next = getNextRound(
      game.dealer,
      game.roundWind,
      game.roundNumber,
      game.honba,
      dealerWon,
    );
    setWinResult(null);
    setDeclinedRonToken(null);
    setGame(
      initRiichiGame(
        next.dealer,
        next.roundWind,
        next.roundNumber,
        next.honba,
        settlement.newScores,
        undefined,
        settlement.nextRiichiPot,
        {
          payments: settlement.payments,
          deltas: settlement.deltas,
          newScores: settlement.newScores,
          timeoutEvents: game.timeoutEvents,
        },
        game.matchLength,
      ),
    );
    addLog(dealerWon ? '庄家胡，连庄' : '子家胡，换庄');
  }, [game, winResult, addLog]);

  /** 流局后进入下一局（庄家连庄，本场+1） */
  const proceedAfterRyuukyoku = useCallback(() => {
    if (!game || !game.ryuukyoku) return;
    const reason = game.ryuukyokuReason ?? '荒牌';
    const isExhaustiveDraw = reason === '荒牌';
    const tenpaiSeats = isExhaustiveDraw
      ? getTenpaiSeatsForDraw(game, getWaitingTilesRiichi)
      : [];
    const settlement = isExhaustiveDraw
      ? settleRyuukyoku(game.scores, tenpaiSeats, game.riichiPot)
      : {
          payments: [] as PaymentDetail[],
          deltas: [0, 0, 0, 0],
          newScores: [...game.scores],
          nextRiichiPot: game.riichiPot,
        };
    const tenpaiText = !isExhaustiveDraw
      ? '途中流局（不执行不听罚符）'
      : tenpaiSeats.length === 0
        ? '无人听牌'
        : tenpaiSeats.length === 4
          ? '全员听牌'
          : `听牌：${tenpaiSeats.map((i) => SEAT_NAMES[i]).join('、')}`;
    const scoreLine = SEAT_NAMES.map(
      (name, i) => `${name} ${formatPoints(settlement.newScores[i])}`,
    ).join(' · ');
    addLog(`流局结算（${tenpaiText}）：${scoreLine}`);
    const end = resolveRiichiMatchEnd({
      scores: settlement.newScores,
      roundWind: game.roundWind,
      roundNumber: game.roundNumber,
      dealer: game.dealer,
      dealerStays: true,
      matchLength: game.matchLength,
    });
    if (end.end && end.reason) {
      setDeclinedRonToken(null);
      setMatchEnd({
        reason: end.reason,
        finalScores: settlement.newScores,
        ranking: rankSeatsByScore(settlement.newScores),
      });
      addLog(`牌局结束：${getMatchEndReasonText(end.reason)}`);
      return;
    }
    const next = getNextRound(
      game.dealer,
      game.roundWind,
      game.roundNumber,
      game.honba,
      true,
    );
    setDeclinedRonToken(null);
    setGame(
      initRiichiGame(
        next.dealer,
        next.roundWind,
        next.roundNumber,
        next.honba,
        settlement.newScores,
        undefined,
        settlement.nextRiichiPot,
        {
          payments: settlement.payments,
          deltas: settlement.deltas,
          newScores: settlement.newScores,
          tenpaiSeats: isExhaustiveDraw ? tenpaiSeats : undefined,
          timeoutEvents: game.timeoutEvents,
        },
        game.matchLength,
      ),
    );
    addLog(`流局（${reason}），连庄`);
  }, [game, addLog, getWaitingTilesRiichi]);

  const winSettlementPreview = useMemo(() => {
    if (!game || !winResult) return null;
    const baseTen = resolveWinBaseTen(winResult, game);
    try {
      return settleWin({
        scores: game.scores,
        winner: winResult.winner,
        isTsumo: winResult.isTsumo,
        baseTen,
        dealer: game.dealer,
        honba: game.honba,
        riichiPot: game.riichiPot,
        ronFrom: game.lastDiscardFrom,
      });
    } catch {
      return null;
    }
  }, [game, winResult]);

  const drawSettlementPreview = useMemo(() => {
    if (!game || !game.ryuukyoku) return null;
    const reason = game.ryuukyokuReason ?? '荒牌';
    const isExhaustiveDraw = reason === '荒牌';
    const tenpaiSeats = isExhaustiveDraw
      ? getTenpaiSeatsForDraw(game, getWaitingTilesRiichi)
      : [];
    const settlement = isExhaustiveDraw
      ? settleRyuukyoku(game.scores, tenpaiSeats, game.riichiPot)
      : {
          payments: [] as PaymentDetail[],
          deltas: [0, 0, 0, 0],
          newScores: [...game.scores],
          nextRiichiPot: game.riichiPot,
        };
    return { tenpaiSeats, settlement };
  }, [game, getWaitingTilesRiichi]);

  const winnerPaymentSummary = useMemo(() => {
    if (!winResult || !winSettlementPreview) return null;
    return summarizeWinnerPayments(
      winSettlementPreview.payments,
      winResult.winner,
    );
  }, [winResult, winSettlementPreview]);

  // 要牌阶段：轮到自家且没有任何吃/碰/杠可选时，自动过，不暂停
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'claim' ||
      claimPlayer !== 0 ||
      hasAnyClaimOption
    )
      return;
    setGame((g) => {
      if (
        !g ||
        g.phase !== 'claim' ||
        g.lastDiscardFrom === null ||
        g.lastDiscard === null
      )
        return g;
      const lastTile = g.lastDiscard;
      const chiOpts = getChiOptionsRiichi(
        g.hands[0],
        lastTile,
        g.lastDiscardFrom,
        0,
      );
      const peng = canPengRiichi(g.hands[0], lastTile);
      const gang = canMingangRiichi(g.hands[0], lastTile);
      if (chiOpts.length > 0 || peng || gang) return g;
      const passResult = resolveClaimPass(g.claimIndex, g.wall.length);
      if (passResult.type === 'next') {
        return {
          ...g,
          claimIndex: passResult.nextClaimIndex,
          lastClaimMsg: null,
        };
      }
      const nextPlayer = (g.lastDiscardFrom + 1) % 4;
      if (passResult.type === 'ryuukyoku') {
        addLogRef.current('流局（荒牌）');
        return {
          ...g,
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: nextPlayer,
          lastClaimMsg: null,
          ryuukyoku: true,
          ryuukyokuReason: '荒牌',
        };
      }
      const draw = g.wall[0];
      const newWall = g.wall.slice(1);
      const newHands = g.hands.map((h) => [...h]);
      newHands[nextPlayer].push(draw);
      newHands[nextPlayer].sort(
        (a, b) => getBaseTile(a) - getBaseTile(b) || a - b,
      );
      return {
        ...g,
        hands: newHands,
        wall: newWall,
        furitenStates: clearSeatDoujunStates(g.furitenStates, nextPlayer),
        phase: 'discard',
        lastDiscard: null,
        lastDiscardFrom: null,
        claimIndex: 0,
        currentPlayer: nextPlayer,
        drawnTile: draw,
        lastClaimMsg: null,
      };
    });
  }, [
    game?.phase,
    game?.claimIndex,
    game?.lastDiscardFrom,
    claimPlayer,
    hasAnyClaimOption,
    game,
  ]);

  // 要牌阶段：轮到 AI 时自动 吃/碰/杠 或 过
  // biome-ignore lint/correctness/useExhaustiveDependencies: granular deps to avoid redundant effect runs
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'claim' ||
      claimPlayer === null ||
      claimPlayer === 0 ||
      canRon
    )
      return;
    const p = claimPlayer;
    const last = game.lastDiscard;
    const from = game.lastDiscardFrom;
    if (last === null || from === null) return;
    const hand = game.hands[p];
    const handWithClaim = [...hand, last];
    const ronCtx = buildYakuCtx(p, handWithClaim, false);
    const furitenBlocked = isSeatFuriten(p, game);
    const aiCanRon = canAiRonOnClaim({
      fromPlayer: from,
      aiSeat: p,
      isWinShape: isWinShapeRiichi(handWithClaim, game.melds[p]),
      hasYaku: (ronCtx ? hasYaku(ronCtx) : false) && !furitenBlocked,
    });
    const aiRiichiLocked = game.riichiDeclared[p];
    const foldClaimByRiichi =
      !aiRiichiLocked &&
      shouldAiFoldClaimAgainstRiichi({
        aiSeat: p,
        riichiDeclared: game.riichiDeclared,
      });
    const chiOpts = aiRiichiLocked
      ? []
      : getChiOptionsRiichi(hand, last, from, p);
    const peng = aiRiichiLocked ? false : canPengRiichi(hand, last);
    const gang =
      aiRiichiLocked || foldClaimByRiichi
        ? false
        : canMingangRiichi(hand, last);
    const claimDefensePlan = foldClaimByRiichi
      ? chooseAiClaimActionAgainstRiichi({
          aiSeat: p,
          hand,
          chiOptions: chiOpts,
          canPeng: peng,
          lastTile: last,
          riichiDeclared: game.riichiDeclared,
          discardPiles: game.discardPiles,
          doraIndicators: [game.doraIndicator],
          seatWind: getSeatWind(game.roundWind, p, game.dealer),
          roundWind: game.roundWind,
        })
      : null;
    const forcedChiOption =
      claimDefensePlan?.action === 'chi' ? claimDefensePlan.chiOption : null;
    const forcedPengDiscard =
      claimDefensePlan?.action === 'peng' ? claimDefensePlan.discardTile : null;
    const allowRandomClaim = !foldClaimByRiichi;
    const tid = setTimeout(() => {
      if (aiCanRon) {
        const yaku = ronCtx ? computeYaku(ronCtx) : [];
        const han = getTotalHan(yaku);
        const fu = calcFu({
          isTsumo: false,
          isMenzhen: game.melds[p].every((m) => m.type === 'angang'),
          hasPinfu: yaku.some((y) => y.id === 'pinfu'),
          isChiitoitsu: yaku.some((y) => y.id === 'chiitoitsu'),
        });
        addLogRef.current(`${SEAT_NAMES[p]} 荣和 ${getTileLabel(last)}！`);
        sounds.playRon();
        const ten = calcScore(fu, han, game.dealer === p, false);
        const enriched = enrichWinResultWithUra({
          state: game,
          winner: p,
          isTsumo: false,
          handWithWin: handWithClaim,
          yaku,
          han,
          fu,
          ten,
        });
        setWinResult({
          winner: p,
          isTsumo: false,
          yaku: enriched.yaku,
          han: enriched.han,
          fu: enriched.fu,
          ten: enriched.ten,
          uraHan: enriched.uraHan,
          uraDoraIndicators: enriched.uraDoraIndicators,
        });
        return;
      }
      if (
        (forcedChiOption || chiOpts.length > 0) &&
        (forcedChiOption || (allowRandomClaim && Math.random() < 0.6))
      ) {
        const [a, b] = forcedChiOption ?? chiOpts[0];
        const hands = game.hands.map((h) => [...h]);
        const melds = game.melds.map((m) => [...m]);
        const hp = hands[p];
        const ia = hp.indexOf(a);
        const ib = hp.indexOf(b);
        if (ia !== -1 && ib !== -1) {
          hp.splice(Math.max(ia, ib), 1);
          hp.splice(Math.min(ia, ib), 1);
          melds[p] = [
            ...melds[p],
            {
              type: 'chi' as const,
              tiles: [a, b, last].sort(
                (x, y) => getBaseTile(x) - getBaseTile(y) || x - y,
              ),
              fromPlayer: from,
            },
          ];
          const pilesChi = game.discardPiles.map((q) => [...q]);
          if (pilesChi[from].length > 0) pilesChi[from].pop();
          const plannedDiscard =
            claimDefensePlan?.action === 'chi'
              ? claimDefensePlan.discardTile
              : null;
          const discardIdx =
            plannedDiscard !== null ? hp.indexOf(plannedDiscard) : -1;
          const toDiscard = discardIdx >= 0 ? hp[discardIdx] : hp[0];
          if (discardIdx >= 0) hp.splice(discardIdx, 1);
          else hp.shift();
          pilesChi[p].push(toDiscard);
          addLogRef.current(
            `${SEAT_NAMES[p]} 吃了 ${getTileLabel(last)} 并打出 ${getTileLabel(toDiscard)}`,
          );
          if (claimDefensePlan?.action === 'chi' && claimDefensePlan.reason) {
            addLogRef.current(`${SEAT_NAMES[p]} ${claimDefensePlan.reason}`);
          }
          setGame({
            ...game,
            hands,
            melds,
            discardPiles: pilesChi,
            phase: 'claim',
            lastDiscard: toDiscard,
            lastDiscardFrom: p,
            claimIndex: 0,
            currentPlayer: (p + 1) % 4,
            lastClaimMsg: `${SEAT_NAMES[p]} 吃了 ${getTileLabel(last)}`,
          });
          return;
        }
      }
      if (
        (forcedPengDiscard !== null || peng) &&
        (forcedPengDiscard !== null ||
          (allowRandomClaim && Math.random() < 0.4))
      ) {
        const base = getBaseTile(last);
        const h = [...game.hands[p]];
        const indices: number[] = [];
        for (let i = 0; i < h.length && indices.length < 2; i++) {
          if (getBaseTile(h[i]) === base) indices.push(i);
        }
        if (indices.length >= 2) {
          const tiles = [last, h[indices[0]], h[indices[1]]];
          indices
            .sort((x, y) => y - x)
            .forEach((i) => {
              h.splice(i, 1);
            });
          const hands = game.hands.map((h0, i) => (i === p ? h : h0));
          const melds = game.melds.map((m, i) =>
            i === p ? [...m, { type: 'peng' as const, tiles }] : m,
          );
          const pilesPeng = game.discardPiles.map((q) => [...q]);
          if (pilesPeng[from].length > 0) pilesPeng[from].pop();
          const discardIdx =
            forcedPengDiscard !== null ? h.indexOf(forcedPengDiscard) : -1;
          const toDiscard = discardIdx >= 0 ? h[discardIdx] : h[0];
          if (discardIdx >= 0) h.splice(discardIdx, 1);
          else h.shift();
          pilesPeng[p].push(toDiscard);
          addLogRef.current(
            `${SEAT_NAMES[p]} 碰了 ${getTileLabel(last)} 并打出 ${getTileLabel(toDiscard)}`,
          );
          if (claimDefensePlan?.action === 'peng' && claimDefensePlan.reason) {
            addLogRef.current(`${SEAT_NAMES[p]} ${claimDefensePlan.reason}`);
          }
          setGame({
            ...game,
            hands,
            melds,
            discardPiles: pilesPeng,
            phase: 'claim',
            lastDiscard: toDiscard,
            lastDiscardFrom: p,
            claimIndex: 0,
            currentPlayer: (p + 1) % 4,
            lastClaimMsg: `${SEAT_NAMES[p]} 碰了 ${getTileLabel(last)}`,
          });
          return;
        }
      }
      if (gang && Math.random() < 0.3 && game.wall.length > 0) {
        const base = getBaseTile(last);
        const h = [...game.hands[p]];
        const indices: number[] = [];
        for (let i = 0; i < h.length && indices.length < 3; i++) {
          if (getBaseTile(h[i]) === base) indices.push(i);
        }
        if (indices.length >= 3) {
          const tiles = [last, ...indices.map((i) => h[i])];
          indices
            .sort((x, y) => y - x)
            .forEach((i) => {
              h.splice(i, 1);
            });
          const handAfterKan = [...h];
          const rinshan = game.wall[0];
          const newWall = game.wall.slice(1);
          h.push(rinshan);
          h.sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
          const hands = game.hands.map((h0, i) => (i === p ? h : h0));
          const melds = game.melds.map((m, i) =>
            i === p ? [...m, { type: 'mingang' as const, tiles }] : m,
          );
          const pilesGang = game.discardPiles.map((q) => [...q]);
          if (pilesGang[from].length > 0) pilesGang[from].pop();
          addLogRef.current(`${SEAT_NAMES[p]} 杠了 ${getTileLabel(last)}`);
          if (shouldAbortOnSuukaikan(melds)) {
            addLogRef.current('流局（四开杠）');
            sounds.playRyuukyoku();
            setGame({
              ...game,
              hands: game.hands.map((h0, i) => (i === p ? handAfterKan : h0)),
              melds,
              discardPiles: pilesGang,
              phase: 'discard',
              lastDiscard: null,
              lastDiscardFrom: null,
              claimIndex: 0,
              currentPlayer: p,
              drawnTile: null,
              lastClaimMsg: null,
              ryuukyoku: true,
              ryuukyokuReason: '四开杠',
            });
            return;
          }
          setGame({
            ...game,
            hands,
            melds,
            discardPiles: pilesGang,
            wall: newWall,
            furitenStates: clearSeatDoujunStates(game.furitenStates, p),
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: p,
            drawnTile: rinshan,
            lastClaimMsg: `${SEAT_NAMES[p]} 杠了 ${getTileLabel(last)}`,
          });
          return;
        }
      }
      addLogRef.current(
        foldClaimByRiichi
          ? `${SEAT_NAMES[p]} 过（${claimDefensePlan?.reason || '他家立直，防守优先'}）`
          : `${SEAT_NAMES[p]} 过`,
      );
      setGame((g) => {
        if (!g || g.phase !== 'claim' || g.lastDiscardFrom === null) return g;
        const passResult = resolveClaimPass(g.claimIndex, g.wall.length);
        if (passResult.type === 'next') {
          return {
            ...g,
            claimIndex: passResult.nextClaimIndex,
            lastClaimMsg: null,
          };
        }
        const nextPlayer = (g.lastDiscardFrom + 1) % 4;
        if (passResult.type === 'ryuukyoku') {
          addLogRef.current('流局（荒牌）');
          return {
            ...g,
            phase: 'discard',
            lastDiscard: null,
            lastDiscardFrom: null,
            claimIndex: 0,
            currentPlayer: nextPlayer,
            lastClaimMsg: null,
            ryuukyoku: true,
            ryuukyokuReason: '荒牌',
          };
        }
        const draw = g.wall[0];
        const newWall = g.wall.slice(1);
        const newHands = g.hands.map((h) => [...h]);
        newHands[nextPlayer].push(draw);
        newHands[nextPlayer].sort(
          (a, b) => getBaseTile(a) - getBaseTile(b) || a - b,
        );
        return {
          ...g,
          hands: newHands,
          wall: newWall,
          furitenStates: clearSeatDoujunStates(g.furitenStates, nextPlayer),
          phase: 'discard',
          lastDiscard: null,
          lastDiscardFrom: null,
          claimIndex: 0,
          currentPlayer: nextPlayer,
          drawnTile: draw,
          lastClaimMsg: null,
        };
      });
    }, 400);
    return () => clearTimeout(tid);
  }, [
    game?.phase,
    game?.claimIndex,
    claimPlayer,
    canRon,
    game?.lastDiscard,
    game?.lastDiscardFrom,
    game?.discardPiles?.map,
    game?.hands?.map,
    game?.wall?.slice,
    game?.wall?.length,
    game?.wall?.[0],
    game?.hands?.[claimPlayer ?? 0],
    game,
  ]);

  return {
    view,
    setView,
    matchLength,
    setMatchLength,
    game,
    setGame,
    history,
    gameLog,
    logOpen,
    setLogOpen,
    winResult,
    showGuide,
    setShowGuide,
    matchEnd,
    startGame,
    undo,
    addLog,
    discard,
    doTsumo,
    doRon,
    doChi,
    doPeng,
    doMingang,
    doAngang,
    doRiichi,
    doKyuushuKyuuhai,
    passClaim,
    passRonOpportunity,
    proceedToNextRound,
    proceedAfterRyuukyoku,
    isClaimPhase,
    claimPlayer,
    isMyTurn,
    isMyClaim,
    chiOptions,
    canPeng,
    canMingang,
    canRon,
    hasAnyClaimOption,
    hasNonRonClaimOption,
    myFuritenReason,
    tenpaiHint,
    winSettlementPreview,
    drawSettlementPreview,
    winnerPaymentSummary,
    decisionSeat,
    decisionSeatRemainSeconds,
    currentTurnRemainSeconds,
    timerTextClass,
    angangOptions,
    canKyuushuKyuuhai,
    getWaitingTilesRiichi,
    canTsumo,
  };
}
