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

export function loadSavedMatch(): LoadedRiichiSave | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(RIICHI_SAVE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<RiichiSaveData>;
    const replay = data.replay;
    if (!isReplayFile(replay) || replay.version !== RIICHI_MATCH_VERSION)
      return null;
    const match = restoreMatch(replay);
    if (!match || match.status === 'matchEnd') return null;
    return {
      match,
      processedProgress: Array.isArray(data.processedProgress)
        ? data.processedProgress
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
    return isReplayFile((JSON.parse(raw) as Partial<RiichiSaveData>).replay);
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
