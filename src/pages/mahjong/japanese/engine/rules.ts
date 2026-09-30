import {
  DEFAULT_MATCH_END_RULES,
  type MatchEndRules,
} from '@/lib/riichiGameEnd';

export type RiichiAiLevel = 'beginner' | 'standard';

/** 规则配置；默认对齐雀魂段位场 */
export interface RiichiRuleConfig {
  /** 允许双响（一炮双响）；关闭时按头跳只取放铳者下家起第一位 */
  doubleRon: boolean;
  /** 三家和了时途中流局 */
  sanchahouDraw: boolean;
  /** 大三元 / 大四喜包牌 */
  pao: boolean;
  /** 国士十三面、四暗刻单骑、纯正九莲、大四喜按双倍役满 */
  doubleYakuman: boolean;
  /** 禁止食替（现物与筋） */
  kuikae: boolean;
  nagashiMangan: boolean;
  /** 国士无双可抢暗杠 */
  kokushiChankanAnkan: boolean;
  matchEnd: MatchEndRules;
  aiLevel: RiichiAiLevel;
}

export const DEFAULT_RIICHI_RULES: RiichiRuleConfig = {
  doubleRon: true,
  sanchahouDraw: true,
  pao: true,
  doubleYakuman: true,
  kuikae: true,
  nagashiMangan: true,
  kokushiChankanAnkan: true,
  matchEnd: { ...DEFAULT_MATCH_END_RULES },
  aiLevel: 'standard',
};

export function resolveRules(
  partial?: Partial<RiichiRuleConfig> | null,
): RiichiRuleConfig {
  return {
    ...DEFAULT_RIICHI_RULES,
    ...partial,
    matchEnd: { ...DEFAULT_RIICHI_RULES.matchEnd, ...partial?.matchEnd },
  };
}

export function isRiichiRuleConfig(value: unknown): value is RiichiRuleConfig {
  if (!value || typeof value !== 'object') return false;
  const rules = value as Record<string, unknown>;
  const booleanKeys = [
    'doubleRon',
    'sanchahouDraw',
    'pao',
    'doubleYakuman',
    'kuikae',
    'nagashiMangan',
    'kokushiChankanAnkan',
  ];
  if (!booleanKeys.every((key) => typeof rules[key] === 'boolean'))
    return false;
  if (rules.aiLevel !== 'beginner' && rules.aiLevel !== 'standard')
    return false;
  if (!rules.matchEnd || typeof rules.matchEnd !== 'object') return false;
  const end = rules.matchEnd as Record<string, unknown>;
  return (
    typeof end.returnScore === 'number' &&
    Number.isFinite(end.returnScore) &&
    end.returnScore > 0 &&
    ['extension', 'agariYame', 'tenpaiYame', 'tobi'].every(
      (key) => typeof end[key] === 'boolean',
    )
  );
}
