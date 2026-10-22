import { JOURNEY_CONTENT_VERSION, isJourneyStageId, isJourneyVariation, isJourneyAttemptId, type JourneyAttemptInput } from '../../shared/contracts/journey';

/** Device-local play positions, never part of a member snapshot or migration. */
export const LOCAL_RESUME_PREFIX = 'game-hub-device-resume-v1:';
export const LOCAL_RESUME_CHANGED = 'game-hub:local-resume';
const MAX_SAVE_LENGTH = 2_000_000;
const unreadKeys = new Set<string>();

export interface LocalResume<T = unknown> {
  schema: 1;
  owner: string;
  slot: string;
  updatedAt: number;
  data: T;
}

export interface JourneyResume {
  kind: 'journey';
  input: JourneyAttemptInput;
}
export function isJourneyResume(value: unknown): value is JourneyResume {
  if (!value || typeof value !== 'object') return false;
  const save = value as Partial<JourneyResume>;
  return save.kind === 'journey' && !!save.input &&
    save.input.contentVersion === JOURNEY_CONTENT_VERSION && isJourneyStageId(save.input.stageId) &&
    isJourneyAttemptId(save.input.attemptId) &&
    (save.input.variation === undefined || isJourneyVariation(save.input.variation)) && !!save.input.replay;
}
export const journeyResumeSlot = (stage: string, variation?: string) => `journey:${stage}:${variation ?? 'main'}`;

export function resumeOwner(memberId?: string | null): string {
  return memberId ? `member:${memberId}` : 'guest';
}

function keyFor(owner: string, slot: string): string {
  return `${LOCAL_RESUME_PREFIX}${encodeURIComponent(owner)}:${slot}`;
}

export function readLocalResume<T = unknown>(owner: string, slot: string): LocalResume<T> | null {
  const key = keyFor(owner, slot);
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > MAX_SAVE_LENGTH) return null;
    const value = JSON.parse(raw) as LocalResume<T>;
    return value?.schema === 1 && value.owner === owner && value.slot === slot &&
      Number.isFinite(value.updatedAt) && value.updatedAt > 0 && value.data != null
      ? value : null;
  } catch {
    // Never overwrite a position that this page could not read.
    unreadKeys.add(key);
    return null;
  }
}

export function writeLocalResume(owner: string, slot: string, data: unknown): boolean {
  const key = keyFor(owner, slot);
  if (unreadKeys.has(key)) return false;
  try {
    const value = JSON.stringify({ schema: 1, owner, slot, updatedAt: Date.now(), data });
    if (value.length > MAX_SAVE_LENGTH) return false;
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event(LOCAL_RESUME_CHANGED));
    return true;
  } catch {
    return false;
  }
}

export function removeLocalResume(owner: string, slot: string): boolean {
  try {
    const key = keyFor(owner, slot);
    localStorage.removeItem(key);
    unreadKeys.delete(key);
    window.dispatchEvent(new Event(LOCAL_RESUME_CHANGED));
    return true;
  } catch {
    return false;
  }
}

export function listLocalResumes(owner: string): LocalResume[] {
  try {
    const prefix = keyFor(owner, '');
    const saves: LocalResume[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const save = readLocalResume(owner, key.slice(prefix.length));
      if (save) saves.push(save);
    }
    return saves.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function clearLocalResumes(owner: string): void {
  const prefix = keyFor(owner, '');
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
  for (const key of unreadKeys) if (key.startsWith(prefix)) unreadKeys.delete(key);
  window.dispatchEvent(new Event(LOCAL_RESUME_CHANGED));
}
