import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import {
  getPlayerCharacterState,
  markCharactersEncountered,
  recordCharacterMatchFinish,
} from '@/lib/playerCharacters';
import { getPlayerProfile } from '@/lib/playerProfile';
import { getRiichiOnlineBridge } from '@/lib/household/riichiBridge';
import {
  getRankedState,
  type RankedTicket,
  saveRankedState,
} from '@/lib/ranked';
import { settleRankedMatch } from '@/lib/rankedSettlement';
import {
  recordRiichiMatchFinish,
  recordRiichiProgressEvent,
  resetCurrentRiichiRoundProgressSummary,
} from '@/lib/riichiProgress';
import { recordThemeChallengeMatch } from '@/lib/themeChallenges';
import { randomSeed } from '@/lib/seededRandom';
import { getStorageDriver } from '@/lib/storage';
import { createUuid } from '@/lib/uuid';
import {
  type CharacterMoment,
  createCharacterMoments,
  isCutInMoment,
} from '../characterMoments';
import {
  applyEvent,
  createMatch,
  type OpponentSelection,
  type RiichiEffect,
  type RiichiEvent,
  type RiichiMatchState,
  type RiichiReplayFile,
  type RiichiRuleConfig,
  type RiichiSeatAiLevels,
  type RiichiSeatCharacters,
  selectSeatCharacters,
  undoLastHumanAction,
} from '../engine';
import {
  clearSavedMatch,
  hasSavedMatch,
  loadSavedMatch,
  saveMatch,
} from './persistence';

export type RiichiView = 'rules' | 'game';

/** 自家当前决策的计时起点；key 区分不同的决策点 */
export interface DecisionClock {
  key: string;
  startedAt: number;
  pausedAt?: number;
}

type RiichiStore = {
  view: RiichiView;
  matchLength: 'east' | 'south';
  match: RiichiMatchState | null;
  showGuide: boolean;
  showMenu: boolean;
  decisionClock: DecisionClock | null;
  processedProgress: string[];
  replay: RiichiReplayFile | null;
  playerCharacterId: string;
  sessionId: string;
  themeChallengeEligible: boolean;
  identityEpoch: number;
  onlinePending: boolean;
  moments: CharacterMoment[];
  cutIns: CharacterMoment[];
  resetForIdentity: () => void;
  refreshOnlineMatch: () => Promise<void>;
  expireMoment: (id: string) => void;
  finishCutIn: (id: string) => void;
  clearCutIns: () => void;
  setView: (view: RiichiView) => void;
  setMatchLength: (matchLength: 'east' | 'south') => void;
  setShowGuide: (show: boolean) => void;
  setShowMenu: (show: boolean) => void;
  setDecisionClock: (clock: DecisionClock | null) => void;
  openReplay: (file: RiichiReplayFile | null) => void;
  startMatch: (options?: {
    ranked?: RankedTicket;
    seed?: number;
    rules?: Partial<RiichiRuleConfig>;
    seatCharacters?: RiichiSeatCharacters;
    seatAiLevels?: Partial<RiichiSeatAiLevels>;
    opponentSelection?: OpponentSelection;
  }) => Promise<void>;
  dispatch: (event: RiichiEvent) => Promise<boolean>;
  undo: () => boolean;
  resumeSaved: () => Promise<boolean>;
  abandonRanked: () => Promise<boolean>;
};

type EffectListener = (effects: RiichiEffect[]) => void;
const effectListeners = new Set<EffectListener>();

function memberBridge() {
  if (!getStorageDriver()) return null;
  const bridge = getRiichiOnlineBridge();
  if (!bridge) throw new Error('Member match service is unavailable');
  return bridge;
}

export function subscribeRiichiEffects(listener: EffectListener): () => void {
  effectListeners.add(listener);
  return () => effectListeners.delete(listener);
}

/** 进度副作用按 对局种子 + 局号 + 事件 去重，回退重做或重复回调都不会重复计入 */
function processProgress(
  match: RiichiMatchState,
  effects: RiichiEffect[],
  processed: string[],
  session: { sessionId: string; playerCharacterId: string; themeChallengeEligible: boolean },
): string[] {
  let next = processed;
  for (const effect of effects) {
    if (effect.type !== 'progress') continue;
    const key = `${match.seed}:${effect.key}`;
    if (next.includes(key)) continue;
    next = [...next, key].slice(-400);
    try {
      recordRiichiProgressEvent(effect.event);
    } catch {
      // 成长系统写入失败不影响对局
    }
  }
  if (match.status === 'matchEnd' && match.matchEnd && !match.ranked) {
    const key = `${match.seed}:finish-match`;
    if (!next.includes(key)) {
      try {
        recordRiichiMatchFinish(
          match.matchEnd.ranking.indexOf(0) + 1,
          match.matchLength,
          session.sessionId,
        );
        recordCharacterMatchFinish({
          matchId: session.sessionId,
          characterId: session.playerCharacterId,
          opponents: match.seatCharacters.slice(1) as string[],
          ranking: match.matchEnd.ranking,
        });
        next = [...next, key].slice(-400);
      } catch {
        // A failed wallet write must not interrupt the match.
      }
    }
  }
  if (session.themeChallengeEligible && match.status === 'matchEnd' && match.matchEnd) {
    const key = `${match.seed}:theme-challenges`;
    if (!next.includes(key)) {
      try {
        recordThemeChallengeMatch(
          match,
          session.sessionId,
          match.ranked ? 'ai-ranked' : 'free',
        );
        next = [...next, key].slice(-400);
      } catch {
        // Challenge rewards are optional progress and must not interrupt a match.
      }
    }
  }
  return next;
}

function emit(effects: RiichiEffect[]): void {
  if (effects.length === 0) return;
  for (const listener of effectListeners) listener(effects);
}

export const useRiichiStore = createWithEqualityFn<RiichiStore>()(
  (set, get) => {
    const changeVisibility = (
      changes: Partial<
        Pick<
          RiichiStore,
          | 'view'
          | 'showGuide'
          | 'showMenu'
          | 'replay'
          | 'cutIns'
          | 'moments'
          | 'match'
          | 'processedProgress'
          | 'decisionClock'
          | 'matchLength'
          | 'playerCharacterId'
          | 'sessionId'
          | 'themeChallengeEligible'
        >
      >,
    ) => {
      const state = { ...get(), ...changes };
      const paused =
        state.view !== 'game' ||
        state.showGuide ||
        state.showMenu ||
        state.replay !== null ||
        state.cutIns.length > 0;
      const clock = state.decisionClock;
      const now = Date.now();
      const decisionClock = !clock
        ? null
        : paused
          ? { ...clock, pausedAt: clock.pausedAt ?? now }
          : clock.pausedAt === undefined
            ? clock
            : {
                key: clock.key,
                startedAt: clock.startedAt + now - clock.pausedAt,
              };
      set({ ...changes, decisionClock });
    };
    const presentation = (
      match: RiichiMatchState,
      effects: RiichiEffect[],
      playerCharacterId: string,
      reset = false,
    ) => {
      const incoming = createCharacterMoments(
        match,
        effects,
        playerCharacterId,
      );
      const replacedSeats = new Set(incoming.map((moment) => moment.seat));
      return {
        moments: [
          ...(reset
            ? []
            : get().moments.filter(
                (moment) => !replacedSeats.has(moment.seat),
              )),
          ...incoming,
        ],
        cutIns:
          getPlayerProfile().riichiSettings.presentation === 'off'
            ? []
            : [
                ...(reset ? [] : get().cutIns),
                ...incoming.filter(isCutInMoment),
              ],
      };
    };
    return {
      view: 'rules',
      matchLength: 'east',
      match: null,
      showGuide: false,
      showMenu: false,
      decisionClock: null,
      processedProgress: [],
      replay: null,
      playerCharacterId: getPlayerCharacterState().activeCharacterId,
      sessionId: '',
      themeChallengeEligible: false,
      identityEpoch: 0,
      onlinePending: false,
      moments: [],
      cutIns: [],
      resetForIdentity: () => {
        resetCurrentRiichiRoundProgressSummary();
        set({
          view: 'rules',
          matchLength: 'east',
          match: null,
          showGuide: false,
          showMenu: false,
          decisionClock: null,
          processedProgress: [],
          replay: null,
          playerCharacterId: getPlayerCharacterState().activeCharacterId,
          sessionId: '',
          themeChallengeEligible: false,
          identityEpoch: get().identityEpoch + 1,
          onlinePending: false,
          moments: [],
          cutIns: [],
        });
      },
      refreshOnlineMatch: async () => {
        let bridge;
        try {
          bridge = memberBridge();
        } catch {
          return;
        }
        if (!bridge) return;
        const currentSessionId = get().sessionId;
        const identityEpoch = get().identityEpoch;
        try {
          const current = await bridge.current();
          if (!getStorageDriver() || get().sessionId !== currentSessionId ||
            get().identityEpoch !== identityEpoch) return;
          if (current.match && current.matchId && current.playerCharacterId) {
            changeVisibility({
              match: current.match,
              matchLength: current.match.matchLength,
              sessionId: current.matchId,
              playerCharacterId: current.playerCharacterId,
              processedProgress: [],
            });
          } else if (get().view === 'rules') {
            changeVisibility({ match: null, sessionId: '' });
          }
        } catch {
          // The household error handler owns authentication and retry messaging.
        }
      },
      expireMoment: (id) =>
        set({ moments: get().moments.filter((moment) => moment.id !== id) }),
      finishCutIn: (id) => {
        if (get().cutIns[0]?.id !== id) return;
        changeVisibility({ cutIns: get().cutIns.slice(1) });
      },
      clearCutIns: () => changeVisibility({ cutIns: [] }),
      setView: (view) =>
        changeVisibility({
          view,
          ...(view === 'rules' ? { cutIns: [], moments: [] } : {}),
        }),
      setMatchLength: (matchLength) => set({ matchLength }),
      setShowGuide: (showGuide) => changeVisibility({ showGuide }),
      setShowMenu: (showMenu) => changeVisibility({ showMenu }),
      setDecisionClock: (decisionClock) => set({ decisionClock }),
      openReplay: (replay) => {
        if (get().match?.ranked && get().match?.status !== 'matchEnd' && replay)
          return;
        changeVisibility({ replay, cutIns: [], moments: [] });
      },
      startMatch: async (options) => {
        // UI 必须先确认并结算旧段位战，不能直接覆盖正在进行的存档。
        const rankedState = getRankedState();
        if (rankedState.activeMatchId)
          throw new Error('Ranked match still active');
        const bridge = memberBridge();
        if (bridge) {
          const identityEpoch = get().identityEpoch;
          set({ onlinePending: true });
          try {
            const response = await bridge.start({
              matchId: options?.ranked?.id ?? createUuid(),
              source: options?.ranked ? 'ai-ranked' : 'free',
              matchLength: options?.ranked?.matchLength ?? get().matchLength,
              aiLevel: options?.rules?.aiLevel,
              opponents: options?.seatCharacters?.slice(1) ?? options?.opponentSelection,
            });
            if (!getStorageDriver() || get().identityEpoch !== identityEpoch) return;
            resetCurrentRiichiRoundProgressSummary();
            changeVisibility({
              match: response.match,
              matchLength: response.match.matchLength,
              processedProgress: [],
              decisionClock: null,
              view: 'game',
              showMenu: false,
              playerCharacterId: response.playerCharacterId,
              sessionId: response.matchId,
              themeChallengeEligible: true,
              ...presentation(response.match, response.effects,
                response.playerCharacterId, true),
            });
            emit(response.effects);
          } finally {
            set({ onlinePending: false });
          }
          return;
        }
        const seed = options?.seed ?? randomSeed();
        const ticket = options?.ranked;
        const playerCharacterId =
          ticket?.characterId ?? getPlayerCharacterState().activeCharacterId;
        const sessionId = ticket?.id ?? `free:${createUuid()}`;
        const { match, effects } = createMatch({
          seed: ticket?.seed ?? seed,
          matchLength: ticket?.matchLength ?? get().matchLength,
          ranked: ticket,
          rules: options?.rules,
          seatAiLevels: options?.seatAiLevels,
          seatCharacters: selectSeatCharacters(
            seed,
            playerCharacterId,
            options?.seatCharacters?.slice(1) ?? options?.opponentSelection,
          ),
        });
        if (ticket)
          saveRankedState({
            ...rankedState,
            activeMatchId: ticket.id,
            activeTicket: ticket,
          });
        try {
          markCharactersEncountered([
            playerCharacterId,
            ...(match.seatCharacters.slice(1) as string[]),
          ]);
        } catch {
          /* Progress storage must not block play. */
        }
        const processedProgress = processProgress(match, effects, [], {
          sessionId,
          playerCharacterId,
          themeChallengeEligible: true,
        });
        changeVisibility({
          match,
          matchLength: match.matchLength,
          processedProgress,
          decisionClock: null,
          view: 'game',
          showMenu: false,
          playerCharacterId,
          sessionId,
          themeChallengeEligible: true,
          ...presentation(match, effects, playerCharacterId, true),
        });
        saveMatch(match, processedProgress, { sessionId, playerCharacterId, themeChallengeEligible: true });
        emit(effects);
      },
      dispatch: async (event) => {
        const current = get().match;
        if (!current || get().cutIns.length > 0 || get().onlinePending) return false;
        const bridge = memberBridge();
        if (bridge) {
          const matchId = get().sessionId;
          const identityEpoch = get().identityEpoch;
          if (!matchId) return false;
          set({ onlinePending: true });
          try {
            const response = await bridge.event({ matchId,
              expectedTurn: current.turn, event });
            if (get().sessionId !== matchId || !getStorageDriver() ||
              get().identityEpoch !== identityEpoch) return false;
            changeVisibility({
              match: response.match,
              processedProgress: [],
              ...presentation(response.match, response.effects,
                get().playerCharacterId),
            });
            emit(response.effects);
            return true;
          } catch {
            if (get().sessionId === matchId && get().identityEpoch === identityEpoch)
              await get().refreshOnlineMatch();
            return false;
          } finally {
            set({ onlinePending: false });
          }
        }
        const step = applyEvent(current, event);
        if (!step) return false;
        if (
          current.ranked &&
          getRankedState().activeMatchId !== current.ranked.id
        )
          return false;
        const processedProgress = processProgress(
          step.match,
          step.effects,
          get().processedProgress,
          get(),
        );
        // 先保存终局事件；刷新时可以从同一收据继续完成结算。
        if (step.match.ranked && step.match.matchEnd) {
          saveMatch(step.match, processedProgress, get());
          settleRankedMatch(step.match.ranked, step.match.matchEnd.finalScores);
        }
        changeVisibility({
          match: step.match,
          processedProgress,
          ...presentation(step.match, step.effects, get().playerCharacterId),
        });
        saveMatch(step.match, processedProgress, get());
        emit(step.effects);
        return true;
      },
      undo: () => {
        const current = get().match;
        if (!current || current.ranked || getStorageDriver()) return false;
        const reverted = undoLastHumanAction(current);
        if (!reverted) return false;
        changeVisibility({
          match: reverted,
          decisionClock: null,
          cutIns: [],
          moments: [],
        });
        saveMatch(reverted, get().processedProgress, get());
        return true;
      },
      resumeSaved: async () => {
        const bridge = memberBridge();
        if (bridge) {
          try {
            const current = await bridge.current();
            if (!current.match || !current.matchId ||
              !current.playerCharacterId || !getStorageDriver()) return false;
            changeVisibility({
              match: current.match,
              matchLength: current.match.matchLength,
              processedProgress: [],
              decisionClock: null,
              view: 'game',
              showMenu: false,
              playerCharacterId: current.playerCharacterId,
              sessionId: current.matchId,
              themeChallengeEligible: false,
              cutIns: [],
              moments: [],
            });
            return true;
          } catch {
            return false;
          }
        }
        const saved = loadSavedMatch();
        if (!saved) return false;
        const playerCharacterId =
          saved.match.ranked?.characterId ??
          saved.playerCharacterId ??
          getPlayerCharacterState().activeCharacterId;
        let processedProgress = saved.processedProgress;
        if (saved.match.ranked) {
          const ranked = getRankedState();
          if (saved.match.status === 'matchEnd' && saved.match.matchEnd) {
            processedProgress = processProgress(
              saved.match,
              [],
              processedProgress,
              { sessionId: saved.sessionId, playerCharacterId, themeChallengeEligible: saved.themeChallengeEligible },
            );
            saveMatch(saved.match, processedProgress, {
              sessionId: saved.sessionId,
              playerCharacterId,
              themeChallengeEligible: saved.themeChallengeEligible,
            });
            if (
              !settleRankedMatch(
                saved.match.ranked,
                saved.match.matchEnd.finalScores,
              )
            )
              return false;
          } else if (ranked.activeMatchId !== saved.match.ranked.id)
            return false;
        }
        changeVisibility({
          match: { ...saved.match, turn: saved.match.turn + 1 },
          matchLength: saved.match.matchLength,
          processedProgress,
          decisionClock: null,
          view: 'game',
          showMenu: false,
          playerCharacterId,
          sessionId: saved.sessionId,
          themeChallengeEligible: saved.themeChallengeEligible,
          cutIns: [],
          moments: [],
        });
        return true;
      },
      abandonRanked: async () => {
        const ranked = getRankedState();
        if (!ranked.activeMatchId) return true;
        const bridge = memberBridge();
        if (bridge) {
          const matchId = ranked.activeMatchId;
          try {
            await bridge.forfeit(matchId);
            if (get().sessionId === matchId) {
              changeVisibility({ match: null, view: 'rules', cutIns: [],
                moments: [], decisionClock: null, replay: null,
                showMenu: false, showGuide: false, sessionId: '' });
            }
            return true;
          } catch {
            return false;
          }
        }
        const current =
          get().match?.ranked?.id === ranked.activeMatchId
            ? get().match
            : loadSavedMatch()?.match;
        const ticket = ranked.activeTicket ?? current?.ranked;
        if (!ticket) return false;
        const scores =
          current?.ranked?.id === ticket.id
            ? (current.matchEnd?.finalScores ??
              current.round.result?.settlement.newScores ??
              current.round.scores)
            : [25000, 25000, 25000, 25000];
        settleRankedMatch(ticket, scores, current?.status !== 'matchEnd');
        clearSavedMatch();
        changeVisibility({
          match: null,
          view: 'rules',
          cutIns: [],
          moments: [],
          decisionClock: null,
          replay: null,
          showMenu: false,
          showGuide: false,
        });
        return true;
      },
    };
  },
  shallow,
);

export function hasResumableMatch(): boolean {
  if (getStorageDriver()) {
    const match = useRiichiStore.getState().match;
    return match !== null && match.status !== 'matchEnd';
  }
  return hasSavedMatch();
}

export function discardSavedMatch(): void {
  clearSavedMatch();
}
