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
import { useSearchParams } from 'react-router-dom';
import { migrateLegacyArcadeStats } from '@/lib/achievements';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import {
  type ArcadeDifficulty,
  getArcadeDifficulty,
  normalizeArcadeDifficulty,
  setArcadeDifficulty,
} from '@/lib/arcade';
import { emitGameEvent } from '@/lib/gameEvents';
import { createUuid } from '@/lib/uuid';
import { gameStorage } from '@/lib/storage';
import { arcadeFeedbackToken, playArcadeFeedback } from '@/lib/arcadeFeedback';
import {
  ARCADE_CHALLENGE_ID,
  ARCADE_CHALLENGE_STORAGE_KEY,
  recordArcadeChallenge,
  type ChallengeResult,
} from '../../shared/contracts/arcadeChallenge';
import type { ArcadeRecord } from '@/store/gameStore';
import type {
  ArcadeMemberEvent,
  ArcadeMemberResult,
} from '../../shared/contracts/member';
import type { LeaderboardStanding } from '../../shared/contracts/leaderboard';
import {
  arcadeResumeSlot,
  isArcadeResume,
  MEMBER_ARCADE_MAX_AGE,
  RESUMABLE_ARCADE_IDS,
  type ArcadePositions,
  type ArcadeResume,
  type ResumableArcadeId,
} from '@/lib/arcadeResume';
import { readLocalResume, removeLocalResume, resumeOwner, writeLocalResume } from '@/lib/localResume';

export type ArcadeOutcome = 'win' | 'lose' | 'draw';
export type ArcadeResult = ArcadeRecord & {
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
  resumePosition: ArcadePositions[ResumableArcadeId] | null;
  resuming: boolean;
  resumeSaveFailed: boolean;
  practiceOnly: boolean;
  supportsResume: boolean;
  savePosition: (position: ArcadePositions[ResumableArcadeId]) => void;
  retrySave: () => void;
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
  const owner = resumeOwner(household?.currentMember?.id);
  const supportsResume = RESUMABLE_ARCADE_IDS.includes(gameId);
  const [query, setQuery] = useSearchParams();
  const [restored] = useState(() => {
    if (!supportsResume) return null;
    const mode = query.get('mode') === 'challenge' ? 'challenge' : 'classic';
    const saved = readLocalResume(owner, arcadeResumeSlot(gameId, mode))?.data;
    return isArcadeResume(saved) && saved.gameId === gameId && saved.mode === mode &&
      (!query.has('difficulty') || saved.difficulty === normalizeArcadeDifficulty(gameId, query.get('difficulty')))
      ? saved : null;
  });
  const [resumePosition, setResumePosition] = useState(restored?.position ?? null);
  const [resuming, setResuming] = useState(Boolean(restored));
  const [resumeSaveFailed, setResumeSaveFailed] = useState(false);
  const [practiceOnly, setPracticeOnly] = useState(Boolean(restored &&
    (restored.practiceOnly || (memberMode && restored.receipt.started && !restored.receipt.finished &&
      Date.now() - restored.receipt.startedAt > MEMBER_ARCADE_MAX_AGE))));
  const practiceOnlyRef = useRef(practiceOnly);
  const [difficulty, setDifficulty] = useState(() =>
    query.has('difficulty')
      ? normalizeArcadeDifficulty(gameId, query.get('difficulty'))
      : restored?.difficulty ?? getArcadeDifficulty(gameId),
  );
  const [round, setRound] = useState(0);
  const [mode, setMode] = useState<'classic' | 'challenge'>(() =>
    query.get('mode') === 'challenge' ? 'challenge' : 'classic',
  );
  const [paused, setPausedState] = useState(Boolean(restored && !restored.receipt.finished));
  const setPaused = useCallback((value: boolean) => {
    setPausedState(value);
    if (!value) setResuming(false);
  }, []);
  const [result, setResultState] = useState<ArcadeResult | null>(() => restored?.pendingFinish
    ? { isNewBest: false, previousBest: null, currentBest: null,
      outcome: restored.pendingFinish.outcome!, score: restored.pendingFinish.score!,
      coinsEarned: 0, capReached: false, settlementFailed: true }
    : restored?.result ?? null);
  const [settlementRetrying, setSettlementRetrying] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const receipt = useRef(restored?.receipt ?? {
    id: `arcade:${createUuid()}`,
    started: false,
    finished: false,
    startedAt: 0,
    elapsedMs: 0,
  });
  const clockStarted = useRef(restored?.receipt.finished ? 0 : Date.now());
  const position = useRef(restored?.position ?? null);
  const resultRef = useRef(result);
  const snapshotReader = useRef<(() => unknown) | null>(null);
  const pendingFinish = useRef<ArcadeMemberEvent | null>(restored?.pendingFinish ?? null);
  const feedback = useRef({ token: '', at: 0 });
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const elapsed = useCallback(() => receipt.current.elapsedMs +
    (receipt.current.started && !receipt.current.finished && clockStarted.current
      ? Math.max(0, Date.now() - clockStarted.current) : 0), []);
  const persist = useCallback(() => {
    if (!supportsResume || !position.current || !receipt.current.started) return;
    const slot = arcadeResumeSlot(gameId, mode);
    if (receipt.current.finished && gameId !== 'shengji' && !pendingFinish.current) {
      setResumeSaveFailed(!removeLocalResume(owner, slot));
      return;
    }
    const data: ArcadeResume = {
      kind: 'arcade', gameId: gameId as ResumableArcadeId, mode, difficulty,
      position: position.current,
      receipt: { ...receipt.current, elapsedMs: elapsed() },
      result: resultRef.current,
      pendingFinish: pendingFinish.current,
      practiceOnly: practiceOnlyRef.current,
    };
    setResumeSaveFailed(!writeLocalResume(owner, slot, data));
  }, [owner, gameId, mode, difficulty, supportsResume, elapsed]);
  const savePosition = useCallback((value: ArcadePositions[ResumableArcadeId]) => {
    position.current = value;
    persist();
  }, [persist]);
  const setResult = useCallback((value: ArcadeResult | null) => {
    resultRef.current = value;
    setResultState(value);
    persist();
  }, [persist]);
  useEffect(() => {
    const wasRunning = clockStarted.current !== 0;
    if (paused && wasRunning) {
      receipt.current.elapsedMs = elapsed();
      clockStarted.current = 0;
    } else if (!paused && !wasRunning && !receipt.current.finished) {
      clockStarted.current = Date.now();
    }
    persist();
  }, [paused, elapsed, persist]);
  useEffect(() => {
    const visibility = () => { if (document.hidden) persist(); };
    const leave = (event: BeforeUnloadEvent) => {
      if (!resumeSaveFailed) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('beforeunload', leave);
    return () => {
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('beforeunload', leave);
    };
  }, [persist, resumeSaveFailed]);
  const start = useCallback(() => {
    if (receipt.current.started) return;
    receipt.current.started = true;
    receipt.current.startedAt = Date.now();
    clockStarted.current = Date.now();
    const event = {
      gameId,
      difficulty,
      roundId: receipt.current.id,
      ...(mode === 'challenge' ? { challengeId: ARCADE_CHALLENGE_ID } : {}),
    };
    if (memberMode) {
      void household!
        .performArcadeEvent({ ...event, type: 'start' })
        .catch(() => {});
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
    if (supportsResume) removeLocalResume(owner, arcadeResumeSlot(gameId, mode));
    position.current = null;
    setResumePosition(null);
    setResuming(false);
    setPracticeOnly(false);
    practiceOnlyRef.current = false;
    clockStarted.current = Date.now();
    feedback.current = { token: '', at: 0 };
    receipt.current = {
      id: `arcade:${createUuid()}`,
      started: false,
      finished: false,
      startedAt: 0,
      elapsedMs: 0,
    };
    setResult(null);
    pendingFinish.current = null;
    setSettlementRetrying(false);
    setSettingsError(false);
    setPaused(false);
  }, [owner, gameId, mode, supportsResume, setPaused, setResult]);
  const restart = useCallback(() => {
    newRound();
    setRound((value) => value + 1);
  }, [newRound]);
  const changeDifficulty = useCallback(
    (next: ArcadeDifficulty) => {
      if (next === difficulty) return;
      const applyDifficulty = () => {
        setDifficulty(next);
        setQuery(
          (current) => {
            const changed = new URLSearchParams(current);
            changed.set('difficulty', next);
            return changed;
          },
          { replace: true },
        );
        restart();
      };
      if (memberMode) {
        void household!
          .updateArcadeDifficulty(gameId, next)
          .then(() => {
            setSettingsError(false);
            applyDifficulty();
          })
          .catch(() => setSettingsError(true));
      } else {
        setArcadeDifficulty(gameId, next);
        applyDifficulty();
      }
    },
    [gameId, difficulty, restart, memberMode, household, setQuery],
  );
  const changeMode = useCallback(
    (next: 'classic' | 'challenge') => {
      if (next === mode) return;
      setMode(next);
      setQuery(
        (current) => {
          const changed = new URLSearchParams(current);
          if (next === 'challenge') changed.set('mode', 'challenge');
          else changed.delete('mode');
          return changed;
        },
        { replace: true },
      );
      restart();
    },
    [mode, restart, setQuery],
  );
  const finish = useCallback(
    (outcome: ArcadeOutcome, score = 0, meta: Record<string, unknown> = {}) => {
      if (receipt.current.finished) return;
      start();
      receipt.current.elapsedMs = elapsed();
      receipt.current.finished = true;
      clockStarted.current = 0;
      meta = {
        ...meta,
        durationMs: receipt.current.elapsedMs,
      };
      const event = {
        gameId,
        difficulty,
        score,
        meta: { ...meta, outcome, roundId: receipt.current.id },
      };
      if (practiceOnlyRef.current) {
        setPaused(false);
        setResult({ isNewBest: false, previousBest: null, currentBest: null,
          outcome, score, coinsEarned: 0, capReached: false });
        return;
      }
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
        persist();
        void household!
          .performArcadeEvent(finishEvent)
          .then((settled) => {
            if (receipt.current.id !== roundId) return;
            setPaused(false);
            pendingFinish.current = null;
            setResult(settledResult(outcome, score, settled));
          })
          .catch(() => {
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
        try {
          raw = JSON.parse(
            gameStorage.getItem(ARCADE_CHALLENGE_STORAGE_KEY) ?? 'null',
          );
        } catch {
          /* A missing practice ledger starts empty. */
        }
        const challenge = recordArcadeChallenge(
          raw,
          receipt.current.id,
          { gameId, difficulty, outcome, score, meta },
          Date.now(),
        );
        gameStorage.setItem(
          ARCADE_CHALLENGE_STORAGE_KEY,
          JSON.stringify(challenge.state),
        );
        window.dispatchEvent(new Event('game-hub:arcade-challenges'));
        setPaused(false);
        setResult({
          isNewBest: false,
          previousBest: null,
          currentBest: null,
          outcome,
          score,
          coinsEarned: 0,
          capReached: false,
          challenge: challenge.result,
        });
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
    [gameId, difficulty, start, memberMode, household, mode, elapsed, persist, setResult, setPaused],
  );
  const retrySettlement = useCallback(() => {
    const event = pendingFinish.current;
    if (!memberMode || !event || settlementRetrying || event.type !== 'finish')
      return;
    setSettlementRetrying(true);
    void household!
      .refreshMe()
      .then(() => {
        if (!active.current || receipt.current.id !== event.roundId) return;
        return household!.performArcadeEvent({
          type: 'start',
          roundId: event.roundId,
          gameId: event.gameId,
          difficulty: event.difficulty,
          ...(event.challengeId ? { challengeId: event.challengeId } : {}),
        });
      })
      .then(() => {
        if (!active.current || receipt.current.id !== event.roundId) return;
        return household!.performArcadeEvent(event);
      })
      .then((settled) => {
        if (!settled || !active.current || receipt.current.id !== event.roundId)
          return;
        pendingFinish.current = null;
        setResult(
          settledResult(event.outcome ?? 'lose', event.score ?? 0, settled),
        );
      })
      .catch(() => {
        // Keep the same round id and result available for another attempt.
      })
      .finally(() => {
        if (active.current) setSettlementRetrying(false);
      });
  }, [memberMode, household, settlementRetrying, setResult]);
  const snapshot = useCallback(
    (reader: () => unknown) => {
      snapshotReader.current = reader;
      const token = arcadeFeedbackToken(reader());
      if (
        feedback.current.token &&
        token !== feedback.current.token &&
        !paused &&
        !receipt.current.finished &&
        Date.now() - feedback.current.at > 90
      ) {
        playArcadeFeedback('move');
        feedback.current.at = Date.now();
      }
      feedback.current.token = token;
      return () => {
        if (snapshotReader.current === reader) snapshotReader.current = null;
      };
    },
    [paused],
  );
  useEffect(() => {
    if (result)
      playArcadeFeedback(
        result.isNewBest
          ? 'record'
          : result.challenge?.cleared || result.outcome === 'win'
            ? 'win'
            : 'lose',
      );
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
        resumePosition,
        resuming,
        resumeSaveFailed,
        practiceOnly,
        supportsResume,
        savePosition,
        retrySave: persist,
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

export function useArcadeResumePosition<T extends ResumableArcadeId>(gameId: T): ArcadePositions[T] | null {
  const session = useArcade();
  return session.gameId === gameId ? session.resumePosition as ArcadePositions[T] | null : null;
}

export function useArcadeAutosave(position: ArcadePositions[ResumableArcadeId]): void {
  const { savePosition } = useArcade();
  const serialized = JSON.stringify(position);
  useEffect(() => { savePosition(JSON.parse(serialized)); }, [serialized, savePosition]);
}
