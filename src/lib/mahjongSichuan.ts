/**
 * 四川麻将规则库
 * 特色规则：
 * 1. 血战到底 - 一家胡牌后其他人继续打
 * 2. 刮风下雨 - 带根、杠上开花等番型
 * 3. 缺门 - 必须缺一门花色才能胡牌
 * 4. 定缺 - 游戏开始前选定缺少的花色
 */

/** 34 种牌型：0-8 万 9-17 条 18-26 筒 27-33 字牌 */
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
  '东',
  '南',
  '西',
  '北',
  '中',
  '发',
  '白',
];

/** 四川麻将番型定义 */
export const SICHUAN_FAN_TYPES = {
  BASE: 1, // 基础番
  ZIMO: 1, // 自摸番
  GANG_FLOWER: 1, // 杠上开花番
  WITH_ROOT: 1, // 带根番
  QING_YI_SE: 2, // 清一色番
  QI_DUI: 2, // 七对番
  LONG_QI_DUI: 3, // 龙七对番
  HAO_HUA_QI_DUI: 4, // 豪华七对番
};

export type SuitType = 'wan' | 'tiao' | 'tong' | 'zi'; // 万、条、筒、字

export const SUIT_NAMES: Record<SuitType, string> = {
  wan: '万子',
  tiao: '条子',
  tong: '筒子',
  zi: '字牌',
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
  /** 要牌阶段：当前可选项（供 UI 显示） */
  claimOption: {
    hu?: boolean;
    gang?: boolean;
    peng?: boolean;
    chi?: [number, number][];
  } | null;
  /** 要牌阶段：当前轮到决策的玩家 */
  claimPlayer: number | null;
  /** 要牌轮次：hu/gang/peng/chi + index */
  claimRound: { phase: 'hu' | 'gang' | 'peng' | 'chi'; index: number } | null;
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
}

export interface Meld {
  type: 'chi' | 'peng' | 'minggang' | 'angang' | 'jiagang';
  tiles: number[];
  fromPlayer?: number;
}

/** 判断牌的花色 */
export function getSuit(tile: number): SuitType {
  if (tile < 9) return 'wan';
  if (tile < 18) return 'tiao';
  if (tile < 27) return 'tong';
  return 'zi';
}

/** 判断手牌是否符合定缺要求 */
export function isValidQueMenHand(
  hand: number[],
  queMenSuit: SuitType | null,
): boolean {
  if (!queMenSuit) return true;
  return !hand.some((tile) => getSuit(tile) === queMenSuit);
}

/** 创建四川麻将牌堆 */
export function createSichuanDeck(): number[] {
  const deck: number[] = [];
  const TILE_COUNT = 34;
  const COPIES = 4;

  for (let t = 0; t < TILE_COUNT; t++) {
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

/** 吃：只能吃上家的牌。返回可吃的组合 [ [牌1, 牌2], ... ]，与 lastTile 组成顺子 */
export function getChiOptionsSichuan(
  hand: number[],
  lastTile: number,
  fromPlayer: number,
  myIndex: number,
): [number, number][] {
  const 上家 = (myIndex + 3) % 4;
  if (fromPlayer !== 上家) return [];
  if (lastTile >= 27) return []; // 字牌不可吃
  const options: [number, number][] = [];
  const need = [
    [lastTile - 2, lastTile - 1],
    [lastTile - 1, lastTile + 1],
    [lastTile + 1, lastTile + 2],
  ].filter(
    ([a, b]) =>
      a >= 0 &&
      b < 27 &&
      Math.floor(a / 9) === Math.floor(b / 9) &&
      Math.floor(b / 9) === Math.floor(lastTile / 9),
  );
  for (const [a, b] of need) {
    const handCopy = [...hand];
    const ia = handCopy.indexOf(a);
    if (ia === -1) continue;
    handCopy.splice(ia, 1);
    const ib = handCopy.indexOf(b);
    if (ib === -1) continue;
    options.push([a, b]);
  }
  return options;
}

/** 加杠选项：碰的刻子可加杠，返回 meld 索引列表 */
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
  return checkBasicWinPattern(combined);
}

/** 基础胡牌模式检查 */
function checkBasicWinPattern(tiles: number[]): boolean {
  if (tiles.length !== 14) return false;

  const counts = new Array(34).fill(0);
  for (const tile of tiles) {
    counts[tile]++;
  }

  for (let jiang = 0; jiang < 34; jiang++) {
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

/** 检查能否组成四个面子 */
function canFormFourMelds(counts: number[]): boolean {
  let firstNonZero = -1;
  for (let i = 0; i < 34; i++) {
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

  if (firstNonZero < 27 && firstNonZero % 9 < 7) {
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

/** 计算番数 */
export function calculateFanSichuan(
  hand: number[],
  melds: Meld[],
  isZimo: boolean,
  queMenSuit: SuitType | null,
): FanResult {
  let fan = SICHUAN_FAN_TYPES.BASE;
  const fanTypes: string[] = ['基础番'];

  // 自摸番
  if (isZimo) {
    fan += SICHUAN_FAN_TYPES.ZIMO;
    fanTypes.push('自摸');
  }

  // 杠上开花番
  if (melds.some((m) => m.type === 'jiagang')) {
    fan += SICHUAN_FAN_TYPES.GANG_FLOWER;
    fanTypes.push('杠上开花');
  }

  // 带根番
  const hasKezi = melds.some(
    (m) => m.type === 'peng' || m.type === 'minggang' || m.type === 'angang',
  );
  if (hasKezi) {
    fan += SICHUAN_FAN_TYPES.WITH_ROOT;
    fanTypes.push('带根');
  }

  // 清一色番
  if (isQingYiSe(hand, melds, queMenSuit)) {
    fan += SICHUAN_FAN_TYPES.QING_YI_SE;
    fanTypes.push('清一色');
  }

  // 七对系列番型
  if (isQiDui(hand)) {
    if (isHaoHuaQiDui(hand)) {
      fan += SICHUAN_FAN_TYPES.HAO_HUA_QI_DUI;
      fanTypes.push('豪华七对');
    } else if (isLongQiDui(hand)) {
      fan += SICHUAN_FAN_TYPES.LONG_QI_DUI;
      fanTypes.push('龙七对');
    } else {
      fan += SICHUAN_FAN_TYPES.QI_DUI;
      fanTypes.push('七对');
    }
  }

  return { fan, fanTypes };
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

/** 判断是否龙七对 */
function isLongQiDui(hand: number[]): boolean {
  if (!isQiDui(hand)) return false;

  const counts = new Map<number, number>();
  for (const tile of hand) {
    counts.set(tile, (counts.get(tile) || 0) + 1);
  }

  // 龙七对需要至少有一个四张相同的牌
  return Array.from(counts.values()).some((count) => count === 4);
}

/** 判断是否豪华七对 */
function isHaoHuaQiDui(hand: number[]): boolean {
  if (!isQiDui(hand)) return false;

  const counts = new Map<number, number>();
  for (const tile of hand) {
    counts.set(tile, (counts.get(tile) || 0) + 1);
  }

  // 豪华七对需要至少有两个四张相同的牌
  const fourCount = Array.from(counts.values()).filter(
    (count) => count === 4,
  ).length;
  return fourCount >= 2;
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

/** 计算刮风下雨积分 */
export function calculateRainPoints(
  gangRecords: GangRecord[],
  currentPlayer: number,
): number {
  let points = 0;

  gangRecords.forEach((record) => {
    if (record.player === currentPlayer) {
      // 自己的杠
      switch (record.type) {
        case 'anGang':
          points += 2; // 暗杠得2分
          break;
        case 'mingGang':
          points += 1; // 明杠得1分
          break;
        case 'jiaGang':
          points += 1; // 加杠得1分
          break;
      }
    } else {
      // 别人的杠
      switch (record.type) {
        case 'anGang':
          points -= 2; // 别人暗杠输2分
          break;
        case 'mingGang':
          if (record.player === (currentPlayer + 2) % 4) {
            points -= 1; // 对家明杠输1分
          }
          break;
        case 'jiaGang':
          points -= 1; // 别人加杠输1分
          break;
      }
    }
  });

  return points;
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
