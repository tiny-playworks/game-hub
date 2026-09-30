import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { recordRiichiProgressEvent } from '@/lib/riichiProgress';
import { randomSeed } from '@/lib/seededRandom';
import {
  applyEvent,
  createMatch,
  type RiichiEffect,
  type RiichiEvent,
  type RiichiMatchState,
  type RiichiReplayFile,
  type RiichiRuleConfig,
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
  setView: (view: RiichiView) => void;
  setMatchLength: (matchLength: 'east' | 'south') => void;
  setShowGuide: (show: boolean) => void;
  setShowMenu: (show: boolean) => void;
  setDecisionClock: (clock: DecisionClock | null) => void;
  openReplay: (file: RiichiReplayFile | null) => void;
  startMatch: (options?: {
    seed?: number;
    rules?: Partial<RiichiRuleConfig>;
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
        Pick<RiichiStore, 'view' | 'showGuide' | 'showMenu' | 'replay'>
      >,
    ) => {
      const state = { ...get(), ...changes };
      const paused =
        state.view !== 'game' ||
        state.showGuide ||
        state.showMenu ||
        state.replay !== null;
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
    return {
      view: 'rules',
      matchLength: 'east',
      match: null,
      showGuide: false,
      showMenu: false,
      decisionClock: null,
      processedProgress: [],
      replay: null,
      setView: (view) => changeVisibility({ view }),
      setMatchLength: (matchLength) => set({ matchLength }),
      setShowGuide: (showGuide) => changeVisibility({ showGuide }),
      setShowMenu: (showMenu) => changeVisibility({ showMenu }),
      setDecisionClock: (decisionClock) => set({ decisionClock }),
      openReplay: (replay) => changeVisibility({ replay }),
      startMatch: (options) => {
        const { match, effects } = createMatch({
          seed: options?.seed ?? randomSeed(),
          matchLength: get().matchLength,
          rules: options?.rules,
        });
        const processedProgress = processProgress(match, effects, []);
        set({
          match,
          processedProgress,
          decisionClock: null,
          view: 'game',
          showMenu: false,
        });
        saveMatch(match, processedProgress);
        emit(effects);
      },
      dispatch: (event) => {
        const current = get().match;
        if (!current) return false;
        const step = applyEvent(current, event);
        if (!step) return false;
        const processedProgress = processProgress(
          step.match,
          step.effects,
          get().processedProgress,
        );
        set({ match: step.match, processedProgress });
        saveMatch(step.match, processedProgress);
        emit(step.effects);
        return true;
      },
      undo: () => {
        const current = get().match;
        if (!current) return false;
        const reverted = undoLastHumanAction(current);
        if (!reverted) return false;
        set({ match: reverted, decisionClock: null });
        saveMatch(reverted, get().processedProgress);
        return true;
      },
      resumeSaved: () => {
        const saved = loadSavedMatch();
        if (!saved) return false;
        set({
          match: { ...saved.match, turn: saved.match.turn + 1 },
          matchLength: saved.match.matchLength,
          processedProgress: saved.processedProgress,
          decisionClock: null,
          view: 'game',
          showMenu: false,
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
