import { appendGrowthFeedItem } from '@/lib/growthFeed';
import { getPlayerStats } from '@/lib/playerStats';
import { gameStorage } from '@/lib/storage';
import { normalizeCharacterOutfits } from './characterOutfits';

export const PLAYER_CHARACTER_STORAGE_KEY = 'game-hub-player-characters';
export const CHARACTER_AFFINITY_THRESHOLDS = [5, 15, 30, 50] as const;
export const CHARACTERS_CHANGED_EVENT = 'game-hub:characters-changed';
export const AFFINITY_STAGE_EVENT = 'game-hub:affinity-stage';

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
  version: 2;
  activeCharacterId: string;
  /** Optional in historical v2 saves; outfits do not change character identity. */
  outfitByCharacter?: Record<string, string>;
  unlockedCharacterIds: string[];
  affinityByCharacter: Record<string, number>;
  /** Rewards are permanent even if an older affinity value is restored. */
  rewardStageByCharacter: Record<string, number>;
  encounteredCharacterIds: string[];
  encountersByCharacter: Record<
    string,
    { matches: number; playerAbove: number }
  >;
  rewardedMatchIds: string[];
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

// Append: the historical roster order drives permanent cosmetic reward IDs.
CHARACTER_DEFS.push(
  defineCharacter({
    id: 'aoi',
    name: '葵',
    tagline: '换一种心情，再认真打两圈。',
    accent: 'from-slate-300 via-rose-100 to-stone-100',
    rankBand: 'novice',
    style: {
      callAggression: 0.4,
      riichiAggression: 0.55,
      defenseBias: 0.6,
      valueBias: 0.5,
      flushBias: 0.25,
    },
    styleTagKeys: ['character.tag.balanced'],
    unlockRule: { type: 'default', target: 0 },
  }),
);

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
    version: 2,
    activeCharacterId: defaultCharacter.id,
    outfitByCharacter: {},
    unlockedCharacterIds: CHARACTER_DEFS.filter(
      (character) => character.unlockRule.type === 'default',
    ).map((character) => character.id),
    affinityByCharacter: Object.fromEntries(
      CHARACTER_DEFS.filter(
        (character) => character.unlockRule.type === 'default',
      ).map((character) => [character.id, 0]),
    ),
    rewardStageByCharacter: {},
    encounteredCharacterIds: [],
    encountersByCharacter: {},
    rewardedMatchIds: [],
    updatedAt: Date.now(),
  };
}

export function normalizePlayerCharacterState(
  raw: unknown,
): PlayerCharacterState {
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
  const rewardStageByCharacter: Record<string, number> = {};
  const encountersByCharacter: PlayerCharacterState['encountersByCharacter'] =
    {};
  for (const character of CHARACTER_DEFS) {
    rewardStageByCharacter[character.id] = Math.max(
      getCharacterAffinityStage(affinityByCharacter[character.id] ?? 0),
      Math.min(4, safeAffinity(parsed.rewardStageByCharacter?.[character.id])),
    );
    const encounters = parsed.encountersByCharacter?.[character.id];
    const matches = safeAffinity(encounters?.matches);
    encountersByCharacter[character.id] = {
      matches,
      playerAbove: Math.min(matches, safeAffinity(encounters?.playerAbove)),
    };
  }
  return {
    version: 2,
    activeCharacterId,
    outfitByCharacter: normalizeCharacterOutfits(parsed.outfitByCharacter),
    unlockedCharacterIds: mergedUnlockedIds,
    affinityByCharacter,
    rewardStageByCharacter,
    encountersByCharacter,
    encounteredCharacterIds: CHARACTER_DEFS.filter(
      (character) =>
        (Array.isArray(parsed.encounteredCharacterIds) &&
          parsed.encounteredCharacterIds.includes(character.id)) ||
        (affinityByCharacter[character.id] ?? 0) > 0 ||
        encountersByCharacter[character.id].matches > 0,
    ).map((character) => character.id),
    rewardedMatchIds: Array.isArray(parsed.rewardedMatchIds)
      ? parsed.rewardedMatchIds
          .filter((id): id is string => typeof id === 'string')
          .slice(-1000)
      : [],
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
  if (typeof gameStorage === 'undefined') return normalized;
  gameStorage.setItem(PLAYER_CHARACTER_STORAGE_KEY, JSON.stringify(normalized));
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event(CHARACTERS_CHANGED_EVENT));
  return normalized;
}

export function getPlayerCharacterState(): PlayerCharacterState {
  if (typeof gameStorage === 'undefined')
    return createDefaultPlayerCharacterState();
  try {
    const raw = gameStorage.getItem(PLAYER_CHARACTER_STORAGE_KEY);
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
  if (safeValue >= CHARACTER_AFFINITY_THRESHOLDS[3]) return 4;
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

export function markCharactersEncountered(ids: string[]): void {
  const current = getPlayerCharacterState();
  const next = CHARACTER_DEFS.filter(
    (character) =>
      ids.includes(character.id) &&
      !current.encounteredCharacterIds.includes(character.id),
  ).map((character) => character.id);
  if (next.length)
    updatePlayerCharacterState({
      encounteredCharacterIds: [...current.encounteredCharacterIds, ...next],
    });
}

/** Only whole, completed matches reach this boundary. One receipt covers every seat. */
export function recordCharacterMatchFinish(input: {
  matchId: string;
  characterId: string;
  opponents: string[];
  ranking: number[];
}): PlayerCharacterState {
  const current = getPlayerCharacterState();
  if (!input.matchId || current.rewardedMatchIds.includes(input.matchId))
    return current;
  const affinity = { ...current.affinityByCharacter };
  const encounters = { ...current.encountersByCharacter };
  const playerPlace = input.ranking.indexOf(0);
  const validIds = new Set(CHARACTER_DEFS.map((character) => character.id));
  if (
    !validIds.has(input.characterId) ||
    playerPlace < 0 ||
    input.ranking.length !== 4 ||
    new Set(input.ranking).size !== 4 ||
    input.ranking.some((seat) => ![0, 1, 2, 3].includes(seat))
  )
    return current;
  affinity[input.characterId] = (affinity[input.characterId] ?? 0) + 2;
  const opponents = new Set<string>();
  input.opponents.slice(0, 3).forEach((id, index) => {
    if (!validIds.has(id) || id === input.characterId || opponents.has(id))
      return;
    opponents.add(id);
    const above = playerPlace < input.ranking.indexOf(index + 1);
    affinity[id] = (affinity[id] ?? 0) + 1 + Number(above);
    const previous = encounters[id] ?? { matches: 0, playerAbove: 0 };
    encounters[id] = {
      matches: previous.matches + 1,
      playerAbove: previous.playerAbove + Number(above),
    };
  });
  const state = updatePlayerCharacterState({
    affinityByCharacter: affinity,
    encountersByCharacter: encounters,
    encounteredCharacterIds: [
      ...new Set([
        ...current.encounteredCharacterIds,
        input.characterId,
        ...opponents,
      ]),
    ],
    rewardedMatchIds: [...current.rewardedMatchIds, input.matchId].slice(-1000),
  });
  const stages = CHARACTER_DEFS.flatMap((character) => {
    const stage = state.rewardStageByCharacter[character.id] ?? 0;
    if (stage <= (current.rewardStageByCharacter[character.id] ?? 0)) return [];
    appendGrowthFeedItem({
      type: 'character-stage',
      titleKey: 'growth.feed.character.stage.title',
      detailKey: 'growth.feed.character.stage.detail',
      characterId: character.id,
      stage,
      value: affinity[character.id],
    });
    return [{ characterId: character.id, stage }];
  });
  if (stages.length && typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent(AFFINITY_STAGE_EVENT, { detail: stages }),
    );
  return state;
}

export function getCharacterLines(
  character: CharacterDef,
  trigger: LineTrigger,
): string[] {
  const lines = character.lines[trigger];
  const stage =
    getPlayerCharacterState().rewardStageByCharacter[character.id] ?? 0;
  return stage >= 2
    ? [...lines, `character.affinityLine.${character.id}.${trigger}`]
    : lines;
}
