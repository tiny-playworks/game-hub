import {
  createContext,
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { migrateLegacyArcadeStats } from '@/lib/achievements';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import {
  type ArcadeDifficulty,
  getArcadeDifficulty,
  setArcadeDifficulty,
} from '@/lib/arcade';
import { emitGameEvent } from '@/lib/gameEvents';
import { createUuid } from '@/lib/uuid';
import { gameStorage } from '@/lib/storage';
import { arcadeFeedbackToken, playArcadeFeedback } from '@/lib/arcadeFeedback';
import { ARCADE_CHALLENGE_ID, ARCADE_CHALLENGE_STORAGE_KEY, recordArcadeChallenge, type ChallengeResult } from '../../shared/contracts/arcadeChallenge';
import type { ArcadeRecord } from '@/store/gameStore';
import type { ArcadeMemberEvent, ArcadeMemberResult } from '../../shared/contracts/member';
import type { LeaderboardStanding } from '../../shared/contracts/leaderboard';

export type ArcadeOutcome = 'win' | 'lose' | 'draw';
type ArcadeResult = ArcadeRecord & {
  challenge?: ChallengeResult;
  coinsEarned: number;
  capReached: boolean;
  outcome: ArcadeOutcome;
  score: number;
  settlementFailed?: boolean;
  settlementPending?: boolean;
  leaderboard?: LeaderboardStanding;
};
function settledResult(
  outcome: ArcadeOutcome,
  score: number,
  settled: ArcadeMemberResult,
): ArcadeResult {
  return {
    ...(settled.record ?? {
      isNewBest: false,
      previousBest: null,
      currentBest: null,
    }),
    outcome,
    score,
    coinsEarned: settled.coinsEarned,
    capReached: settled.capReached,
    settlementPending: settled.pending,
    leaderboard: settled.leaderboard,
    challenge: settled.challenge,
  };
}
type Session = {
  mode: 'classic' | 'challenge';
  changeMode: (mode: 'classic' | 'challenge') => void;
  gameId: string;
  difficulty: ArcadeDifficulty;
  paused: boolean;
  result: ArcadeResult | null;
  settlementRetrying: boolean;
  retrySettlement: () => void;
  settingsError: boolean;
  setPaused: (paused: boolean) => void;
  changeDifficulty: (difficulty: ArcadeDifficulty) => void;
  restart: () => void;
  newRound: () => void;
  start: () => void;
  finish: (
    outcome: ArcadeOutcome,
    score?: number,
    meta?: Record<string, unknown>,
  ) => void;
  snapshot: (reader: () => unknown) => () => void;
};
const ArcadeContext = createContext<Session | null>(null);
export function ArcadeSession({
  gameId,
  children,
}: {
  gameId: string;
  children: ReactNode;
}) {
  const household = useOptionalHousehold();
  const memberMode = Boolean(household?.currentMember);
  const [difficulty, setDifficulty] = useState(() =>
    getArcadeDifficulty(gameId),
  );
  const [round, setRound] = useState(0);
  const [mode, setMode] = useState<'classic' | 'challenge'>(() => new URLSearchParams(window.location.search).get('mode') === 'challenge' ? 'challenge' : 'classic');
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<ArcadeResult | null>(null);
  const [settlementRetrying, setSettlementRetrying] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const receipt = useRef({
    id: `arcade:${createUuid()}`,
    started: false,
    finished: false,
    startedAt: 0,
  });
  const snapshotReader = useRef<(() => unknown) | null>(null);
  const pendingFinish = useRef<ArcadeMemberEvent | null>(null);
  const feedback = useRef({ token: '', at: 0 });
  const start = useCallback(() => {
    if (receipt.current.started) return;
    receipt.current.started = true;
    receipt.current.startedAt = Date.now();
    const event = {
      gameId,
      difficulty,
      roundId: receipt.current.id,
      ...(mode === 'challenge' ? { challengeId: ARCADE_CHALLENGE_ID } : {}),
    };
    if (memberMode) {
      void household!.performArcadeEvent({ ...event, type: 'start' }).catch(() => {});
    } else if (mode === 'classic') {
      emitGameEvent({
        gameId,
        difficulty,
        type: 'start',
        meta: { roundId: receipt.current.id },
      });
    }
  }, [gameId, difficulty, memberMode, household, mode]);
  const newRound = useCallback(() => {
    feedback.current = { token: '', at: 0 };
    receipt.current = {
      id: `arcade:${createUuid()}`,
      started: false,
      finished: false,
      startedAt: 0,
    };
    setResult(null);
    pendingFinish.current = null;
    setSettlementRetrying(false);
    setSettingsError(false);
    setPaused(false);
  }, []);
  const restart = useCallback(() => {
    newRound();
    setRound((value) => value + 1);
  }, [newRound]);
  const changeDifficulty = useCallback(
    (next: ArcadeDifficulty) => {
      if (next === difficulty) return;
      if (memberMode) {
        void household!.updateArcadeDifficulty(gameId, next).then(() => {
          setSettingsError(false);
          setDifficulty(next);
          restart();
        }).catch(() => setSettingsError(true));
      } else {
        setArcadeDifficulty(gameId, next);
        setDifficulty(next);
        restart();
      }
    },
    [gameId, difficulty, restart, memberMode, household],
  );
  const changeMode = useCallback((next: 'classic' | 'challenge') => {
    if (next === mode) return;
    setMode(next);
    restart();
  }, [mode, restart]);
  const finish = useCallback(
    (outcome: ArcadeOutcome, score = 0, meta: Record<string, unknown> = {}) => {
      if (receipt.current.finished) return;
      start();
      receipt.current.finished = true;
      meta = { ...meta, durationMs: Math.max(0, Date.now() - receipt.current.startedAt) };
      const event = {
        gameId,
        difficulty,
        score,
        meta: { ...meta, outcome, roundId: receipt.current.id },
      };
      if (memberMode) {
        const roundId = receipt.current.id;
        const finishEvent: ArcadeMemberEvent = {
          type: 'finish',
          ...(mode === 'challenge' ? { challengeId: ARCADE_CHALLENGE_ID } : {}),
          roundId,
          gameId,
          difficulty,
          score,
          outcome,
          meta,
        };
        pendingFinish.current = finishEvent;
        void household!.performArcadeEvent(finishEvent).then((settled) => {
          if (receipt.current.id !== roundId) return;
          setPaused(false);
          pendingFinish.current = null;
          setResult(settledResult(outcome, score, settled));
        }).catch(() => {
          if (receipt.current.id !== roundId) return;
          setPaused(false);
          setResult({
            isNewBest: false,
            previousBest: null,
            currentBest: null,
            outcome,
            score,
            coinsEarned: 0,
            capReached: false,
            settlementFailed: true,
          });
        });
        return;
      }
      if (mode === 'challenge') {
        let raw: unknown = null;
        try { raw = JSON.parse(gameStorage.getItem(ARCADE_CHALLENGE_STORAGE_KEY) ?? 'null'); } catch { /* A missing practice ledger starts empty. */ }
        const challenge = recordArcadeChallenge(raw, receipt.current.id, { gameId, difficulty, outcome, score, meta }, Date.now());
        gameStorage.setItem(ARCADE_CHALLENGE_STORAGE_KEY, JSON.stringify(challenge.state));
        window.dispatchEvent(new Event('game-hub:arcade-challenges'));
        setPaused(false);
        setResult({ isNewBest: false, previousBest: null, currentBest: null, outcome, score, coinsEarned: 0, capReached: false, challenge: challenge.result });
        return;
      }
      const finished = emitGameEvent({ ...event, type: 'finish' });
      const won =
        outcome === 'win' ? emitGameEvent({ ...event, type: 'win' }) : null;
      const best = finished.record?.isNewBest
        ? emitGameEvent({ ...event, type: 'best' })
        : null;
      setPaused(false);
      setResult({
        ...(finished.record ?? {
          isNewBest: false,
          previousBest: null,
          currentBest: null,
        }),
        outcome,
        score,
        coinsEarned:
          finished.coinsEarned +
          (won?.coinsEarned ?? 0) +
          (best?.coinsEarned ?? 0),
        capReached:
          finished.arcadeCapReached === true ||
          won?.arcadeCapReached === true ||
          best?.arcadeCapReached === true,
      });
    },
    [gameId, difficulty, start, memberMode, household, mode],
  );
  const retrySettlement = useCallback(() => {
    const event = pendingFinish.current;
    if (!memberMode || !event || settlementRetrying || event.type !== 'finish') return;
    setSettlementRetrying(true);
    void household!.performArcadeEvent({
      type: 'start', roundId: event.roundId,
      gameId: event.gameId, difficulty: event.difficulty,
      ...(event.challengeId ? { challengeId: event.challengeId } : {}),
    }).then(() => household!.performArcadeEvent(event)).then((settled) => {
      if (receipt.current.id !== event.roundId) return;
      pendingFinish.current = null;
      setResult(settledResult(event.outcome ?? 'lose', event.score ?? 0, settled));
    }).catch(() => {
      // Keep the same round id and result available for another attempt.
    }).finally(() => setSettlementRetrying(false));
  }, [memberMode, household, settlementRetrying]);
  const snapshot = useCallback((reader: () => unknown) => {
    snapshotReader.current = reader;
    const token = arcadeFeedbackToken(reader());
    if (feedback.current.token && token !== feedback.current.token && !paused && !receipt.current.finished && Date.now() - feedback.current.at > 90) {
      playArcadeFeedback('move');
      feedback.current.at = Date.now();
    }
    feedback.current.token = token;
    return () => {
      if (snapshotReader.current === reader) snapshotReader.current = null;
    };
  }, [paused]);
  useEffect(() => {
    if (result) playArcadeFeedback(result.isNewBest ? 'record' : result.challenge?.cleared || result.outcome === 'win' ? 'win' : 'lose');
  }, [result?.outcome, result?.challenge?.cleared, result?.isNewBest]);
  useEffect(() => {
    migrateLegacyArcadeStats();
  }, []);
  useEffect(() => {
    const render = () =>
      JSON.stringify({
        gameId,
        difficulty,
        paused,
        result,
        settingsError,
        coordinateSystem:
          'origin at top left; x/column increases right, y/row increases down',
        game: snapshotReader.current?.() ?? null,
      });
    Object.assign(window, { render_game_to_text: render });
    return () => {
      if (
        (window as Window & { render_game_to_text?: unknown })
          .render_game_to_text === render
      )
        Reflect.deleteProperty(window, 'render_game_to_text');
    };
  }, [gameId, difficulty, paused, result, settingsError]);
  return (
    <ArcadeContext.Provider
      value={{
        mode,
        changeMode,
        gameId,
        difficulty,
        paused,
        setPaused,
        changeDifficulty,
        restart,
        newRound,
        start,
        finish,
        result,
        settlementRetrying,
        retrySettlement,
        settingsError,
        snapshot,
      }}
    >
      <Fragment key={`${gameId}:${difficulty}:${round}`}>{children}</Fragment>
    </ArcadeContext.Provider>
  );
}
export function useOptionalArcade() {
  return useContext(ArcadeContext);
}
export function useArcade() {
  const session = useOptionalArcade();
  if (!session) throw new Error('Arcade game requires ArcadeSession');
  return session;
}
export function useArcadeSnapshot(reader: () => unknown) {
  const session = useOptionalArcade();
  useEffect(() => session?.snapshot(reader));
}
