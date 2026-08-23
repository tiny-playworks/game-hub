/**
 * 将本项目的日麻状态转换为 riichi-rs-bundlers 的 calc() 入参，并用其结果作为和了算分来源。
 * 牌 id：本项目 0-33 基础牌型，34-36 为赤5万/赤5筒/赤5条；riichi-rs 使用 Tile 枚举 1-34。
 */

import {
  calc,
  type RiichiInput,
  type RiichiResult,
  type Tile,
} from 'riichi-rs-bundlers';
import { getBaseTile, getDoraFromIndicator } from '@/lib/mahjongRiichi';

type Meld = RiichiInput['open_part'][number];

/** 本项目牌 id (0-33 或 34-36 赤) → riichi-rs Tile。赤5 转为对应普通 5 的 Tile，aka 数量由调用方统计。 */
export function ourTileToRs(tile: number): Tile {
  const base = getBaseTile(tile);
  if (base <= 8) return (base + 1) as Tile;
  if (base <= 17) return (base - 9 + 19) as Tile;
  if (base <= 26) return (base - 18 + 10) as Tile;
  if (base === 27) return 28 as Tile;
  if (base === 28) return 29 as Tile;
  if (base === 29) return 30 as Tile;
  if (base === 30) return 31 as Tile;
  if (base === 31) return 34 as Tile;
  if (base === 32) return 33 as Tile;
  if (base === 33) return 32 as Tile;
  throw new RangeError(`Unknown riichi tile id: ${tile}`);
}

/**
 * riichi-rs 的 hairi 输出使用从 0 开始的牌型编号，且花色顺序为万/筒/条；
 * 将其转换为本项目的万/条/筒以及中/发/白顺序。
 */
export function rsHairiTileToOur(tile: number): number {
  if (!Number.isInteger(tile) || tile < 0 || tile > 33) {
    throw new RangeError(`Unknown riichi-rs hairi tile id: ${tile}`);
  }
  if (tile <= 8) return tile;
  if (tile <= 17) return tile + 9;
  if (tile <= 26) return tile - 9;
  if (tile <= 30) return tile;
  if (tile === 31) return 33;
  if (tile === 32) return 32;
  return 31;
}

const AKA_5_MAN = 34;
const AKA_5_PIN = 35;
const AKA_5_SOU = 36;

export interface GameStateForRs {
  hand: number[];
  melds: {
    type: 'chi' | 'peng' | 'mingang' | 'angang' | 'kakan';
    tiles: number[];
  }[];
  /** 明宝牌表示牌（开局 1 张 + 每开杠 1 张） */
  doraIndicators: number[];
  roundWind: number;
  dealer: number;
  riichiDeclared: boolean[];
  wallLength: number;
  lastDiscard: number | null;
  /** 是否岭上开花（自摸）或抢杠（荣和） */
  afterKan?: boolean;
  /** 一发：立直后一巡内和了且本巡无吃碰杠 */
  ippatsu?: boolean;
  /** 和了者座位（0–3）；缺省 0，与「自家」一致 */
  winnerSeat?: number;
}

function meldsToRs(melds: GameStateForRs['melds']): Meld[] {
  return melds.map((meld) => {
    const isOpen =
      meld.type === 'chi' ||
      meld.type === 'peng' ||
      meld.type === 'mingang' ||
      meld.type === 'kakan';
    if (meld.tiles.length === 3) {
      return [
        true,
        [
          ourTileToRs(meld.tiles[0]),
          ourTileToRs(meld.tiles[1]),
          ourTileToRs(meld.tiles[2]),
        ],
      ] as Meld;
    }
    if (meld.tiles.length === 4) {
      return [
        isOpen,
        [
          ourTileToRs(meld.tiles[0]),
          ourTileToRs(meld.tiles[1]),
          ourTileToRs(meld.tiles[2]),
          ourTileToRs(meld.tiles[3]),
        ],
      ] as Meld;
    }
    throw new RangeError(
      `A riichi meld must contain 3 or 4 tiles, got ${meld.tiles.length}`,
    );
  });
}

/** 构建只用于结构分析的 calc_hairi 入参；杠仍按一个面子处理。 */
export function buildRiichiHairiInput(
  hand: number[],
  melds: GameStateForRs['melds'] = [],
): RiichiInput {
  return {
    closed_part: hand.map(ourTileToRs),
    open_part: meldsToRs(melds),
    calc_hairi: true,
  };
}

/** 场风 → riichi-rs 风牌 Tile */
function roundWindToTile(rw: number): Tile {
  return (28 + rw) as Tile;
}

/** 自风：座位 0 在 roundWind、dealer 下的自风 → Tile */
function seatWindToTile(seat: number, dealer: number): Tile {
  const sw = (seat - dealer + 4) % 4;
  return (28 + sw) as Tile;
}

function findWinningTileIndex(hand: number[], winningTile: number): number {
  for (let i = hand.length - 1; i >= 0; i -= 1) {
    if (hand[i] === winningTile) return i;
  }
  const base = getBaseTile(winningTile);
  for (let i = hand.length - 1; i >= 0; i -= 1) {
    if (getBaseTile(hand[i]) === base) return i;
  }
  return -1;
}

function normalizeClosedPartForWin(
  state: GameStateForRs,
  isTsumo: boolean,
  winningTile?: number,
): number[] {
  const closed = [...state.hand];
  const completeClosedCount = 14 - state.melds.length * 3;
  if (
    !isTsumo &&
    winningTile != null &&
    closed.length === completeClosedCount
  ) {
    const index = findWinningTileIndex(closed, winningTile);
    if (index < 0) {
      throw new RangeError(
        'Ron winning tile is not present in the completed hand',
      );
    }
    closed.splice(index, 1);
  }
  if (isTsumo && winningTile != null) {
    const index = findWinningTileIndex(closed, winningTile);
    if (index < 0) {
      throw new RangeError('Tsumo winning tile is not present in the hand');
    }
    const [tile] = closed.splice(index, 1);
    closed.push(tile);
  }
  return closed;
}

/** 构建 RiichiInput，用于和了时调用 calc。tsumo 时 winningTile 为最后一张手牌（已含在 hand 中）；ron 时为 lastDiscard。 */
export function buildRiichiInput(
  state: GameStateForRs,
  isTsumo: boolean,
  winningTile?: number,
): RiichiInput {
  const w = state.winnerSeat ?? 0;
  const normalizedHand = normalizeClosedPartForWin(state, isTsumo, winningTile);
  const closed: Tile[] = [];
  let aka = 0;
  for (const t of normalizedHand) {
    closed.push(ourTileToRs(t));
    if (t === AKA_5_MAN || t === AKA_5_PIN || t === AKA_5_SOU) aka += 1;
  }
  for (const meld of state.melds) {
    for (const tile of meld.tiles) {
      if (tile === AKA_5_MAN || tile === AKA_5_PIN || tile === AKA_5_SOU) {
        aka += 1;
      }
    }
  }
  if (
    !isTsumo &&
    (winningTile === AKA_5_MAN ||
      winningTile === AKA_5_PIN ||
      winningTile === AKA_5_SOU)
  ) {
    aka += 1;
  }
  const open_part = meldsToRs(state.melds);
  const doraTiles = state.doraIndicators.map((ind) =>
    getDoraFromIndicator(ind),
  );
  const options: RiichiInput['options'] = {
    dora: doraTiles.map((t) => ourTileToRs(t)),
    aka_count: aka,
    riichi: state.riichiDeclared[w],
    ippatsu: state.ippatsu ?? false,
    double_riichi: false,
    after_kan: state.afterKan ?? false,
    tile_discarded_by_someone: isTsumo
      ? -1
      : winningTile != null
        ? ourTileToRs(winningTile)
        : (-1 as Tile),
    bakaze: roundWindToTile(state.roundWind),
    jikaze: seatWindToTile(w, state.dealer),
    allow_aka: true,
    allow_kuitan: true,
    with_kiriage: false,
    last_tile: state.wallLength <= 0 && (state.lastDiscard != null || isTsumo),
  };
  return {
    closed_part: closed,
    open_part,
    options,
    calc_hairi: false,
  };
}

/** riichi-rs 役 id → 中文名（仅常用） */
const YAKU_ID_TO_NAME: Record<number, string> = {
  0: '国士无双十三面',
  1: '国士无双',
  2: '纯正九莲宝灯',
  3: '九莲宝灯',
  4: '四暗刻单骑',
  5: '四暗刻',
  6: '大四喜',
  7: '小四喜',
  8: '大三元',
  9: '字一色',
  10: '绿一色',
  11: '清老头',
  12: '四杠子',
  13: '天和',
  14: '地和',
  15: '人和',
  17: '清一色',
  18: '混一色',
  19: '两杯口',
  20: '纯全带幺九',
  21: '混全带幺九',
  22: '对对和',
  23: '混老头',
  24: '三杠子',
  25: '小三元',
  26: '三色同刻',
  27: '三暗刻',
  28: '七对子',
  29: '双立直',
  30: '一气通贯',
  31: '三色同顺',
  32: '断幺九',
  33: '平和',
  34: '一杯口',
  35: '门前清自摸和',
  36: '立直',
  37: '一发',
  38: '岭上开花',
  39: '抢杠',
  40: '海底摸月',
  41: '河底捞鱼',
  42: '场风·东',
  43: '场风·南',
  44: '场风·西',
  45: '场风·北',
  46: '自风·东',
  47: '自风·南',
  48: '自风·西',
  49: '自风·北',
  50: '白',
  51: '发',
  52: '中',
  53: '宝牌',
  54: '里宝牌',
  55: '赤宝牌',
};

export function rsResultToYakuList(
  rs: RiichiResult,
): { id: string; name: string; han: number }[] {
  const list: { id: string; name: string; han: number }[] = [];
  const yaku = rs.yaku as Record<string, number>;
  for (const [idStr, han] of Object.entries(yaku)) {
    const id = Number.parseInt(idStr, 10);
    if (Number.isNaN(id) || han <= 0) continue;
    list.push({
      id: idStr,
      name: YAKU_ID_TO_NAME[id] ?? `役${id}`,
      han,
    });
  }
  return list;
}

/** @deprecated 仅保留兼容；生产调用应使用 riichiRules.evaluateWin 获取可区分的错误与精确支付。 */
export function calcWithRiichiRs(input: RiichiInput): {
  fu: number;
  han: number;
  ten: number;
  yaku: { id: string; name: string; han: number }[];
} | null {
  try {
    const result = calc(input);
    if (!result.is_agari) return null;
    return {
      fu: result.fu,
      han: result.han,
      ten: result.ten,
      yaku: rsResultToYakuList(result),
    };
  } catch {
    return null;
  }
}
