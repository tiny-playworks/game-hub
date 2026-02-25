/**
 * 四川麻将规则库（血战到底/血流成河通用）
 * 1. 牌具：108 张，仅万/条/筒，无字牌、无花牌
 * 2. 铁律：缺门才能胡、禁止吃牌、一炮多响有效
 * 3. 定缺：开局选定缺门花色，胡牌前须打完定缺
 * 4. 番型：平胡/对对胡/清一色/七对/龙七对等，加分项乘算
 */

/** 27 种牌：0-8 万 9-17 条 18-26 筒（川麻无字牌） */
export const TILE_LABELS_SICHUAN: string[] = [
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
];

/** 番型为乘算：最终番数 = 基础番 × 自摸×2 × 杠上花×2 × … */
export const SICHUAN_FAN_MULTIPLIERS = {
  /** 基础番：平胡1、对对胡2、清一色4、七对4、龙七对8、清对8、清七对16、全幺九8 */
  PING_HU: 1,
  DUI_DUI_HU: 2,
  QING_YI_SE: 4,
  QI_DUI: 4,
  LONG_QI_DUI: 8,
  QING_DUI: 8,
  QING_QI_DUI: 16,
  QUAN_YAO_JIU: 8,
  /** 加分项（倍数）：自摸×2、杠上花×2、杠上炮×2、抢杠胡×2、金钩钓×2 */
  ZIMO: 2,
  GANG_SHANG_HUA: 2,
  GANG_SHANG_PAO: 2,
  QIANG_GANG_HU: 2,
  JIN_GOU_DIAO: 2,
} as const;

export type SuitType = 'wan' | 'tiao' | 'tong'; // 川麻仅万、条、筒

export const SUIT_NAMES: Record<SuitType, string> = {
  wan: '万子',
  tiao: '条子',
  tong: '筒子',
};

export interface SichuanGameState {
  hands: number[][];
  wall: number[];
  discardPiles: number[][];
  melds: Meld[][];
  currentPlayer: number;
  drawnTile: number | null;
  phase: 'queMen' | 'discard' | 'claim' | 'gameOver';
  lastDiscard: number | null;
  lastDiscardFrom: number | null;
  claimIndex: number;
  lastClaimMsg: string | null;
  /** 要牌阶段：当前可选项（供 UI 显示）。川麻无吃牌 */
  claimOption: {
    hu?: boolean;
    gang?: boolean;
    peng?: boolean;
  } | null;
  /** 要牌阶段：当前轮到决策的玩家 */
  claimPlayer: number | null;
  /** 要牌轮次：hu/gang/peng + index（川麻无 chi） */
  claimRound: { phase: 'hu' | 'gang' | 'peng'; index: number } | null;
  dealer: number;
  // 四川麻将特有属性
  queMen: (SuitType | null)[];
  isQueMenDeclared: boolean[];
  fengWei: number;
  roundNumber: number;
  scores: number[];
  huPlayers: number[];
  isGameOver: boolean;
  // 刮风下雨相关
  gangRecords: GangRecord[];
  rainPoints: number[][]; // 刮风下雨积分记录
}

export interface GangRecord {
  player: number;
  type: 'mingGang' | 'anGang' | 'jiaGang';
  tile: number;
  round: number;
  /** 补杠时原碰牌的点炮者，用于计分 */
  fromPlayer?: number;
}

export interface Meld {
  type: 'peng' | 'minggang' | 'angang' | 'jiagang'; // 川麻无吃，无 chi
  tiles: number[];
  fromPlayer?: number;
}

/** 判断牌的花色（川麻仅 0-26 万/条/筒） */
export function getSuit(tile: number): SuitType {
  if (tile < 9) return 'wan';
  if (tile < 18) return 'tiao';
  return 'tong';
}

/** 判断手牌是否符合定缺要求 */
export function isValidQueMenHand(
  hand: number[],
  queMenSuit: SuitType | null,
): boolean {
  if (!queMenSuit) return true;
  return !hand.some((tile) => getSuit(tile) === queMenSuit);
}

/** 创建四川麻将牌堆：108 张，仅万/条/筒（0-26 各 4 张） */
export function createSichuanDeck(): number[] {
  const deck: number[] = [];
  const TILE_TYPES = 27; // 0-8 万 9-17 条 18-26 筒
  const COPIES = 4;

  for (let t = 0; t < TILE_TYPES; t++) {
    for (let c = 0; c < COPIES; c++) {
      deck.push(t);
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/** 发牌 */
export function dealSichuan(
  deck: number[],
  dealer: number,
): [number[][], number[]] {
  const hands: number[][] = [[], [], [], []];
  const d = [...deck];

  for (let i = 0; i < 13 * 4; i++) {
    const t = d.shift();
    if (t === undefined) throw new Error('Deck empty');
    hands[i % 4].push(t);
  }
  const dealerDraw = d.shift();
  if (dealerDraw === undefined) throw new Error('Deck empty');
  hands[dealer].push(dealerDraw);

  for (let i = 0; i < 4; i++) {
    hands[i].sort((a, b) => a - b);
  }

  return [hands, d];
}

/** 初始化游戏状态 */
export function initSichuanGame(dealer = 0): SichuanGameState {
  const deck = createSichuanDeck();
  const [hands, wall] = dealSichuan(deck, dealer);

  return {
    hands,
    wall,
    discardPiles: [[], [], [], []],
    melds: [[], [], [], []],
    currentPlayer: dealer,
    drawnTile: null,
    phase: 'queMen',
    lastDiscard: null,
    lastDiscardFrom: null,
    claimIndex: 0,
    lastClaimMsg: null,
    claimOption: null,
    claimPlayer: null,
    claimRound: null,
    dealer,
    queMen: [null, null, null, null],
    isQueMenDeclared: [false, false, false, false],
    fengWei: 0,
    roundNumber: 1,
    scores: [0, 0, 0, 0],
    huPlayers: [],
    isGameOver: false,
    gangRecords: [],
    rainPoints: [[], [], [], []],
  };
}

/** 加杠选项：碰的刻子可加杠（补杠/巴杠），返回 meld 索引列表 */
export function getJiagangOptionsSichuan(
  hand: number[],
  melds: Meld[],
): number[] {
  const indices: number[] = [];
  melds.forEach((m, i) => {
    if (m.type === 'peng' && m.tiles.length === 3) {
      const t = m.tiles[0];
      if (hand.includes(t)) indices.push(i);
    }
  });
  return indices;
}

/** 检查是否可以碰牌 */
export function canPengSichuan(hand: number[], tile: number): boolean {
  const count = hand.filter((t) => t === tile).length;
  return count >= 2;
}

/** 检查是否可以明杠 */
export function canMingangSichuan(hand: number[], tile: number): boolean {
  const count = hand.filter((t) => t === tile).length;
  return count >= 3;
}

/** 获取暗杠选项：返回可暗杠的牌型列表（牌型编号） */
export function getAngangOptionsSichuan(hand: number[]): number[] {
  const counts = new Map<number, number>();
  for (const tile of hand) {
    counts.set(tile, (counts.get(tile) || 0) + 1);
  }
  const options: number[] = [];
  counts.forEach((count, tile) => {
    if (count === 4) options.push(tile);
  });
  return options;
}

/** 检查是否胡牌。hand 为未摆亮手牌，melds 为明牌，drawnTile 为点炮时的牌（可选） */
export function checkWinSichuan(
  hand: number[],
  melds: Meld[],
  queMenSuit: SuitType | null,
  drawnTile?: number,
): boolean {
  const all = drawnTile !== undefined ? [...hand, drawnTile] : [...hand];
  const fromMelds = melds.flatMap((m) => m.tiles);
  const combined = [...all, ...fromMelds];
  if (combined.length !== 14) return false;
  if (!isValidQueMenHand(combined, queMenSuit)) return false;
  if (isQiDui(all)) return true;
  return checkBasicWinPattern(combined);
}

/** 基础胡牌模式检查（4 面子+1 将，川麻仅万条筒 0-26） */
function checkBasicWinPattern(tiles: number[]): boolean {
  if (tiles.length !== 14) return false;

  const counts = new Array(27).fill(0);
  for (const tile of tiles) {
    if (tile < 0 || tile >= 27) return false;
    counts[tile]++;
  }

  for (let jiang = 0; jiang < 27; jiang++) {
    if (counts[jiang] >= 2) {
      const tempCounts = [...counts];
      tempCounts[jiang] -= 2;

      if (canFormFourMelds(tempCounts)) {
        return true;
      }
    }
  }

  return false;
}

/** 检查能否组成四个面子（顺子或刻子，仅 0-26） */
function canFormFourMelds(counts: number[]): boolean {
  let firstNonZero = -1;
  for (let i = 0; i < 27; i++) {
    if (counts[i] > 0) {
      firstNonZero = i;
      break;
    }
  }

  if (firstNonZero === -1) return true;

  const count = counts[firstNonZero];

  if (count >= 3) {
    counts[firstNonZero] -= 3;
    if (canFormFourMelds(counts)) return true;
    counts[firstNonZero] += 3;
  }

  if (firstNonZero % 9 < 7) {
    if (counts[firstNonZero + 1] > 0 && counts[firstNonZero + 2] > 0) {
      counts[firstNonZero]--;
      counts[firstNonZero + 1]--;
      counts[firstNonZero + 2]--;

      if (canFormFourMelds(counts)) return true;

      counts[firstNonZero]++;
      counts[firstNonZero + 1]++;
      counts[firstNonZero + 2]++;
    }
  }

  return false;
}

/** 计算番数（乘算）：最终番数 = 基础番 × 自摸×2 × 杠上花×2 × … */
export function calculateFanSichuan(
  hand: number[],
  melds: Meld[],
  isZimo: boolean,
  queMenSuit: SuitType | null,
): FanResult {
  const mult = SICHUAN_FAN_MULTIPLIERS;
  let baseFan: number = mult.PING_HU;
  const fanTypes: string[] = [];

  // 七对/龙七对（特殊牌型，无顺子）
  if (isQiDui(hand)) {
    if (isLongQiDui(hand)) {
      baseFan = mult.LONG_QI_DUI;
      fanTypes.push('龙七对');
    } else {
      baseFan = mult.QI_DUI;
      fanTypes.push('七对');
    }
    const qing = isQingYiSe(hand, melds, queMenSuit);
    if (qing) {
      baseFan = mult.QING_QI_DUI;
      fanTypes.length = 0;
      fanTypes.push('清七对');
    }
  } else {
    // 普通型：平胡 / 对对胡 / 清一色 / 清对 / 全幺九
    const duidui = isDuiDuiHu(hand, melds);
    const qing = isQingYiSe(hand, melds, queMenSuit);
    const yaojiu = isQuanYaoJiu(hand, melds);
    if (qing && duidui) {
      baseFan = mult.QING_DUI;
      fanTypes.push('清对');
    } else if (yaojiu && duidui) {
      baseFan = mult.QUAN_YAO_JIU;
      fanTypes.push('全幺九');
    } else if (qing) {
      baseFan = mult.QING_YI_SE;
      fanTypes.push('清一色');
    } else if (duidui) {
      baseFan = mult.DUI_DUI_HU;
      fanTypes.push('对对胡');
    } else {
      fanTypes.push('平胡');
    }
  }

  let totalFan = baseFan;

  // 加分项（乘算）
  if (isZimo) {
    totalFan *= mult.ZIMO;
    fanTypes.push('自摸×2');
  }
  const justGangDraw = melds.some((m) => m.type === 'jiagang');
  if (justGangDraw) {
    totalFan *= mult.GANG_SHANG_HUA;
    fanTypes.push('杠上花×2');
  }
  if (isJinGouDiao(hand, melds)) {
    totalFan *= mult.JIN_GOU_DIAO;
    fanTypes.push('金钩钓×2');
  }

  return { fan: totalFan, fanTypes };
}

interface FanResult {
  fan: number;
  fanTypes: string[];
}

/** 判断是否清一色 */
function isQingYiSe(
  hand: number[],
  melds: Meld[],
  queMenSuit: SuitType | null,
): boolean {
  if (!queMenSuit) return false;

  // 获取手牌中除了定缺花色外的所有花色
  const suitsInHand = new Set(
    hand.map((tile) => getSuit(tile)).filter((suit) => suit !== queMenSuit),
  );
  melds.forEach((meld) => {
    meld.tiles.forEach((tile) => {
      const suit = getSuit(tile);
      if (suit !== queMenSuit) {
        suitsInHand.add(suit);
      }
    });
  });

  // 如果只有一种花色（除了定缺），则是清一色
  return suitsInHand.size === 1;
}

/** 判断是否七对 */
function isQiDui(hand: number[]): boolean {
  if (hand.length !== 14) return false;

  const counts = new Map<number, number>();
  for (const tile of hand) {
    counts.set(tile, (counts.get(tile) || 0) + 1);
  }

  // 七对需要恰好7个对子
  let pairCount = 0;
  for (const count of counts.values()) {
    if (count === 2 || count === 4) {
      pairCount += count / 2;
    }
  }

  return pairCount === 7;
}

/** 判断是否龙七对（七对且含 1 组 4 张相同） */
function isLongQiDui(hand: number[]): boolean {
  if (!isQiDui(hand)) return false;
  const counts = new Map<number, number>();
  for (const tile of hand) counts.set(tile, (counts.get(tile) || 0) + 1);
  return Array.from(counts.values()).some((c) => c === 4);
}

/** 判断是否对对胡（全为刻子/杠子+将，无顺子） */
function isDuiDuiHu(hand: number[], melds: Meld[]): boolean {
  const all = [...hand, ...melds.flatMap((m) => m.tiles)];
  if (all.length !== 14) return false;
  const counts = new Array(27).fill(0);
  for (const t of all) {
    if (t < 0 || t >= 27) return false;
    counts[t]++;
  }
  for (let i = 0; i < 27; i++) {
    if (counts[i] === 0) continue;
    if (counts[i] >= 2) {
      counts[i] -= 2;
      if (canFormFourKezi(counts)) return true;
      counts[i] += 2;
    }
  }
  return false;
}

/** 能否组成 4 个刻子（无顺子） */
function canFormFourKezi(counts: number[]): boolean {
  let first = -1;
  for (let i = 0; i < 27; i++) {
    if (counts[i] > 0) {
      first = i;
      break;
    }
  }
  if (first === -1) return true;
  if (counts[first] >= 3) {
    counts[first] -= 3;
    if (canFormFourKezi(counts)) return true;
    counts[first] += 3;
  }
  return false;
}

/** 判断是否全幺九（仅 1、9 序数牌组成的对对胡） */
function isQuanYaoJiu(hand: number[], melds: Meld[]): boolean {
  const all = [...hand, ...melds.flatMap((m) => m.tiles)];
  for (const t of all) {
    if (t < 0 || t >= 27) return false;
    const rank = t % 9;
    if (rank !== 0 && rank !== 8) return false; // 仅 1、9
  }
  return isDuiDuiHu(hand, melds);
}

/** 判断是否金钩钓（胡牌时手牌仅剩 1 张，单吊；即 4 组全为碰/杠） */
function isJinGouDiao(hand: number[], melds: Meld[]): boolean {
  return melds.length === 4 && hand.length === 2 && hand[0] === hand[1];
}

/** 获取牌的显示标签 */
export function getTileLabelSichuan(tile: number): string {
  return TILE_LABELS_SICHUAN[tile] || '';
}

/** 获取玩家可选的定缺花色 */
export function getPlayerQueMenOptions(hand: number[]): SuitType[] {
  const suitsInHand = new Set(hand.map(getSuit));
  return Array.from(suitsInHand);
}

/**
 * 计算杠牌积分（刮风下雨）。
 * 明杠（点杠）：其他 3 家各付 1 倍基础分
 * 补杠（巴杠）：原碰牌时的点炮者付 2 倍基础分
 * 暗杠：其他 3 家各付 2 倍基础分
 *
 * 返回四家各自的杠分收支数组 [p0, p1, p2, p3]。
 */
export function calculateGangSettlement(
  gangRecords: GangRecord[],
  _baseScore = 1,
): number[] {
  const scores = [0, 0, 0, 0];

  for (const record of gangRecords) {
    const ganger = record.player;
    switch (record.type) {
      case 'mingGang': {
        for (let i = 0; i < 4; i++) {
          if (i !== ganger) {
            scores[i] -= _baseScore;
            scores[ganger] += _baseScore;
          }
        }
        break;
      }
      case 'jiaGang': {
        const from = record.fromPlayer;
        if (from !== undefined && from !== ganger) {
          scores[from] -= 2 * _baseScore;
          scores[ganger] += 2 * _baseScore;
        }
        break;
      }
      case 'anGang': {
        for (let i = 0; i < 4; i++) {
          if (i !== ganger) {
            scores[i] -= 2 * _baseScore;
            scores[ganger] += 2 * _baseScore;
          }
        }
        break;
      }
    }
  }

  return scores;
}

/** 获取定缺状态描述 */
export function getQueMenStatus(
  queMen: (SuitType | null)[],
  isQueMenDeclared: boolean[],
): string {
  if (isQueMenDeclared.every((declared) => declared)) {
    return `定缺: ${queMen.map((suit, i) => `玩家${i + 1}${suit || '未定'}`).join(', ')}`;
  }
  return '正在定缺中...';
}
