import {
  isReplayFile,
  RIICHI_MATCH_VERSION,
  type RiichiMatchState,
  type RiichiReplayFile,
  restoreMatch,
  toReplayFile,
} from '../engine/match';

export const RIICHI_SAVE_STORAGE_KEY = 'game-hub-riichi-save-v1';
export const RIICHI_LAST_REPLAY_STORAGE_KEY = 'game-hub-riichi-last-replay-v1';

export interface RiichiSaveData {
  replay: RiichiReplayFile;
  processedProgress: string[];
  savedAt: number;
}

export interface LoadedRiichiSave {
  match: RiichiMatchState;
  processedProgress: string[];
  savedAt: number;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function savedReplay(data: unknown): RiichiReplayFile | null {
  if (!data || typeof data !== 'object') return null;
  const saved = data as Record<string, unknown>;
  if (isReplayFile(saved.replay)) return saved.replay;
  // 阶段 1 存档曾包含完整快照；只取事件字段重放，避免依赖旧状态结构。
  const legacy = saved.match as Partial<RiichiMatchState> | undefined;
  if (!legacy || typeof legacy !== 'object') return null;
  const replay = {
    version: legacy.version,
    seed: legacy.seed,
    rules: legacy.rules,
    matchLength: legacy.matchLength,
    events: legacy.events,
  };
  return isReplayFile(replay) ? replay : null;
}

export function loadSavedMatch(): LoadedRiichiSave | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(RIICHI_SAVE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<RiichiSaveData>;
    const replay = savedReplay(data);
    if (!isReplayFile(replay) || replay.version !== RIICHI_MATCH_VERSION)
      return null;
    const match = restoreMatch(replay);
    if (!match || match.status === 'matchEnd') return null;
    return {
      match,
      processedProgress: Array.isArray(data.processedProgress)
        ? data.processedProgress.filter(
            (key): key is string => typeof key === 'string',
          )
        : [],
      savedAt: typeof data.savedAt === 'number' ? data.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function hasSavedMatch(): boolean {
  try {
    const raw = storage()?.getItem(RIICHI_SAVE_STORAGE_KEY);
    if (!raw) return false;
    return savedReplay(JSON.parse(raw)) !== null;
  } catch {
    return false;
  }
}

export function saveMatch(
  match: RiichiMatchState,
  processedProgress: string[],
): void {
  const s = storage();
  if (!s) return;
  try {
    if (match.status === 'matchEnd') {
      s.removeItem(RIICHI_SAVE_STORAGE_KEY);
      saveLastReplay({
        version: match.version,
        seed: match.seed,
        matchLength: match.matchLength,
        rules: match.rules,
        events: match.events,
      });
      return;
    }
    const data: RiichiSaveData = {
      replay: toReplayFile(match),
      processedProgress,
      savedAt: Date.now(),
    };
    s.setItem(RIICHI_SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 存储已满或被禁用时忽略，不影响对局
  }
}

export function clearSavedMatch(): void {
  storage()?.removeItem(RIICHI_SAVE_STORAGE_KEY);
}

export function saveLastReplay(file: RiichiReplayFile): void {
  try {
    storage()?.setItem(RIICHI_LAST_REPLAY_STORAGE_KEY, JSON.stringify(file));
  } catch {
    // ignore
  }
}

export function loadLastReplay(): RiichiReplayFile | null {
  try {
    const raw = storage()?.getItem(RIICHI_LAST_REPLAY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isReplayFile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
