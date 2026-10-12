import {
  commitStorageChanges,
  getStorageStatus,
  readGameSaveData,
} from './storage';

export interface SaveFile {
  app: 'game-hub';
  schema: 1;
  exportedAt: string;
  data: Record<string, string>;
  recovery?: { partial: boolean; pendingCount: number };
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
        !key.startsWith('game-hub-') || typeof value !== 'string',
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
  commitStorageChanges(
    Object.fromEntries(Object.keys(readSaveData()).map((key) => [key, null])),
  );
}

export function importSaveFile(save: SaveFile): void {
  const validated = parseSaveFile(JSON.stringify(save));
  const removed = Object.fromEntries(
    Object.keys(readSaveData()).map((key) => [key, null]),
  );
  commitStorageChanges({ ...removed, ...validated.data });
}

export function downloadSaveFile(): void {
  const save = createSaveFile();
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `game-hub-save-${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/-/g, '')}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
