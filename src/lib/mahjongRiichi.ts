/**
 * 日本立直麻将牌张基础库：牌 id、牌山、发牌、宝牌与鸣牌候选。
 * 牌型 0-33 为万/条/筒/字；34=赤5万 35=赤5筒 36=赤5条。
 * 和了判定、役种与符番点数统一由 riichi-rs（见 riichiRules.ts）给出。
 */

import type { RiichiMeld } from '@/pages/mahjong/japanese/types';

/** 34 种基础牌型：0-8万 9-17条 18-26筒 27-33字牌 */
export const TILE_LABELS_RIICHI: string[] = [
  '一万',
  '二万',
  '三万',
  '四万',
  '五万',
  '六万',
  '七万',
  '八万',
  '九万',
  '一条',
  '二条',
  '三条',
  '四条',
  '五条',
  '六条',
  '七条',
  '八条',
  '九条',
  '一筒',
  '二筒',
  '三筒',
  '四筒',
  '五筒',
  '六筒',
  '七筒',
  '八筒',
  '九筒',
  '东',
  '南',
  '西',
  '北',
  '中',
  '发',
  '白',
];

/** 赤5万/赤5筒/赤5条 的牌型 id（用于牌组中） */
export const AKA_5_MAN = 34;
export const AKA_5_PIN = 35;
export const AKA_5_SOU = 36;

export const TILE_LABELS_RIICHI_EN: string[] = [
  '1m',
  '2m',
  '3m',
  '4m',
  '5m',
  '6m',
  '7m',
  '8m',
  '9m',
  '1s',
  '2s',
  '3s',
  '4s',
  '5s',
  '6s',
  '7s',
  '8s',
  '9s',
  '1p',
  '2p',
  '3p',
  '4p',
  '5p',
  '6p',
  '7p',
  '8p',
  '9p',
  'East',
  'South',
  'West',
  'North',
  'Chun',
  'Hatsu',
  'Haku',
];

/** 牌面显示文字（红宝牌与普通 5 同文，不写「赤」） */
export function getTileLabel(tile: number, locale?: 'zh' | 'en'): string {
  const isEn = locale === 'en';
  if (tile === AKA_5_MAN) return isEn ? '5m' : '五万';
  if (tile === AKA_5_PIN) return isEn ? '5p' : '五筒';
  if (tile === AKA_5_SOU) return isEn ? '5s' : '五条';
  return isEn
    ? (TILE_LABELS_RIICHI_EN[tile] ?? '')
    : (TILE_LABELS_RIICHI[tile] ?? '');
}

/** 基础牌型数量（不含赤牌） */
const BASE_TILE_TYPES = 34;
/** 每种牌 4 张，但 5万/5条/5筒 各 3 张普通 + 1 张赤 */
const NORMAL_COPIES = 4;
const NUM_PLAYERS = 4;
const HAND_INIT = 13;

/** 将牌型规范为基础 0-33（赤 5 视为 5） */
export function getBaseTile(tile: number): number {
  if (tile < BASE_TILE_TYPES) return tile;
  if (tile === AKA_5_MAN) return 4; // 赤五万 → 五万(4)
  if (tile === AKA_5_PIN) return 22; // 赤五筒 → 五筒(22)
  if (tile === AKA_5_SOU) return 13; // 赤五条 → 五条(13)
  return tile;
}

/** 是否为红宝牌（赤 5） */
export function isAkaFive(tile: number): boolean {
  return tile === AKA_5_MAN || tile === AKA_5_PIN || tile === AKA_5_SOU;
}

/** 幺九牌（老头牌 + 字牌） */
export function isYaochuu(tile: number): boolean {
  const base = getBaseTile(tile);
  if (base >= 27) return true;
  const num = base % 9;
  return num === 0 || num === 8;
}

/** 牌型是否相同（赤 5 与普通 5 同型） */
export function sameTileType(a: number, b: number): boolean {
  return getBaseTile(a) === getBaseTile(b);
}

/** 按牌型排序（同型时普通 5 在赤 5 前） */
export function compareTiles(a: number, b: number): number {
  return getBaseTile(a) - getBaseTile(b) || a - b;
}

/** 生成 136 张牌（含 3 枚赤 5）并洗牌 */
export function createRiichiDeck(random: () => number = Math.random): number[] {
  const deck: number[] = [];
  const fiveMan = 4,
    fiveSou = 13,
    fivePin = 22;
  for (let t = 0; t < BASE_TILE_TYPES; t++) {
    const copies =
      t === fiveMan || t === fivePin || t === fiveSou ? 3 : NORMAL_COPIES;
    for (let c = 0; c < copies; c++) deck.push(t);
  }
  deck.push(AKA_5_MAN, AKA_5_PIN, AKA_5_SOU);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** 发牌：亲家 14 张，子家 13 张 */
export function dealRiichi(
  deck: number[],
  dealer: number,
): [number[][], number[]] {
  const hands: number[][] = [[], [], [], []];
  const d = [...deck];
  for (let i = 0; i < HAND_INIT * NUM_PLAYERS; i++) {
    const t = d.shift();
    if (t === undefined) throw new Error('Deck empty');
    hands[i % NUM_PLAYERS].push(t);
  }
  const dealerDraw = d.shift();
  if (dealerDraw === undefined) throw new Error('Deck empty');
  hands[dealer].push(dealerDraw);
  for (let i = 0; i < NUM_PLAYERS; i++) {
    hands[i].sort(compareTiles);
  }
  return [hands, d];
}

/** 宝牌表示牌 → 宝牌（下一张）。indicator 为 0-33 或 34-36（赤当 5 看） */
export function getDoraFromIndicator(indicator: number): number {
  const t = getBaseTile(indicator);
  if (t < 27) {
    const suit = Math.floor(t / 9);
    const num = (t % 9) + 1;
    if (num === 9) return suit * 9;
    return t + 1;
  }
  if (t <= 30) return t === 30 ? 27 : t + 1;
  if (t === 31) return 33;
  if (t === 32) return 31;
  return 32;
}

/** 统计手牌+副露中某基础牌型的张数（赤 5 计入对应 5） */
export function countBaseTile(tiles: number[], baseType: number): number {
  return tiles.filter((t) => getBaseTile(t) === baseType).length;
}

/** 吃：只能吃上家的牌。上家 = (myIndex + 3) % 4。返回可吃的组合 [手牌1, 手牌2]，与 lastTile 组成顺子 */
export function getChiOptionsRiichi(
  hand: number[],
  lastTile: number,
  fromPlayer: number,
  myIndex: number,
): [number, number][] {
  const 上家 = (myIndex + 3) % 4;
  if (fromPlayer !== 上家) return [];
  const base = getBaseTile(lastTile);
  if (base >= 27) return [];
  const suit = Math.floor(base / 9);
  const low = suit * 9;
  const high = suit * 9 + 8;
  const need = [
    [base - 2, base - 1],
    [base - 1, base + 1],
    [base + 1, base + 2],
  ].filter(([a, b]) => a >= low && b <= high);
  const options: [number, number][] = [];
  for (const [baseA, baseB] of need) {
    const ia = hand.findIndex((t) => getBaseTile(t) === baseA);
    if (ia === -1) continue;
    const ib = hand.findIndex((t, i) => i !== ia && getBaseTile(t) === baseB);
    if (ib === -1) continue;
    options.push([hand[ia], hand[ib]]);
  }
  return options;
}

/** 碰：手牌有至少 2 张与 lastTile 同型（含赤 5） */
export function canPengRiichi(hand: number[], lastTile: number): boolean {
  const base = getBaseTile(lastTile);
  const n = hand.filter((t) => getBaseTile(t) === base).length;
  return n >= 2;
}

/** 明杠：手牌有至少 3 张与 lastTile 同型 */
export function canMingangRiichi(hand: number[], lastTile: number): boolean {
  const base = getBaseTile(lastTile);
  const n = hand.filter((t) => getBaseTile(t) === base).length;
  return n >= 3;
}

/** 暗杠：手牌有 4 张同型（含赤 5 与普通 5 同型）。返回每组 4 张牌为一选项，用于从手牌移除。暗杠不算副露，保留门前清。 */
export function getAngangOptionsRiichi(hand: number[]): number[][] {
  const byBase = new Map<number, number[]>();
  for (const t of hand) {
    const b = getBaseTile(t);
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b)?.push(t);
  }
  const options: number[][] = [];
  for (const [, tiles] of byBase) {
    if (tiles.length >= 4) options.push(tiles.slice(0, 4));
  }
  return options;
}

/** 是否算副露（吃/碰/明杠算副露，暗杠不算） */
export function isOpenMeld(meld: RiichiMeld): boolean {
  return (
    meld.type === 'chi' ||
    meld.type === 'peng' ||
    meld.type === 'mingang' ||
    meld.type === 'kakan'
  );
}

/** 是否门前清：无副露（暗杠不计入） */
export function isMenzhen(melds: RiichiMeld[]): boolean {
  return melds.every((m) => !isOpenMeld(m));
}

export function isKanMeld(meld: Pick<RiichiMeld, 'type'>): boolean {
  return (
    meld.type === 'mingang' || meld.type === 'angang' || meld.type === 'kakan'
  );
}
