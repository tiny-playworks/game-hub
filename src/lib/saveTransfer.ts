import {
  commitStorageChanges,
  getStorageDriver,
  getStorageStatus,
  readGameSaveData,
} from './storage';
import type { MemberSnapshot } from '../../shared/contracts/member';
import { LOCAL_RESUME_PREFIX, localResumeRemovalChanges } from './localResume';

export interface SaveFile {
  app: 'game-hub';
  schema: 1;
  exportedAt: string;
  data: Record<string, string>;
  recovery?: { partial: boolean; pendingCount: number };
}

export interface MemberBackupFile {
  app: 'game-hub';
  schema: 2;
  exportedAt: string;
  memberId: string;
  snapshot: MemberSnapshot;
}

export class PartialSaveError extends Error {
  override readonly name = 'PartialSaveError';
}

function readSaveData(): Record<string, string> {
  return readGameSaveData();
}

export function createSaveFile(now = new Date()): SaveFile {
  const data = readSaveData();
  const status = getStorageStatus();
  return {
    app: 'game-hub',
    schema: 1,
    exportedAt: now.toISOString(),
    data,
    ...(status.failed || status.pendingCount
      ? {
          recovery: {
            partial: status.readFailed || status.conflicted,
            pendingCount: status.pendingCount,
          },
        }
      : {}),
  };
}

/** Read the browser's guest data even while a member snapshot is the active driver. */
export function createGuestSaveFile(now = new Date()): SaveFile {
  const data: Record<string, string> = {};
  try {
    const source = globalThis.localStorage;
    if (!source) throw new PartialSaveError('Guest storage is unavailable');
    for (let index = 0; index < source.length; index++) {
      const key = source.key(index);
      if (!key?.startsWith('game-hub-') || key === 'game-hub-device-id' || key.startsWith(LOCAL_RESUME_PREFIX))
        continue;
      const value = source.getItem(key);
      if (value !== null) data[key] = value;
    }
  } catch {
    throw new PartialSaveError('Guest save could not be read completely');
  }
  if (getStorageDriver() === null) {
    const status = getStorageStatus();
    if (status.readFailed || status.conflicted || status.pendingCount > 0)
      throw new PartialSaveError('Guest save has unsaved changes');
  }
  return { app: 'game-hub', schema: 1, exportedAt: now.toISOString(), data };
}

export function createMemberBackupFile(
  snapshot: MemberSnapshot,
  now = new Date(),
): MemberBackupFile {
  return {
    app: 'game-hub',
    schema: 2,
    exportedAt: now.toISOString(),
    memberId: snapshot.memberId,
    snapshot,
  };
}

export function parseSaveFile(text: string): SaveFile {
  const raw = JSON.parse(text) as Partial<SaveFile> | null;
  if (raw?.recovery?.partial === true)
    throw new PartialSaveError('Incomplete recovery backup');
  if (
    raw?.app !== 'game-hub' ||
    raw.schema !== 1 ||
    typeof raw.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(raw.exportedAt)) ||
    !raw.data ||
    typeof raw.data !== 'object' ||
    Array.isArray(raw.data) ||
    Object.entries(raw.data).some(
      ([key, value]) =>
        !key.startsWith('game-hub-') || key.startsWith(LOCAL_RESUME_PREFIX) || typeof value !== 'string',
    )
  ) {
    throw new Error('Invalid Game Hub save');
  }
  return {
    app: 'game-hub',
    schema: 1,
    exportedAt: raw.exportedAt,
    data: raw.data,
  };
}

export function resetSaveData(): void {
  commitStorageChanges({
    ...Object.fromEntries(Object.keys(readSaveData()).map((key) => [key, null])),
    ...(getStorageDriver() === null ? localResumeRemovalChanges('guest') : {}),
  });
}

export function importSaveFile(save: SaveFile): void {
  const validated = parseSaveFile(JSON.stringify(save));
  const removed = Object.fromEntries(
    Object.keys(readSaveData()).map((key) => [key, null]),
  );
  commitStorageChanges({ ...removed, ...validated.data,
    ...(getStorageDriver() === null ? localResumeRemovalChanges('guest') : {}),
  });
}

function downloadJsonFile(value: unknown, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function backupDate(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/-/g, '');
}

export function downloadSaveFile(save = createSaveFile()): void {
  downloadJsonFile(save, `game-hub-save-${backupDate()}.json`);
}

export function downloadMemberBackup(snapshot: MemberSnapshot): void {
  downloadJsonFile(
    createMemberBackupFile(snapshot),
    `game-hub-member-${backupDate()}.json`,
  );
}
