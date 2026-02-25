/**
 * 日本立直麻将规则库
 * 牌型 0-33 同中国麻将；34=赤5万 35=赤5条 36=赤5筒
 * 规则以 .cursor/skills/mahjong-japanese-riichi/ 为准
 */

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

/** 赤5万/赤5条/赤5筒 的牌型 id（用于牌组中） */
export const AKA_5_MAN = 34;
export const AKA_5_PIN = 35;
export const AKA_5_SOU = 36;

/** 牌面显示文字（红宝牌与普通 5 同文，不写「赤」） */
export function getTileLabel(tile: number): string {
  if (tile === AKA_5_MAN) return '五万';
  if (tile === AKA_5_PIN) return '五筒';
  if (tile === AKA_5_SOU) return '五条';
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
  if (tile === AKA_5_MAN) return 4; // 赤五万 → 五万(4)
  if (tile === AKA_5_PIN) return 22; // 赤五筒 → 五筒(22)
  if (tile === AKA_5_SOU) return 13; // 赤五条 → 五条(13)
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
    fiveSou = 13,
    fivePin = 22;
  for (let t = 0; t < BASE_TILE_TYPES; t++) {
    const copies =
      t === fiveMan || t === fivePin || t === fiveSou ? 3 : NORMAL_COPIES;
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
    hands[i].sort((a, b) => getBaseTile(a) - getBaseTile(b) || a - b);
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
    byBase.get(b)?.push(t);
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
export const YAKU_MENZEN_TSUMO = {
  id: 'menzen_tsumo',
  name: '门前清自摸和',
  han: 1,
  hanOpen: 0,
};
export const YAKU_PINFU = { id: 'pinfu', name: '平和', han: 1, hanOpen: 0 };
export const YAKU_TANYAO = { id: 'tanyao', name: '断幺九', han: 1, hanOpen: 1 };
export const YAKU_YAKUHAI = { id: 'yakuhai', name: '役牌', han: 1, hanOpen: 1 };
export const YAKU_IPPATSU = { id: 'ippatsu', name: '一发', han: 1, hanOpen: 0 };
export const YAKU_CHIITOITSU = {
  id: 'chiitoitsu',
  name: '七对子',
  han: 2,
  hanOpen: 0,
};
export const YAKU_HONITSU = {
  id: 'honitsu',
  name: '混一色',
  han: 3,
  hanOpen: 2,
};
export const YAKU_CHINITSU = {
  id: 'chinitsu',
  name: '清一色',
  han: 6,
  hanOpen: 5,
};

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

/**
 * 符数计算（天凤/雀魂标准，Skill 11）
 * 基础：门前清荣和 10 符（平和）、门前清自摸 11 符、副露 10 符；七对子固定 25 符。
 * 向上取整至 10 的倍数。
 */
export function calcFu(context: {
  isTsumo: boolean;
  isMenzhen: boolean;
  hasPinfu: boolean;
  isChiitoitsu: boolean;
}): number {
  if (context.isChiitoitsu) return 25;
  let fu: number;
  if (context.isMenzhen && context.hasPinfu) {
    fu = context.isTsumo ? 20 : 30; // 平和：自摸固定 20 符，荣和固定 30 符
  } else if (context.isMenzhen) {
    fu = context.isTsumo ? 22 : 30; // 非平和门清：自摸底符 20+2，荣和底符 30
  } else {
    fu = context.isTsumo ? 22 : 30; // 副露：自摸底符 20+2，荣和底符 30 (含门前加符10→简化为30)
  }
  return Math.min(110, Math.ceil(fu / 10) * 10);
}

/**
 * 点数计算（天凤/雀魂标准，Skill 12/13）
 * 1-2 番：符×2^(番+2)×倍率；3-4 番满贯；5-6 番跳满；7-10 番倍满；11-12 番三倍满；≥13 役满。
 * 亲家 1.5 倍，子家 1 倍，向上取整至 100。
 */
export function calcScore(
  fu: number,
  han: number,
  isDealer: boolean,
  _isTsumo: boolean,
): number {
  if (han >= 13) return isDealer ? 48000 : 32000;
  if (han >= 11) return isDealer ? 36000 : 24000;
  if (han >= 7) return isDealer ? 24000 : 16000;
  if (han >= 5) return isDealer ? 18000 : 12000;
  if (han >= 3) return isDealer ? 12000 : 8000;
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

/** 是否有役：任意一门役成立即可和了（可传 YakuContext 或 YakuContextFull） */
export function hasYaku(context: YakuContext | YakuContextFull): boolean {
  const yakuList = computeYaku(context as YakuContextFull);
  return yakuList.length > 0;
}

// --- 和牌形检测（用于役种计算前校验）---

const YAO_JIU_AND_ZI = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

function sameSuitBase(a: number, b: number, c: number): boolean {
  if (a >= 27 || b >= 27 || c >= 27) return false;
  const s = (x: number) => Math.floor(x / 9);
  return s(a) === s(b) && s(b) === s(c);
}

function isSequenceBase(a: number, b: number, c: number): boolean {
  return sameSuitBase(a, b, c) && a + 1 === b && b + 1 === c;
}

/** 12 张基础牌型能否组成 4 组（顺子/刻子） */
function canFormFourMeldsBase(arr: number[]): boolean {
  if (arr.length === 0) return true;
  const sorted = [...arr].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      for (let k = j + 1; k < sorted.length; k++) {
        const [a, b, c] = [sorted[i], sorted[j], sorted[k]];
        const rest = sorted.filter(
          (_, idx) => idx !== i && idx !== j && idx !== k,
        );
        const isTriple = a === b && b === c;
        const isSeq = isSequenceBase(a, b, c);
        if ((isTriple || isSeq) && canFormFourMeldsBase(rest)) return true;
      }
    }
  }
  return false;
}

/** 七对子：7 种基础牌型各 2 张，不可 4 张同型 */
export function isChiitoitsuRiichi(tiles: number[]): boolean {
  if (tiles.length !== 14) return false;
  const byBase = new Map<number, number>();
  for (const t of tiles) {
    const b = getBaseTile(t);
    byBase.set(b, (byBase.get(b) ?? 0) + 1);
  }
  const counts = [...byBase.values()];
  return counts.length === 7 && counts.every((c) => c === 2);
}

/** 国士无双：13 种幺九+字各 1 张，其中 1 种 2 张 */
export function isKokushiRiichi(tiles: number[]): boolean {
  if (tiles.length !== 14) return false;
  const byBase = new Map<number, number>();
  for (const t of tiles) {
    const b = getBaseTile(t);
    byBase.set(b, (byBase.get(b) ?? 0) + 1);
  }
  let hasPair = false;
  for (const type of YAO_JIU_AND_ZI) {
    const c = byBase.get(type) ?? 0;
    if (c === 0) return false;
    if (c >= 2) hasPair = true;
  }
  return hasPair;
}

/** 普通和牌形：4 面子 + 1 将（按基础牌型判定） */
export function isNormalWinShapeRiichi(tiles: number[]): boolean {
  if (tiles.length !== 14) return false;
  const base = tiles.map(getBaseTile).sort((a, b) => a - b);
  const byBase = new Map<number, number>();
  for (const b of base) byBase.set(b, (byBase.get(b) ?? 0) + 1);
  for (const [pairBase, count] of byBase) {
    if (count < 2) continue;
    const rest: number[] = [];
    let removed = 0;
    for (const b of base) {
      if (b === pairBase && removed < 2) {
        removed++;
        continue;
      }
      rest.push(b);
    }
    if (removed !== 2 || rest.length !== 12) continue;
    if (canFormFourMeldsBase(rest)) return true;
  }
  return false;
}

/** 是否为和牌形（七对子 / 国士 / 4 面子+1 将） */
export function isWinShapeRiichi(
  hand: number[],
  melds: { tiles: number[] }[],
): boolean {
  const all = [...hand, ...melds.flatMap((m) => m.tiles)];
  if (all.length !== 14) return false;
  if (isChiitoitsuRiichi(all)) return true;
  if (isKokushiRiichi(all)) return true;
  return isNormalWinShapeRiichi(all);
}

// --- 役种计算（返回 [{ id, name, han }]）---

/** 扩展的役判定上下文（含特殊和了方式、杠数等） */
export interface YakuContextFull extends YakuContext {
  /** 役种判定用：带 type 的副露（chi/peng/mingang/angang）；不传则按碰处理（视为副露） */
  meldsTyped?: {
    type: 'chi' | 'peng' | 'mingang' | 'angang';
    tiles: number[];
  }[];
  /** 岭上开花 */
  rinshan?: boolean;
  /** 抢杠（仅加杠） */
  chankan?: boolean;
  /** 海底摸月 */
  haitei?: boolean;
  /** 河底捞鱼 */
  hotei?: boolean;
  /** 本局自己开杠次数（明+暗） */
  numKan?: number;
}

export interface YakuResult {
  id: string;
  name: string;
  han: number;
}

/** 收集手牌+所有面子为 14 张（用于役判定） */
function allTilesFromContext(ctx: YakuContextFull): number[] {
  const melds =
    ctx.meldsTyped ??
    ctx.melds.map((m) => ({ type: 'peng' as const, tiles: m.tiles }));
  return [...ctx.hand, ...melds.flatMap((m) => m.tiles)];
}

/** 计算当前和牌的役种列表（可叠加），非和牌形返回空数组 */
export function computeYaku(ctx: YakuContextFull): YakuResult[] {
  const melds =
    ctx.meldsTyped ??
    ctx.melds.map((m) => ({ type: 'peng' as const, tiles: m.tiles }));
  const all = allTilesFromContext(ctx);
  if (all.length !== 14) return [];

  const menzen = isMenzhen(melds);
  const hasOpen = melds.some((m) => isOpenMeld(m));
  const results: YakuResult[] = [];

  // 国士无双（役满，优先）
  if (isKokushiRiichi(all)) {
    results.push({ id: 'kokushi', name: '国士无双', han: 13 });
    return results;
  }

  // 七对子（2 番，仅门前清）
  if (isChiitoitsuRiichi(all)) {
    if (menzen) results.push({ id: 'chiitoitsu', name: '七对子', han: 2 });
    if (ctx.isRiichi) results.push({ id: 'riichi', name: '立直', han: 1 });
    if (menzen && ctx.isTsumo)
      results.push({ id: 'menzen_tsumo', name: '门前清自摸和', han: 1 });
    if (ctx.ippatsuPossible)
      results.push({ id: 'ippatsu', name: '一发', han: 1 });
    if (ctx.rinshan) results.push({ id: 'rinshan', name: '岭上开花', han: 1 });
    if (ctx.chankan) results.push({ id: 'chankan', name: '抢杠', han: 1 });
    if (ctx.haitei) results.push({ id: 'haitei', name: '海底摸月', han: 1 });
    if (ctx.hotei) results.push({ id: 'hotei', name: '河底捞鱼', han: 1 });
    if (checkTanyao(all))
      results.push({ id: 'tanyao', name: '断幺九', han: 1 });
    const yakuHan = countYakuhai(ctx.hand, melds, ctx.seatWind, ctx.roundWind);
    if (yakuHan > 0)
      results.push({ id: 'yakuhai', name: '役牌', han: yakuHan });
    return results;
  }

  // 非和牌形不继续算役
  if (!isNormalWinShapeRiichi(all)) return [];

  // --- 1 番役 ---
  if (ctx.isRiichi) results.push({ id: 'riichi', name: '立直', han: 1 });
  if (menzen && ctx.isTsumo)
    results.push({ id: 'menzen_tsumo', name: '门前清自摸和', han: 1 });
  if (checkTanyao(all)) results.push({ id: 'tanyao', name: '断幺九', han: 1 });
  const yakuHan = countYakuhai(ctx.hand, melds, ctx.seatWind, ctx.roundWind);
  if (yakuHan > 0) results.push({ id: 'yakuhai', name: '役牌', han: yakuHan });
  if (ctx.ippatsuPossible)
    results.push({ id: 'ippatsu', name: '一发', han: 1 });
  if (ctx.rinshan) results.push({ id: 'rinshan', name: '岭上开花', han: 1 });
  if (ctx.chankan) results.push({ id: 'chankan', name: '抢杠', han: 1 });
  if (ctx.haitei) results.push({ id: 'haitei', name: '海底摸月', han: 1 });
  if (ctx.hotei) results.push({ id: 'hotei', name: '河底捞鱼', han: 1 });

  // 平和（仅门前清，需型为全顺子+无役牌将+双面听，此处简化：门前清且无役牌将且 4 组均为顺子）
  if (menzen && checkPinfuRiichi(all))
    results.push({ id: 'pinfu', name: '平和', han: 1 });

  // --- 2 番役 ---
  if (checkToitoiRiichi(all))
    results.push({ id: 'toitoi', name: '对对和', han: 2 });
  if (checkSankantsuRiichi(melds))
    results.push({ id: 'sankantsu', name: '三杠子', han: 2 });
  if (checkIttsuRiichi(all)) {
    results.push({ id: 'ittsu', name: '一气通贯', han: hasOpen ? 1 : 2 });
  }
  if (checkHonrotoRiichi(all))
    results.push({ id: 'honroto', name: '混老头', han: 2 });
  if (checkShousangenRiichi(all))
    results.push({ id: 'shousangen', name: '小三元', han: 2 });
  if (menzen && checkRyanpeikouRiichi(all))
    results.push({ id: 'ryanpeikou', name: '两杯口', han: 2 });
  if (checkSanshokuRiichi(all)) {
    results.push({ id: 'sanshoku', name: '三色同顺', han: hasOpen ? 1 : 2 });
  }
  if (checkSanshokudoukouRiichi(all))
    results.push({ id: 'sanshokudoukou', name: '三色同刻', han: 2 });
  const ankoCount = countAnkouRiichi(melds, all);
  if (ankoCount >= 3) results.push({ id: 'sanankou', name: '三暗刻', han: 2 });

  // --- 3 番 / 6 番（副露降番）---
  if (checkHonitsuRiichi(all))
    results.push({ id: 'honitsu', name: '混一色', han: hasOpen ? 2 : 3 });
  if (checkChinitsuRiichi(all))
    results.push({ id: 'chinitsu', name: '清一色', han: hasOpen ? 5 : 6 });

  // --- 役满（简化：只做部分）---
  if ((ctx.numKan ?? 0) >= 4)
    results.push({ id: 'sukantsu', name: '四杠子', han: 13 });
  if (checkSuankouRiichi(melds, ctx.hand, ctx.isTsumo))
    results.push({ id: 'suankou', name: '四暗刻', han: 13 });
  if (checkDaisangenRiichi(all))
    results.push({ id: 'daisangen', name: '大三元', han: 13 });
  if (checkTsuuiisouRiichi(all))
    results.push({ id: 'tsuuiisou', name: '字一色', han: 13 });
  if (checkChinrotoRiichi(all))
    results.push({ id: 'chinroto', name: '清老头', han: 13 });

  return results;
}

/** 役种列表合计番数（役满时通常取该役满的番数，不与其他叠加） */
export function getTotalHan(results: YakuResult[]): number {
  if (results.length === 0) return 0;
  const yakuman = results.find((r) => r.han >= 13);
  if (yakuman) return yakuman.han;
  return results.reduce((sum, r) => sum + r.han, 0);
}

/**
 * 平和型：存在一种分解使得 4 组均为顺子、将牌非役牌。
 * 通过实际分解 14 张牌来判定，避免计数启发式的误判。
 */
function checkPinfuRiichi(tiles: number[]): boolean {
  if (tiles.length !== 14) return false;
  const base = tiles.map(getBaseTile);
  const yakuhaiTypes = new Set([27, 28, 29, 30, 31, 32, 33]);

  const counts = new Array(34).fill(0);
  for (const b of base) counts[b]++;

  function allSequences(remaining: number): boolean {
    if (remaining === 0) return true;
    let first = -1;
    for (let i = 0; i < 34; i++) {
      if (counts[i] > 0) {
        first = i;
        break;
      }
    }
    if (first === -1) return false;
    if (first >= 27) return false;
    if (first % 9 > 6) return false;
    if (counts[first + 1] <= 0 || counts[first + 2] <= 0) return false;
    counts[first]--;
    counts[first + 1]--;
    counts[first + 2]--;
    const ok = allSequences(remaining - 3);
    counts[first]++;
    counts[first + 1]++;
    counts[first + 2]++;
    return ok;
  }

  for (let pair = 0; pair < 34; pair++) {
    if (counts[pair] < 2) continue;
    if (yakuhaiTypes.has(pair)) continue;
    counts[pair] -= 2;
    if (allSequences(12)) {
      counts[pair] += 2;
      return true;
    }
    counts[pair] += 2;
  }
  return false;
}

/** 对对和：4 刻子/杠子 + 1 对子（全部为刻子型） */
function checkToitoiRiichi(all: number[]): boolean {
  const base = all.map(getBaseTile);
  const counts = new Map<number, number>();
  for (const b of base) counts.set(b, (counts.get(b) ?? 0) + 1);
  let tripleOrQuad = 0;
  let pair = 0;
  for (const c of counts.values()) {
    if (c >= 3) tripleOrQuad++;
    if (c === 2) pair++;
    if (c === 1) return false;
  }
  return tripleOrQuad === 4 && pair === 1;
}

/** 一气通贯：同花色 123+456+789 */
function checkIttsuRiichi(all: number[]): boolean {
  const base = all.map(getBaseTile);
  for (const suit of [0, 9, 18]) {
    const need = [
      suit,
      suit + 1,
      suit + 2,
      suit + 3,
      suit + 4,
      suit + 5,
      suit + 6,
      suit + 7,
      suit + 8,
    ];
    const have = need.filter((n) => base.includes(n));
    if (have.length < 9) continue;
    const count = new Map<number, number>();
    for (const b of base)
      if (b >= suit && b < suit + 9) count.set(b, (count.get(b) ?? 0) + 1);
    if (
      (count.get(suit) ?? 0) >= 1 &&
      (count.get(suit + 3) ?? 0) >= 1 &&
      (count.get(suit + 6) ?? 0) >= 1
    )
      return true;
  }
  return false;
}

/** 混老头：仅 1/9+字牌，且全为刻子/杠子 */
function checkHonrotoRiichi(tiles: number[]): boolean {
  const base = tiles.map(getBaseTile);
  const yaoJiuZi = new Set(YAO_JIU_AND_ZI);
  for (const b of base) {
    if (!yaoJiuZi.has(b)) return false;
  }
  const counts = new Map<number, number>();
  for (const b of base) counts.set(b, (counts.get(b) ?? 0) + 1);
  for (const c of counts.values()) {
    if (c !== 2 && c !== 3 && c !== 4) return false;
  }
  return true;
}

/** 小三元：中发白中两组刻子+一组对子 */
function checkShousangenRiichi(all: number[]): boolean {
  const base = all.map(getBaseTile);
  const d = [31, 32, 33];
  let triplet = 0;
  let pair = 0;
  for (const t of d) {
    const c = base.filter((b) => b === t).length;
    if (c >= 3) triplet++;
    if (c === 2) pair++;
  }
  return triplet === 2 && pair === 1;
}

/** 两杯口：两组同形顺子（门前清） */
function checkRyanpeikouRiichi(tiles: number[]): boolean {
  const base = tiles.map(getBaseTile);
  const sequences = getAllSequences(base);

  // 统计每种顺子的数量
  const seqCount = new Map<string, number>();
  for (const seq of sequences) {
    const key = seq.sort().join(',');
    seqCount.set(key, (seqCount.get(key) ?? 0) + 1);
  }

  // 至少有两组相同的顺子
  return [...seqCount.values()].some((count) => count >= 2);
}

/** 获取所有可能的顺子组合 */
function getAllSequences(tiles: number[]): number[][] {
  const sequences: number[][] = [];
  const sorted = [...tiles].sort((a, b) => a - b);

  for (let i = 0; i < sorted.length - 2; i++) {
    for (let j = i + 1; j < sorted.length - 1; j++) {
      for (let k = j + 1; k < sorted.length; k++) {
        const [a, b, c] = [sorted[i], sorted[j], sorted[k]];
        if (isSequenceBase(a, b, c)) {
          sequences.push([a, b, c]);
        }
      }
    }
  }
  return sequences;
}

/** 暗刻数：手牌中的刻子+暗杠数（非吃、非明碰、非明杠） */
function countAnkouRiichi(
  melds: { type: string; tiles: number[] }[],
  hand: number[],
): number {
  let anko = 0;
  const handBase = hand.map(getBaseTile);
  const handCounts = new Map<number, number>();
  for (const b of handBase) handCounts.set(b, (handCounts.get(b) ?? 0) + 1);
  for (const c of handCounts.values()) {
    if (c >= 3) anko++;
  }
  for (const m of melds) {
    if (m.type === 'angang') anko++;
  }
  return anko;
}

/** 混一色：一种数牌花色+字牌（数牌仅一种花色） */
function checkHonitsuRiichi(tiles: number[]): boolean {
  const base = tiles.map(getBaseTile);
  const numTiles = base.filter((b) => b < 27);
  if (numTiles.length === 0) return false;
  const suits = new Set(numTiles.map((b) => Math.floor(b / 9)));
  return suits.size === 1;
}

/** 清一色：仅一种数牌花色，无字牌 */
function checkChinitsuRiichi(tiles: number[]): boolean {
  const base = tiles.map(getBaseTile);
  if (base.some((b) => b >= 27)) return false;
  const suits = new Set(base.map((b) => Math.floor(b / 9)));
  return suits.size === 1;
}

/** 大三元：中发白均为刻子/杠子（手牌+面子中各有至少 3 张） */
function checkDaisangenRiichi(all: number[]): boolean {
  const base = all.map(getBaseTile);
  for (const t of [31, 32, 33]) {
    if (base.filter((b) => b === t).length < 3) return false;
  }
  return true;
}

/** 字一色：全字牌 */
function checkTsuuiisouRiichi(tiles: number[]): boolean {
  return tiles.every((t) => getBaseTile(t) >= 27);
}

/** 清老头：全 1/9 牌且全刻子/杠子 */
function checkChinrotoRiichi(tiles: number[]): boolean {
  const base = tiles.map(getBaseTile);
  const yaoJiu = [0, 8, 9, 17, 18, 26];
  for (const b of base) {
    if (!yaoJiu.includes(b)) return false;
  }
  const counts = new Map<number, number>();
  for (const b of base) counts.set(b, (counts.get(b) ?? 0) + 1);
  for (const c of counts.values()) {
    if (c !== 2 && c !== 3 && c !== 4) return false;
  }
  return true;
}

/** 三色同顺：三种花色都有相同数字的顺子 */
function checkSanshokuRiichi(all: number[]): boolean {
  const base = all.map(getBaseTile);
  const sequencesBySuit: number[][][] = [[], [], []]; // 万、条、筒

  // 收集每种花色的顺子
  for (let suit = 0; suit < 3; suit++) {
    const suitTiles = base.filter((b) => Math.floor(b / 9) === suit);
    for (let i = 0; i <= suitTiles.length - 3; i++) {
      for (let j = i + 1; j <= suitTiles.length - 2; j++) {
        for (let k = j + 1; k <= suitTiles.length - 1; k++) {
          const [a, b, c] = [suitTiles[i], suitTiles[j], suitTiles[k]];
          if (isSequenceBase(a, b, c)) {
            sequencesBySuit[suit].push([a % 9, b % 9, c % 9]); // 存储相对数字
          }
        }
      }
    }
  }

  // 检查是否存在三种花色都有相同数字序列的顺子
  for (const seq1 of sequencesBySuit[0]) {
    for (const seq2 of sequencesBySuit[1]) {
      for (const seq3 of sequencesBySuit[2]) {
        if (arraysEqual(seq1, seq2) && arraysEqual(seq2, seq3)) {
          return true;
        }
      }
    }
  }
  return false;
}

/** 三色同刻：三种花色都有相同数字的刻子 */
function checkSanshokudoukouRiichi(all: number[]): boolean {
  const base = all.map(getBaseTile);
  const countsBySuit: Map<number, number>[] = [
    new Map(), // 万
    new Map(), // 条
    new Map(), // 筒
  ];

  // 统计每种花色中各数字的数量
  for (const b of base) {
    if (b < 27) {
      // 数牌
      const suit = Math.floor(b / 9);
      const num = b % 9;
      countsBySuit[suit].set(num, (countsBySuit[suit].get(num) ?? 0) + 1);
    }
  }

  // 检查是否存在三种花色都有相同数字且都至少3张的情况
  for (let num = 0; num < 9; num++) {
    const count0 = countsBySuit[0].get(num) ?? 0;
    const count1 = countsBySuit[1].get(num) ?? 0;
    const count2 = countsBySuit[2].get(num) ?? 0;
    if (count0 >= 3 && count1 >= 3 && count2 >= 3) {
      return true;
    }
  }
  return false;
}

/** 三杠子：三个杠子 */
function checkSankantsuRiichi(
  melds: { type: string; tiles: number[] }[],
): boolean {
  const kanCount = melds.filter(
    (m) => m.type === 'mingang' || m.type === 'angang',
  ).length;
  return kanCount >= 3;
}

/** 四暗刻：四个暗刻/暗杠（门前清自摸） */
function checkSuankouRiichi(
  melds: { type: string; tiles: number[] }[],
  hand: number[],
  isTsumo: boolean,
): boolean {
  if (!isTsumo) return false; // 必须自摸

  let ankoCount = 0;
  const handBase = hand.map(getBaseTile);
  const handCounts = new Map<number, number>();

  // 统计手牌中的刻子数
  for (const b of handBase) {
    handCounts.set(b, (handCounts.get(b) ?? 0) + 1);
  }
  for (const count of handCounts.values()) {
    if (count >= 3) ankoCount++;
  }

  // 加上暗杠数
  for (const m of melds) {
    if (m.type === 'angang') ankoCount++;
  }

  return ankoCount >= 4;
}

/** 辅助函数：比较两个数组是否相等 */
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
