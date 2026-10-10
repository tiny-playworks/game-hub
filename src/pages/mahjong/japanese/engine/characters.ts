import { CHARACTER_DEFS } from '@/lib/playerCharacters';
import { mixSeed, mulberry32 } from '@/lib/seededRandom';

/** 自家使用主角色；对局只固定三名 AI 的角色。 */
export type RiichiSeatCharacters = [null, string, string, string];
export type OpponentSelection = [string | null, string | null, string | null];

const DEFAULT_OPPONENTS = ['mio', 'rin', 'sora'];

/** 老存档缺少角色字段时沿用原三人；坏 id、重复 id 逐座位补齐。 */
export function normalizeSeatCharacters(value: unknown): RiichiSeatCharacters {
  const input = Array.isArray(value) ? value : [];
  const ids = CHARACTER_DEFS.map((character) => character.id);
  const used = new Set<string>();
  const opponents = DEFAULT_OPPONENTS.map((fallback, index) => {
    const candidate = input[index + 1];
    const id =
      typeof candidate === 'string' &&
      ids.includes(candidate) &&
      !used.has(candidate)
        ? candidate
        : ([fallback, ...DEFAULT_OPPONENTS, ...ids].find(
            (id) => !used.has(id),
          ) ?? fallback);
    used.add(id);
    return id;
  });
  return [null, opponents[0], opponents[1], opponents[2]];
}

/** 角色抽取不消耗牌山随机流；同一种子、主角色得到相同对手。 */
export function selectSeatCharacters(
  seed: number,
  playerCharacterId: string,
  selection?: readonly (string | null)[],
): RiichiSeatCharacters {
  const pool = CHARACTER_DEFS.map((character) => character.id).filter(
    (id) => id !== playerCharacterId,
  );
  const random = mulberry32(mixSeed(seed, 0x43484152));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const used = new Set<string>();
  const selected = [0, 1, 2].map((index) => {
    const id = selection?.[index];
    if (!id || !pool.includes(id) || used.has(id)) return null;
    used.add(id);
    return id;
  });
  const opponents = selected.map((id) => {
    if (id) return id;
    const drawn = pool.find((candidate) => !used.has(candidate)) ?? pool[0];
    used.add(drawn);
    return drawn;
  });
  return [null, opponents[0], opponents[1], opponents[2]];
}
