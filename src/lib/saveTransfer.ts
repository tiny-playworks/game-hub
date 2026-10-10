export interface SaveFile {
  app: 'game-hub';
  schema: 1;
  exportedAt: string;
  data: Record<string, string>;
}

function readSaveData(): Record<string, string> {
  const entries: [string, string][] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('game-hub-'))
      entries.push([key, localStorage.getItem(key) ?? '']);
  }
  return Object.fromEntries(entries);
}

export function createSaveFile(now = new Date()): SaveFile {
  return {
    app: 'game-hub',
    schema: 1,
    exportedAt: now.toISOString(),
    data: readSaveData(),
  };
}

export function parseSaveFile(text: string): SaveFile {
  const raw = JSON.parse(text) as Partial<SaveFile> | null;
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
  for (const key of Object.keys(readSaveData())) localStorage.removeItem(key);
}

export function importSaveFile(save: SaveFile): void {
  const validated = parseSaveFile(JSON.stringify(save));
  const previous = readSaveData();
  try {
    resetSaveData();
    for (const [key, value] of Object.entries(validated.data))
      localStorage.setItem(key, value);
  } catch (error) {
    resetSaveData();
    for (const [key, value] of Object.entries(previous))
      localStorage.setItem(key, value);
    throw error;
  }
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
