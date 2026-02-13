/**
 * 日本立直麻将规则库
 * 牌型 0-33 同中国麻将；34=赤5万 35=赤5条 36=赤5筒
 * 规则以 .cursor/skills/mahjong-japanese-riichi/ 为准
 */

/** 34 种基础牌型：0-8万 9-17条 18-26筒 27-33字牌 */
export const TILE_LABELS_RIICHI: string[] = [
  '一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万',
  '一条', '二条', '三条', '四条', '五条', '六条', '七条', '八条', '九条',
  '一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒',
  '东', '南', '西', '北', '中', '发', '白',
];

/** 赤5万/赤5条/赤5筒 的牌型 id（用于牌组中） */
export const AKA_5_MAN = 34;
export const AKA_5_PIN = 35;
export const AKA_5_SOU = 36;

/** 牌面显示文字（含赤 5） */
export function getTileLabel(tile: number): string {
  if (tile === AKA_5_MAN) return '赤五万';
  if (tile === AKA_5_PIN) return '赤五条';
  if (tile === AKA_5_SOU) return '赤五筒';
  return TILE_LABELS_RIICHI[tile] ?? '';
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
  if (tile === AKA_5_MAN) return 4;
  if (tile === AKA_5_PIN) return 13;
  if (tile === AKA_5_SOU) return 22;
  return tile;
}

/** 是否为红宝牌（赤 5） */
export function isAkaFive(tile: number): boolean {
  return tile === AKA_5_MAN || tile === AKA_5_PIN || tile === AKA_5_SOU;
}

/** 牌型是否相同（赤 5 与普通 5 同型） */
export function sameTileType(a: number, b: number): boolean {
  return getBaseTile(a) === getBaseTile(b);
}

/** 生成 136 张牌（含 3 枚赤 5）并洗牌 */
export function createRiichiDeck(): number[] {
  const deck: number[] = [];
  const fiveMan = 4,
    fivePin = 13,
    fiveSou = 22;
  for (let t = 0; t < BASE_TILE_TYPES; t++) {
    const copies = t === fiveMan || t === fivePin || t === fiveSou ? 3 : NORMAL_COPIES;
    for (let c = 0; c < copies; c++) deck.push(t);
  }
  deck.push(AKA_5_MAN, AKA_5_PIN, AKA_5_SOU);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** 发牌：亲家 14 张，子家 13 张 */
export function dealRiichi(deck: number[], dealer: number): [number[][], number[]] {
  const hands: number[][] = [[], [], [], []];
  const d = [...deck];
  for (let i = 0; i < HAND_INIT * NUM_PLAYERS; i++) {
    hands[i % NUM_PLAYERS].push(d.shift()!);
  }
  hands[dealer].push(d.shift()!);
  for (let i = 0; i < NUM_PLAYERS; i++) {
    hands[i].sort((a, b) => getBaseTile(a) - getBaseTile(b) || (a - b));
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
  return t === 33 ? 31 : t + 1;
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
    byBase.get(b)!.push(t);
  }
  const options: number[][] = [];
  for (const [, tiles] of byBase) {
    if (tiles.length >= 4) options.push(tiles.slice(0, 4));
  }
  return options;
}

/** 是否算副露（吃/碰/明杠算副露，暗杠不算） */
export function isOpenMeld(meld: { type: string }): boolean {
  return meld.type === 'chi' || meld.type === 'peng' || meld.type === 'mingang';
}

/** 是否门前清：无副露（暗杠不计入） */
export function isMenzhen(melds: { type: string }[]): boolean {
  return melds.every((m) => !isOpenMeld(m));
}

/** 宝牌计数：手牌+副露中为 dora 的张数（含赤宝牌） */
export function countDoraInHand(
  tiles: number[],
  doraTypes: number[],
  includeAka: boolean,
): number {
  let n = 0;
  for (const t of tiles) {
    const base = getBaseTile(t);
    if (doraTypes.includes(base)) n++;
    if (includeAka && isAkaFive(t)) n++;
  }
  return n;
}

/** 振听类型 */
export type FuritenType = 'sutehai' | 'doujun' | 'riichi';

/** 振听状态（可多种同时） */
export interface FuritenState {
  sutehai: boolean;
  doujun: boolean;
  riichi: boolean;
}

export function isFuriten(s: FuritenState): boolean {
  return s.sutehai || s.doujun || s.riichi;
}

/**
 * 役种常量（天凤/雀魂标准，详见 .cursor/skills/mahjong-japanese-riichi/yaku.md）
 * 1番：立直/门清自摸/断幺九/役牌/平和/一发/岭上开花/抢杠(仅加杠)/海底摸月/河底捞鱼
 * 2番：七对子/对对和/三暗刻/三杠子/一气通贯(门清2副露1)/混老头/小三元/两杯口
 * 3番：混一色(门清3副露2)  6番：清一色(门清6副露5)  役满：天和/地和/国士/四暗刻/大三元等
 * 门前清 = 无吃/碰/明杠（暗杠不算副露）；副露降番仅限一气通贯/混一色/清一色
 */
export const YAKU_RIICHI = { id: 'riichi', name: '立直', han: 1, hanOpen: 0 };
export const YAKU_MENZEN_TSUMO = { id: 'menzen_tsumo', name: '门前清自摸和', han: 1, hanOpen: 0 };
export const YAKU_PINFU = { id: 'pinfu', name: '平和', han: 1, hanOpen: 0 };
export const YAKU_TANYAO = { id: 'tanyao', name: '断幺九', han: 1, hanOpen: 1 };
export const YAKU_YAKUHAI = { id: 'yakuhai', name: '役牌', han: 1, hanOpen: 1 };
export const YAKU_IPPATSU = { id: 'ippatsu', name: '一发', han: 1, hanOpen: 0 };
export const YAKU_CHIITOITSU = { id: 'chiitoitsu', name: '七对子', han: 2, hanOpen: 0 };
export const YAKU_HONITSU = { id: 'honitsu', name: '混一色', han: 3, hanOpen: 2 };
export const YAKU_CHINITSU = { id: 'chinitsu', name: '清一色', han: 6, hanOpen: 5 };

/** 役判定输入（简化：手牌+副露+是否门前清+是否自摸+是否立直+立直后巡数） */
export interface YakuContext {
  hand: number[];
  melds: { tiles: number[] }[];
  isMenzhen: boolean;
  isTsumo: boolean;
  isRiichi: boolean;
  ippatsuPossible: boolean;
  seatWind: number;
  roundWind: number;
}

/** 符计算：底符 20 + 自摸 2 / 荣和 10 + 听牌形等（简化） */
export function calcFu(
  _context: { isTsumo: boolean; isMenzhen: boolean; hasPinfu: boolean },
): number {
  let fu = 20;
  // 自摸+2（非门前清自摸时）、荣和+10 等在此按 context 细化
  return Math.min(110, Math.ceil(fu / 10) * 10);
}

/** 点数公式：符 × 2^(番+2) × 倍率（子家 1，亲家 1.5），满贯以上按档位 */
export function calcScore(fu: number, han: number, isDealer: boolean, _isTsumo: boolean): number {
  if (han >= 13) return isDealer ? 48000 : 32000;
  if (han >= 11) return isDealer ? 36000 : 24000;
  if (han >= 8) return isDealer ? 24000 : 16000;
  if (han >= 6) return isDealer ? 18000 : 12000;
  const base = fu * 2 ** (han + 2);
  const rate = isDealer ? 1.5 : 1;
  return Math.ceil((base * rate) / 100) * 100;
}

/** 断幺九：无 1/9 牌、无字牌（手牌+副露全部为 2-8 的数牌） */
export function checkTanyao(tiles: number[]): boolean {
  const yaoJiu = [0, 8, 9, 17, 18, 26];
  const zi = [27, 28, 29, 30, 31, 32, 33];
  for (const t of tiles) {
    const b = getBaseTile(t);
    if (yaoJiu.includes(b) || zi.includes(b)) return false;
  }
  return true;
}

/** 役牌：白(31)发(32)中(33)、自风、场风 的刻子。返回组数（每组 1 番） */
export function countYakuhai(
  hand: number[],
  melds: { tiles: number[] }[],
  seatWind: number,
  roundWind: number,
): number {
  const triplets = new Set<number>();
  const all = [...hand, ...melds.flatMap((m) => m.tiles)];
  const counts = new Map<number, number>();
  for (const t of all) {
    const b = getBaseTile(t);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const yakuhaiTypes = [31, 32, 33, seatWind, roundWind];
  for (const t of yakuhaiTypes) {
    if ((counts.get(t) ?? 0) >= 3) triplets.add(t);
  }
  return triplets.size;
}

/** 是否有役（最小集合：立直/门前清自摸/断幺九/役牌/七对子 等，仅作占位） */
export function hasYaku(context: YakuContext): boolean {
  const all = [...context.hand, ...context.melds.flatMap((m) => m.tiles)];
  if (all.length !== 14) return false;
  if (context.isRiichi) return true;
  if (context.isMenzhen && context.isTsumo) return true;
  if (checkTanyao(all)) return true;
  if (countYakuhai(context.hand, context.melds, context.seatWind, context.roundWind) > 0) return true;
  // 七对子、平和等可在此扩展
  return false;
}
