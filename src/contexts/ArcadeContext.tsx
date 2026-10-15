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
import type { ArcadeRecord } from '@/store/gameStore';
import type { ArcadeMemberEvent, ArcadeMemberResult } from '../../shared/contracts/member';

export type ArcadeOutcome = 'win' | 'lose' | 'draw';
type ArcadeResult = ArcadeRecord & {
  coinsEarned: number;
  capReached: boolean;
  outcome: ArcadeOutcome;
  score: number;
  settlementFailed?: boolean;
  settlementPending?: boolean;
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
  };
}
type Session = {
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
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<ArcadeResult | null>(null);
  const [settlementRetrying, setSettlementRetrying] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const receipt = useRef({
    id: `arcade:${createUuid()}`,
    started: false,
    finished: false,
  });
  const snapshotReader = useRef<(() => unknown) | null>(null);
  const pendingFinish = useRef<ArcadeMemberEvent | null>(null);
  const start = useCallback(() => {
    if (receipt.current.started) return;
    receipt.current.started = true;
    const event = {
      gameId,
      difficulty,
      roundId: receipt.current.id,
    };
    if (memberMode) {
      void household!.performArcadeEvent({ ...event, type: 'start' }).catch(() => {});
    } else {
      emitGameEvent({
        gameId,
        difficulty,
        type: 'start',
        meta: { roundId: receipt.current.id },
      });
    }
  }, [gameId, difficulty, memberMode, household]);
  const newRound = useCallback(() => {
    receipt.current = {
      id: `arcade:${createUuid()}`,
      started: false,
      finished: false,
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
  const finish = useCallback(
    (outcome: ArcadeOutcome, score = 0, meta: Record<string, unknown> = {}) => {
      if (receipt.current.finished) return;
      start();
      receipt.current.finished = true;
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
    [gameId, difficulty, start, memberMode, household],
  );
  const retrySettlement = useCallback(() => {
    const event = pendingFinish.current;
    if (!memberMode || !event || settlementRetrying || event.type !== 'finish') return;
    setSettlementRetrying(true);
    void household!.performArcadeEvent({
      type: 'start', roundId: event.roundId,
      gameId: event.gameId, difficulty: event.difficulty,
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
    return () => {
      if (snapshotReader.current === reader) snapshotReader.current = null;
    };
  }, []);
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
