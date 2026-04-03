export const PLAYER_PROFILE_STORAGE_KEY = 'game-hub-player-profile';
export const PLAYER_NICKNAME_MAX_LENGTH = 16;
export const PLAYER_NICKNAME_FALLBACK = '牌友';

export type PlayerAvatarMode = 'preset' | 'upload';

export interface PlayerProfile {
  nickname: string;
  avatarMode: PlayerAvatarMode;
  avatarPresetId: string;
  avatarUploadDataUrl: string | null;
  activeTitle: string | null;
  updatedAt: number;
}

export interface AvatarPreset {
  id: string;
  label: string;
  bgClass: string;
  fgClass: string;
  glyph: string;
}

export const PLAYER_AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'pine',
    label: '松',
    bgClass: 'bg-emerald-700',
    fgClass: 'text-emerald-50',
    glyph: '松',
  },
  {
    id: 'sun',
    label: '日',
    bgClass: 'bg-amber-600',
    fgClass: 'text-amber-50',
    glyph: '日',
  },
  {
    id: 'wave',
    label: '波',
    bgClass: 'bg-sky-700',
    fgClass: 'text-sky-50',
    glyph: '波',
  },
  {
    id: 'moon',
    label: '月',
    bgClass: 'bg-violet-700',
    fgClass: 'text-violet-50',
    glyph: '月',
  },
  {
    id: 'wind',
    label: '风',
    bgClass: 'bg-slate-700',
    fgClass: 'text-slate-50',
    glyph: '风',
  },
  {
    id: 'bamboo',
    label: '竹',
    bgClass: 'bg-lime-700',
    fgClass: 'text-lime-50',
    glyph: '竹',
  },
];

export interface SquareCropBox {
  x: number;
  y: number;
  size: number;
}

function getDefaultPresetId(): string {
  return PLAYER_AVATAR_PRESETS[0]?.id ?? 'pine';
}

export function sanitizeNickname(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return PLAYER_NICKNAME_FALLBACK;
  const chars = Array.from(trimmed);
  return chars.slice(0, PLAYER_NICKNAME_MAX_LENGTH).join('');
}

export function createDefaultPlayerProfile(): PlayerProfile {
  return {
    nickname: PLAYER_NICKNAME_FALLBACK,
    avatarMode: 'preset',
    avatarPresetId: getDefaultPresetId(),
    avatarUploadDataUrl: null,
    activeTitle: null,
    updatedAt: Date.now(),
  };
}

function normalizePlayerProfile(raw: unknown): PlayerProfile {
  const defaults = createDefaultPlayerProfile();
  if (!raw || typeof raw !== 'object') return defaults;
  const parsed = raw as Partial<PlayerProfile>;
  const avatarPresetExists = PLAYER_AVATAR_PRESETS.some(
    (preset) => preset.id === parsed.avatarPresetId,
  );
  const avatarPresetId = avatarPresetExists
    ? (parsed.avatarPresetId as string)
    : defaults.avatarPresetId;
  const avatarUploadDataUrl =
    typeof parsed.avatarUploadDataUrl === 'string' &&
    parsed.avatarUploadDataUrl.startsWith('data:image/')
      ? parsed.avatarUploadDataUrl
      : null;
  const avatarMode: PlayerAvatarMode =
    parsed.avatarMode === 'upload' && avatarUploadDataUrl ? 'upload' : 'preset';
  return {
    nickname:
      typeof parsed.nickname === 'string'
        ? sanitizeNickname(parsed.nickname)
        : defaults.nickname,
    avatarMode,
    avatarPresetId,
    avatarUploadDataUrl,
    activeTitle:
      typeof parsed.activeTitle === 'string' ? parsed.activeTitle : null,
    updatedAt:
      typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : defaults.updatedAt,
  };
}

export function getPlayerProfile(): PlayerProfile {
  if (typeof localStorage === 'undefined') return createDefaultPlayerProfile();
  try {
    const raw = localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY);
    if (!raw) return createDefaultPlayerProfile();
    return normalizePlayerProfile(JSON.parse(raw));
  } catch {
    return createDefaultPlayerProfile();
  }
}

export function savePlayerProfile(profile: PlayerProfile): PlayerProfile {
  const normalized = normalizePlayerProfile({
    ...profile,
    updatedAt: Date.now(),
  });
  if (typeof localStorage === 'undefined') return normalized;
  localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function updatePlayerProfile(
  patch: Partial<Omit<PlayerProfile, 'updatedAt'>>,
): PlayerProfile {
  const current = getPlayerProfile();
  return savePlayerProfile({
    ...current,
    ...patch,
  });
}

export function getAvatarPresetById(id: string): AvatarPreset {
  return (
    PLAYER_AVATAR_PRESETS.find((preset) => preset.id === id) ??
    PLAYER_AVATAR_PRESETS[0]
  );
}

export function getAvatarInitial(nickname: string): string {
  const text = sanitizeNickname(nickname);
  return Array.from(text)[0] ?? PLAYER_NICKNAME_FALLBACK;
}

export function getCenterSquareCrop(
  width: number,
  height: number,
): SquareCropBox {
  const size = Math.max(1, Math.min(width, height));
  const x = Math.max(0, Math.floor((width - size) / 2));
  const y = Math.max(0, Math.floor((height - size) / 2));
  return { x, y, size };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('读取图片失败'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error('图片加载失败'));
    image.onload = () => resolve(image);
    image.src = dataUrl;
  });
}

export async function cropImageDataUrlToSquare(
  dataUrl: string,
  outputSize = 256,
): Promise<string> {
  const image = await loadImage(dataUrl);
  const crop = getCenterSquareCrop(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建画布');
  context.clearRect(0, 0, outputSize, outputSize);
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.size,
    crop.size,
    0,
    0,
    outputSize,
    outputSize,
  );
  return canvas.toDataURL('image/png');
}

export async function cropImageFileToSquareDataUrl(
  file: File,
  outputSize = 256,
): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  return cropImageDataUrlToSquare(dataUrl, outputSize);
}
