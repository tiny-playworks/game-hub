import { getPlayerStats } from '@/lib/playerStats';

export const PLAYER_CHARACTER_STORAGE_KEY = 'game-hub-player-characters';
export const CHARACTER_AFFINITY_THRESHOLDS = [5, 15, 30] as const;

export const CHARACTER_RANK_BANDS = [
  'novice',
  'adept',
  'expert',
  'master',
  'saint',
] as const;
export type RankBand = (typeof CHARACTER_RANK_BANDS)[number];

export interface CharacterStyle {
  callAggression: number;
  riichiAggression: number;
  defenseBias: number;
  valueBias: number;
  flushBias: number;
}

export const CHARACTER_LINE_TRIGGERS = [
  'match-start',
  'riichi',
  'ron',
  'tsumo',
  'deal-in',
  'call',
  'ryuukyoku-tenpai',
  'match-top',
  'match-last',
] as const;
export type LineTrigger = (typeof CHARACTER_LINE_TRIGGERS)[number];
export type CharacterExpression = 'normal' | 'happy' | 'frustrated';

export type CharacterUnlockRule =
  | { type: 'default'; target: 0 }
  | {
      type: 'riichi-rounds' | 'riichi-wins';
      target: number;
      /** 老解锁条件与段位条件取或；段位由 P3 传入。 */
      rankBand: RankBand;
    }
  | { type: 'rank-band'; target: RankBand };

export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  nameKey: string;
  taglineKey: string;
  accent: string;
  rankBand: RankBand;
  style: CharacterStyle;
  styleTagKeys: string[];
  expressions: Record<CharacterExpression, string>;
  avatar: string;
  lines: Record<LineTrigger, string[]>;
  unlockRule: CharacterUnlockRule;
  /** i18n key，档案卡短介绍；缺省则不展示 bio 行 */
  bioKey?: string;
  /** 保留资源 key，供表现层解析；null 为渐变占位 */
  portraitKey: string | null;
  /** 语音包 id，占位供后续资源管线挂载 */
  voicePackId: string | null;
  /** 表现主题 token（UI 主题/特效），占位 */
  themeToken: string | null;
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

function defineCharacter(
  definition: Omit<
    CharacterDef,
    | 'nameKey'
    | 'taglineKey'
    | 'bioKey'
    | 'portraitKey'
    | 'voicePackId'
    | 'themeToken'
    | 'expressions'
    | 'avatar'
    | 'lines'
  >,
): CharacterDef {
  const path = `characters/${definition.id}`;
  return {
    ...definition,
    nameKey: `character.name.${definition.id}`,
    taglineKey: `character.tagline.${definition.id}`,
    bioKey: `character.bio.${definition.id}`,
    portraitKey: definition.id,
    voicePackId: null,
    themeToken: null,
    expressions: {
      normal: `${path}/normal.webp`,
      happy: `${path}/happy.webp`,
      frustrated: `${path}/frustrated.webp`,
    },
    avatar: `${path}/avatar.webp`,
    lines: Object.fromEntries(
      CHARACTER_LINE_TRIGGERS.map((kind) => [
        kind,
        Array.from(
          {
            length: ['match-start', 'riichi', 'ron', 'tsumo'].includes(kind)
              ? 3
              : 2,
          },
          (_, index) => `character.line.${definition.id}.${kind}.${index}`,
        ),
      ]),
    ) as Record<LineTrigger, string[]>,
  };
}

export const CHARACTER_DEFS: CharacterDef[] = [
  defineCharacter({
    id: 'koharu',
    name: '小春',
    tagline: '再来一局？这次我一定记得看牌河！',
    accent: 'from-orange-200 via-amber-100 to-rose-100',
    rankBand: 'novice',
    style: {
      callAggression: 0.9,
      riichiAggression: 0.65,
      defenseBias: 0.1,
      valueBias: 0.2,
      flushBias: 0.15,
    },
    styleTagKeys: ['character.tag.beginner', 'character.tag.calls'],
    unlockRule: { type: 'default', target: 0 },
  }),
  defineCharacter({
    id: 'mio',
    name: '澪',
    tagline: '先把手牌理顺，再谈胜负。',
    accent: 'from-amber-200 via-orange-100 to-rose-100',
    rankBand: 'novice',
    style: {
      callAggression: 0.2,
      riichiAggression: 0.4,
      defenseBias: 0.9,
      valueBias: 0.45,
      flushBias: 0.2,
    },
    styleTagKeys: ['character.tag.defense'],
    unlockRule: {
      type: 'default',
      target: 0,
    },
  }),
  defineCharacter({
    id: 'rin',
    name: '凛',
    tagline: '对局数上来了，气势也要跟上。',
    accent: 'from-sky-200 via-cyan-100 to-emerald-100',
    rankBand: 'adept',
    style: {
      callAggression: 0.95,
      riichiAggression: 0.55,
      defenseBias: 0.25,
      valueBias: 0.25,
      flushBias: 0.2,
    },
    styleTagKeys: ['character.tag.speed', 'character.tag.calls'],
    unlockRule: {
      type: 'riichi-rounds',
      target: 5,
      rankBand: 'adept',
    },
  }),
  defineCharacter({
    id: 'chitose',
    name: '千岁',
    tagline: '茶还温着，慢慢把这一手打好。',
    accent: 'from-lime-200 via-green-100 to-stone-100',
    rankBand: 'adept',
    style: {
      callAggression: 0.3,
      riichiAggression: 0.65,
      defenseBias: 0.55,
      valueBias: 0.5,
      flushBias: 0.3,
    },
    styleTagKeys: ['character.tag.balanced', 'character.tag.closed'],
    unlockRule: { type: 'rank-band', target: 'adept' },
  }),
  defineCharacter({
    id: 'sora',
    name: '空',
    tagline: '和牌不是终点，节奏才是答案。',
    accent: 'from-violet-200 via-fuchsia-100 to-pink-100',
    rankBand: 'expert',
    style: {
      callAggression: 0.3,
      riichiAggression: 0.65,
      defenseBias: 0.45,
      valueBias: 0.95,
      flushBias: 0.45,
    },
    styleTagKeys: ['character.tag.value'],
    unlockRule: {
      type: 'riichi-wins',
      target: 3,
      rankBand: 'expert',
    },
  }),
  defineCharacter({
    id: 'aya',
    name: '绫',
    tagline: '听牌了？那就把答案交给下一张。',
    accent: 'from-rose-200 via-red-100 to-amber-100',
    rankBand: 'expert',
    style: {
      callAggression: 0.15,
      riichiAggression: 1,
      defenseBias: 0.3,
      valueBias: 0.6,
      flushBias: 0.2,
    },
    styleTagKeys: ['character.tag.riichi'],
    unlockRule: { type: 'rank-band', target: 'expert' },
  }),
  defineCharacter({
    id: 'mahiru',
    name: '真昼',
    tagline: '今天的手牌，只想留一种颜色。',
    accent: 'from-yellow-200 via-orange-100 to-teal-100',
    rankBand: 'master',
    style: {
      callAggression: 0.65,
      riichiAggression: 0.5,
      defenseBias: 0.5,
      valueBias: 0.85,
      flushBias: 1,
    },
    styleTagKeys: ['character.tag.flush', 'character.tag.value'],
    unlockRule: { type: 'rank-band', target: 'master' },
  }),
  defineCharacter({
    id: 'yoru',
    name: '夜',
    tagline: '牌河已经说得够多了。',
    accent: 'from-slate-300 via-indigo-100 to-violet-100',
    rankBand: 'saint',
    style: {
      callAggression: 0.45,
      riichiAggression: 0.7,
      defenseBias: 0.85,
      valueBias: 0.8,
      flushBias: 0.55,
    },
    styleTagKeys: ['character.tag.reading', 'character.tag.balanced'],
    unlockRule: { type: 'rank-band', target: 'saint' },
  }),
];

function getDefaultCharacter(): CharacterDef {
  // 新名册按段位排序，但老玩家的缺省主角色仍是澪。
  return (
    CHARACTER_DEFS.find((character) => character.id === 'mio') ??
    CHARACTER_DEFS[0]
  );
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
    unlockedCharacterIds: CHARACTER_DEFS.filter(
      (character) => character.unlockRule.type === 'default',
    ).map((character) => character.id),
    affinityByCharacter: Object.fromEntries(
      CHARACTER_DEFS.filter(
        (character) => character.unlockRule.type === 'default',
      ).map((character) => [character.id, 0]),
    ),
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
    new Set([...defaults.unlockedCharacterIds, ...unlockedCharacterIds]),
  );
  const affinityByCharacter: Record<string, number> = {};
  if (
    parsed.affinityByCharacter &&
    typeof parsed.affinityByCharacter === 'object'
  ) {
    for (const [characterId, value] of Object.entries(
      parsed.affinityByCharacter,
    )) {
      if (!CHARACTER_DEFS.some((character) => character.id === characterId))
        continue;
      affinityByCharacter[characterId] = safeAffinity(value);
    }
  }
  for (const characterId of mergedUnlockedIds) {
    affinityByCharacter[characterId] = affinityByCharacter[characterId] ?? 0;
  }
  const activeCharacterId = mergedUnlockedIds.includes(
    parsed.activeCharacterId ?? '',
  )
    ? (parsed.activeCharacterId as string)
    : defaults.activeCharacterId;
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

function savePlayerCharacterState(
  state: PlayerCharacterState,
): PlayerCharacterState {
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
  if (typeof localStorage === 'undefined')
    return createDefaultPlayerCharacterState();
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

function isCharacterUnlocked(
  character: CharacterDef,
  reachedRankBand?: RankBand,
): boolean {
  const stats = getPlayerStats();
  const rankTarget =
    character.unlockRule.type === 'rank-band'
      ? character.unlockRule.target
      : character.unlockRule.type === 'default'
        ? undefined
        : character.unlockRule.rankBand;
  if (
    reachedRankBand &&
    rankTarget &&
    CHARACTER_RANK_BANDS.indexOf(reachedRankBand) >=
      CHARACTER_RANK_BANDS.indexOf(rankTarget)
  ) {
    return true;
  }
  switch (character.unlockRule.type) {
    case 'riichi-rounds':
      return stats.riichiRounds >= character.unlockRule.target;
    case 'riichi-wins':
      return stats.riichiWins >= character.unlockRule.target;
    case 'default':
      return true;
    case 'rank-band':
      return false;
  }
}

export function syncPlayerCharacterUnlocks(reachedRankBand?: RankBand): {
  state: PlayerCharacterState;
  newlyUnlockedCharacters: CharacterDef[];
} {
  const current = getPlayerCharacterState();
  const newlyUnlockedCharacters = CHARACTER_DEFS.filter(
    (character) =>
      !current.unlockedCharacterIds.includes(character.id) &&
      isCharacterUnlocked(character, reachedRankBand),
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

export function addActiveCharacterAffinity(
  amount = 1,
): CharacterAffinityProgress {
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
