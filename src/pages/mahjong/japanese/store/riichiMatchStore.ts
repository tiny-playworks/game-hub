import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { getPlayerCharacterState } from '@/lib/playerCharacters';
import { getPlayerProfile } from '@/lib/playerProfile';
import {
  recordRiichiMatchFinish,
  recordRiichiProgressEvent,
} from '@/lib/riichiProgress';
import { randomSeed } from '@/lib/seededRandom';
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
  moments: CharacterMoment[];
  cutIns: CharacterMoment[];
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
    seed?: number;
    rules?: Partial<RiichiRuleConfig>;
    seatCharacters?: RiichiSeatCharacters;
    opponentSelection?: OpponentSelection;
  }) => void;
  dispatch: (event: RiichiEvent) => boolean;
  undo: () => boolean;
  resumeSaved: () => boolean;
};

type EffectListener = (effects: RiichiEffect[]) => void;
const effectListeners = new Set<EffectListener>();

export function subscribeRiichiEffects(listener: EffectListener): () => void {
  effectListeners.add(listener);
  return () => effectListeners.delete(listener);
}

/** 进度副作用按 对局种子 + 局号 + 事件 去重，回退重做或重复回调都不会重复计入 */
function processProgress(
  match: RiichiMatchState,
  effects: RiichiEffect[],
  processed: string[],
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
  if (match.status === 'matchEnd' && match.matchEnd) {
    const key = `${match.seed}:finish-match`;
    if (!next.includes(key)) {
      try {
        recordRiichiMatchFinish(
          match.matchEnd.ranking.indexOf(0) + 1,
          match.matchLength,
        );
        next = [...next, key].slice(-400);
      } catch {
        // A failed wallet write must not interrupt the match.
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
      moments: [],
      cutIns: [],
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
      openReplay: (replay) =>
        changeVisibility({ replay, cutIns: [], moments: [] }),
      startMatch: (options) => {
        const seed = options?.seed ?? randomSeed();
        const playerCharacterId = getPlayerCharacterState().activeCharacterId;
        const { match, effects } = createMatch({
          seed,
          matchLength: get().matchLength,
          rules: options?.rules,
          seatCharacters: selectSeatCharacters(
            seed,
            playerCharacterId,
            options?.seatCharacters?.slice(1) ?? options?.opponentSelection,
          ),
        });
        const processedProgress = processProgress(match, effects, []);
        changeVisibility({
          match,
          processedProgress,
          decisionClock: null,
          view: 'game',
          showMenu: false,
          playerCharacterId,
          ...presentation(match, effects, playerCharacterId, true),
        });
        saveMatch(match, processedProgress);
        emit(effects);
      },
      dispatch: (event) => {
        const current = get().match;
        if (!current || get().cutIns.length > 0) return false;
        const step = applyEvent(current, event);
        if (!step) return false;
        const processedProgress = processProgress(
          step.match,
          step.effects,
          get().processedProgress,
        );
        changeVisibility({
          match: step.match,
          processedProgress,
          ...presentation(step.match, step.effects, get().playerCharacterId),
        });
        saveMatch(step.match, processedProgress);
        emit(step.effects);
        return true;
      },
      undo: () => {
        const current = get().match;
        if (!current) return false;
        const reverted = undoLastHumanAction(current);
        if (!reverted) return false;
        changeVisibility({
          match: reverted,
          decisionClock: null,
          cutIns: [],
          moments: [],
        });
        saveMatch(reverted, get().processedProgress);
        return true;
      },
      resumeSaved: () => {
        const saved = loadSavedMatch();
        if (!saved) return false;
        changeVisibility({
          match: { ...saved.match, turn: saved.match.turn + 1 },
          matchLength: saved.match.matchLength,
          processedProgress: saved.processedProgress,
          decisionClock: null,
          view: 'game',
          showMenu: false,
          playerCharacterId: getPlayerCharacterState().activeCharacterId,
          cutIns: [],
          moments: [],
        });
        return true;
      },
    };
  },
  shallow,
);

export function hasResumableMatch(): boolean {
  return hasSavedMatch();
}

export function discardSavedMatch(): void {
  clearSavedMatch();
}
