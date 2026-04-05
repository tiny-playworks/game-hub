import { getPlayerStats } from '@/lib/playerStats';

export const PLAYER_CHARACTER_STORAGE_KEY = 'game-hub-player-characters';
export const CHARACTER_AFFINITY_THRESHOLDS = [5, 15, 30] as const;

export interface CharacterUnlockRule {
  type: 'default' | 'riichi-rounds' | 'riichi-wins';
  target: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  unlockRule: CharacterUnlockRule;
}

export interface PlayerCharacterState {
  activeCharacterId: string;
  unlockedCharacterIds: string[];
  affinityByCharacter: Record<string, number>;
  updatedAt: number;
}

export interface CharacterAffinityProgress {
  state: PlayerCharacterState;
  character: CharacterDef;
  previousAffinity: number;
  currentAffinity: number;
  previousStage: number;
  currentStage: number;
  newlyUnlockedCharacters: CharacterDef[];
}

export const CHARACTER_DEFS: CharacterDef[] = [
  {
    id: 'mio',
    name: '澪',
    tagline: '先把手牌理顺，再谈胜负。',
    accent: 'from-amber-200 via-orange-100 to-rose-100',
    unlockRule: {
      type: 'default',
      target: 0,
    },
  },
  {
    id: 'rin',
    name: '凛',
    tagline: '对局数上来了，气势也要跟上。',
    accent: 'from-sky-200 via-cyan-100 to-emerald-100',
    unlockRule: {
      type: 'riichi-rounds',
      target: 5,
    },
  },
  {
    id: 'sora',
    name: '空',
    tagline: '和牌不是终点，节奏才是答案。',
    accent: 'from-violet-200 via-fuchsia-100 to-pink-100',
    unlockRule: {
      type: 'riichi-wins',
      target: 3,
    },
  },
];

function getDefaultCharacter(): CharacterDef {
  return CHARACTER_DEFS[0];
}

function safeAffinity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

export function createDefaultPlayerCharacterState(): PlayerCharacterState {
  const defaultCharacter = getDefaultCharacter();
  return {
    activeCharacterId: defaultCharacter.id,
    unlockedCharacterIds: [defaultCharacter.id],
    affinityByCharacter: {
      [defaultCharacter.id]: 0,
    },
    updatedAt: Date.now(),
  };
}

function normalizePlayerCharacterState(raw: unknown): PlayerCharacterState {
  const defaults = createDefaultPlayerCharacterState();
  if (!raw || typeof raw !== 'object') return defaults;
  const parsed = raw as Partial<PlayerCharacterState>;
  const unlockedCharacterIds = Array.isArray(parsed.unlockedCharacterIds)
    ? parsed.unlockedCharacterIds.filter((id): id is string =>
        CHARACTER_DEFS.some((character) => character.id === id),
      )
    : [];
  const mergedUnlockedIds = Array.from(
    new Set([getDefaultCharacter().id, ...unlockedCharacterIds]),
  );
  const affinityByCharacter: Record<string, number> = {};
  if (parsed.affinityByCharacter && typeof parsed.affinityByCharacter === 'object') {
    for (const [characterId, value] of Object.entries(parsed.affinityByCharacter)) {
      if (!CHARACTER_DEFS.some((character) => character.id === characterId)) continue;
      affinityByCharacter[characterId] = safeAffinity(value);
    }
  }
  for (const characterId of mergedUnlockedIds) {
    affinityByCharacter[characterId] = affinityByCharacter[characterId] ?? 0;
  }
  const activeCharacterId = mergedUnlockedIds.includes(parsed.activeCharacterId ?? '')
    ? (parsed.activeCharacterId as string)
    : mergedUnlockedIds[0] ?? defaults.activeCharacterId;
  return {
    activeCharacterId,
    unlockedCharacterIds: mergedUnlockedIds,
    affinityByCharacter,
    updatedAt:
      typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : defaults.updatedAt,
  };
}

function savePlayerCharacterState(state: PlayerCharacterState): PlayerCharacterState {
  const normalized = normalizePlayerCharacterState({
    ...state,
    updatedAt: Date.now(),
  });
  if (typeof localStorage === 'undefined') return normalized;
  localStorage.setItem(
    PLAYER_CHARACTER_STORAGE_KEY,
    JSON.stringify(normalized),
  );
  return normalized;
}

export function getPlayerCharacterState(): PlayerCharacterState {
  if (typeof localStorage === 'undefined') return createDefaultPlayerCharacterState();
  try {
    const raw = localStorage.getItem(PLAYER_CHARACTER_STORAGE_KEY);
    if (!raw) return createDefaultPlayerCharacterState();
    return normalizePlayerCharacterState(JSON.parse(raw));
  } catch {
    return createDefaultPlayerCharacterState();
  }
}

export function updatePlayerCharacterState(
  patch:
    | Partial<Omit<PlayerCharacterState, 'updatedAt'>>
    | ((
        current: PlayerCharacterState,
      ) => Partial<Omit<PlayerCharacterState, 'updatedAt'>>),
): PlayerCharacterState {
  const current = getPlayerCharacterState();
  const nextPatch = typeof patch === 'function' ? patch(current) : patch;
  return savePlayerCharacterState({
    ...current,
    ...nextPatch,
  });
}

export function getCharacterById(characterId: string): CharacterDef {
  return (
    CHARACTER_DEFS.find((character) => character.id === characterId) ??
    getDefaultCharacter()
  );
}

export function getCharacterAffinityStage(affinity: number): number {
  const safeValue = safeAffinity(affinity);
  if (safeValue >= CHARACTER_AFFINITY_THRESHOLDS[2]) return 3;
  if (safeValue >= CHARACTER_AFFINITY_THRESHOLDS[1]) return 2;
  if (safeValue >= CHARACTER_AFFINITY_THRESHOLDS[0]) return 1;
  return 0;
}

function isCharacterUnlocked(character: CharacterDef): boolean {
  const stats = getPlayerStats();
  switch (character.unlockRule.type) {
    case 'riichi-rounds':
      return stats.riichiRounds >= character.unlockRule.target;
    case 'riichi-wins':
      return stats.riichiWins >= character.unlockRule.target;
    default:
      return true;
  }
}

export function syncPlayerCharacterUnlocks(): {
  state: PlayerCharacterState;
  newlyUnlockedCharacters: CharacterDef[];
} {
  const current = getPlayerCharacterState();
  const newlyUnlockedCharacters = CHARACTER_DEFS.filter(
    (character) =>
      !current.unlockedCharacterIds.includes(character.id) &&
      isCharacterUnlocked(character),
  );
  if (newlyUnlockedCharacters.length === 0) {
    return { state: current, newlyUnlockedCharacters: [] };
  }
  const state = updatePlayerCharacterState((previous) => ({
    unlockedCharacterIds: [
      ...previous.unlockedCharacterIds,
      ...newlyUnlockedCharacters.map((character) => character.id),
    ],
    affinityByCharacter: newlyUnlockedCharacters.reduce<Record<string, number>>(
      (acc, character) => {
        acc[character.id] = previous.affinityByCharacter[character.id] ?? 0;
        return acc;
      },
      { ...previous.affinityByCharacter },
    ),
  }));
  return { state, newlyUnlockedCharacters };
}

export function setActiveCharacter(characterId: string): PlayerCharacterState {
  const current = getPlayerCharacterState();
  if (!current.unlockedCharacterIds.includes(characterId)) return current;
  return updatePlayerCharacterState({ activeCharacterId: characterId });
}

export function addActiveCharacterAffinity(amount = 1): CharacterAffinityProgress {
  const unlockedResult = syncPlayerCharacterUnlocks();
  const character = getCharacterById(unlockedResult.state.activeCharacterId);
  const previousAffinity =
    unlockedResult.state.affinityByCharacter[character.id] ?? 0;
  const currentAffinity = previousAffinity + Math.max(0, Math.floor(amount));
  const previousStage = getCharacterAffinityStage(previousAffinity);
  const state = updatePlayerCharacterState((current) => ({
    affinityByCharacter: {
      ...current.affinityByCharacter,
      [character.id]: currentAffinity,
    },
  }));
  return {
    state,
    character,
    previousAffinity,
    currentAffinity,
    previousStage,
    currentStage: getCharacterAffinityStage(currentAffinity),
    newlyUnlockedCharacters: unlockedResult.newlyUnlockedCharacters,
  };
}
