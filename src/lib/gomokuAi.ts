/** 五子棋 AI：经典棋型（威胁）评分 + 可选两层预判 */

import { GOMOKU_SIZE, type GomokuStone } from './gomoku';

export type GomokuDifficulty = 'easy' | 'normal' | 'hard';

const SIZE = GOMOKU_SIZE;
/** 空棋盘首手落天元 */
const CENTER_INDEX = 7 * SIZE + 7;
/** 候选点与已有棋子的最大距离，超出则视为无意义的落点 */
const CANDIDATE_RADIUS = 2;
/** 防守分权重：略低于进攻，保证能赢就赢、赢不了才堵 */
const DEFENSE_WEIGHT = 0.9;
/** easy / hard 参与随机或预判的候选点数量 */
const TOP_CANDIDATES = 8;

/** 棋型分值 */
const SCORE_FIVE = 10_000_000;
const SCORE_OPEN_FOUR = 1_000_000;
const SCORE_FOUR = 100_000;
const SCORE_OPEN_THREE = 10_000;
const SCORE_THREE = 1_000;
const SCORE_OPEN_TWO = 500;
const SCORE_TWO = 100;
/** 双三、双冲四等组合杀分值 */
const SCORE_DOUBLE_THREE = 100_000;

type Shape =
  | 'five'
  | 'openFour'
  | 'four'
  | 'openThree'
  | 'three'
  | 'openTwo'
  | 'two'
  | 'none';

const SHAPE_SCORE: Record<Shape, number> = {
  five: SCORE_FIVE,
  openFour: SCORE_OPEN_FOUR,
  four: SCORE_FOUR,
  openThree: SCORE_OPEN_THREE,
  three: SCORE_THREE,
  openTwo: SCORE_OPEN_TWO,
  two: SCORE_TWO,
  none: 0,
};

/**
 * 棋型模板，按威胁从大到小匹配。
 * `x` 己方子、`.` 空位、`#` 对方子或棋盘外。
 */
const SHAPE_PATTERNS: [Shape, string[]][] = [
  ['five', ['xxxxx']],
  ['openFour', ['.xxxx.']],
  ['four', ['xxxx.', '.xxxx', 'xx.xx', 'x.xxx', 'xxx.x']],
  ['openThree', ['.xxx.', '.x.xx.', '.xx.x.']],
  ['three', ['xxx.', '.xxx', 'xx.x', 'x.xx', 'x.x.x']],
  ['openTwo', ['.xx.', '.x.x.']],
  ['two', ['xx', 'x.x', 'x..x']],
];

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** 取样窗口半径，中心点在窗口的第 WINDOW_RADIUS 位 */
const WINDOW_RADIUS = 5;

function inBoard(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

/** 以 (r, c) 为中心、假定该点已落 stone，取该方向上长度 11 的棋型串 */
function buildLine(
  board: GomokuStone[],
  r: number,
  c: number,
  dr: number,
  dc: number,
  stone: 'B' | 'W',
): string {
  let line = '';
  for (let k = -WINDOW_RADIUS; k <= WINDOW_RADIUS; k++) {
    if (k === 0) {
      line += 'x';
      continue;
    }
    const nr = r + dr * k;
    const nc = c + dc * k;
    if (!inBoard(nr, nc)) {
      line += '#';
      continue;
    }
    const cell = board[nr * SIZE + nc];
    line += cell === null ? '.' : cell === stone ? 'x' : '#';
  }
  return line;
}

/** 模板是否命中，且命中的 `x` 中必须包含中心点（否则是落子前就存在的棋型） */
function matchesThroughCenter(line: string, pattern: string): boolean {
  const start0 = Math.max(0, WINDOW_RADIUS - pattern.length + 1);
  const startMax = Math.min(WINDOW_RADIUS, line.length - pattern.length);
  for (let start = start0; start <= startMax; start++) {
    if (pattern[WINDOW_RADIUS - start] !== 'x') continue;
    if (line.startsWith(pattern, start)) return true;
  }
  return false;
}

function shapeOfDirection(
  board: GomokuStone[],
  r: number,
  c: number,
  dr: number,
  dc: number,
  stone: 'B' | 'W',
): Shape {
  const line = buildLine(board, r, c, dr, dc, stone);
  for (const [shape, patterns] of SHAPE_PATTERNS) {
    for (const pattern of patterns) {
      if (matchesThroughCenter(line, pattern)) return shape;
    }
  }
  return 'none';
}

/** 假定 stone 落在 index 处的棋型总分（四个方向求和，再叠加组合杀加成） */
function shapeScoreAt(
  board: GomokuStone[],
  index: number,
  stone: 'B' | 'W',
): number {
  const r = Math.floor(index / SIZE);
  const c = index % SIZE;
  let sum = 0;
  let openFour = 0;
  let four = 0;
  let openThree = 0;
  for (const [dr, dc] of DIRS) {
    const shape = shapeOfDirection(board, r, c, dr, dc, stone);
    if (shape === 'five') return SCORE_FIVE;
    if (shape === 'openFour') openFour++;
    else if (shape === 'four') four++;
    else if (shape === 'openThree') openThree++;
    sum += SHAPE_SCORE[shape];
  }
  // 活四、双冲四必胜；四三杀次之；双活三再次
  if (openFour > 0 || four >= 2) return SCORE_OPEN_FOUR;
  if (four >= 1 && openThree >= 1) return SCORE_OPEN_FOUR / 2;
  if (openThree >= 2) return SCORE_DOUBLE_THREE;
  return sum;
}

/** 落点综合分：己方进攻分 + 对手在此落子的价值（防守分） */
function evaluateCell(
  board: GomokuStone[],
  index: number,
  stone: 'B' | 'W',
  opponent: 'B' | 'W',
): number {
  return (
    shapeScoreAt(board, index, stone) +
    shapeScoreAt(board, index, opponent) * DEFENSE_WEIGHT
  );
}

/** 只考虑距离已有棋子 CANDIDATE_RADIUS 以内的空点，大幅缩小搜索面 */
function getCandidates(board: GomokuStone[]): number[] {
  const candidates: number[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r * SIZE + c] !== null) continue;
      let near = false;
      for (let dr = -CANDIDATE_RADIUS; dr <= CANDIDATE_RADIUS && !near; dr++) {
        for (let dc = -CANDIDATE_RADIUS; dc <= CANDIDATE_RADIUS; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBoard(nr, nc)) continue;
          if (board[nr * SIZE + nc] !== null) {
            near = true;
            break;
          }
        }
      }
      if (near) candidates.push(r * SIZE + c);
    }
  }
  return candidates;
}

interface ScoredMove {
  index: number;
  score: number;
}

/** 按综合分降序排序（同分保持索引升序，保证结果稳定） */
function scoreCandidates(
  board: GomokuStone[],
  candidates: number[],
  stone: 'B' | 'W',
  opponent: 'B' | 'W',
): ScoredMove[] {
  const scored = candidates.map((index) => ({
    index,
    score: evaluateCell(board, index, stone, opponent),
  }));
  scored.sort((a, b) =>
    b.score === a.score ? a.index - b.index : b.score - a.score,
  );
  return scored;
}

/** 对手在该局面下的最佳落点得分，用于 hard 的两层预判 */
function bestReplyScore(
  board: GomokuStone[],
  stone: 'B' | 'W',
  opponent: 'B' | 'W',
): number {
  let best = 0;
  for (const index of getCandidates(board)) {
    const score = evaluateCell(board, index, opponent, stone);
    if (score > best) best = score;
  }
  return best;
}

/**
 * 为 stone 一方选择落点。
 * @param board 长度 GOMOKU_SIZE * GOMOKU_SIZE 的棋盘
 * @param stone AI 执子颜色
 * @param difficulty easy 仅必胜/必堵 + 随机；normal 棋型评分；hard 额外两层预判
 * @param rng 随机源，传入固定实现可得确定性结果
 * @returns 落点索引；棋盘已满时返回 null
 */
export function chooseGomokuMove(
  board: GomokuStone[],
  stone: 'B' | 'W',
  difficulty: GomokuDifficulty,
  rng: () => number = Math.random,
): number | null {
  const opponent: 'B' | 'W' = stone === 'B' ? 'W' : 'B';
  const candidates = getCandidates(board);
  if (candidates.length === 0) {
    // 空棋盘落天元；否则棋盘已满
    return board.every((cell) => cell === null) ? CENTER_INDEX : null;
  }

  // 1. 自己能成五直接成五
  for (const index of candidates) {
    if (shapeScoreAt(board, index, stone) >= SCORE_FIVE) return index;
  }
  // 2. 自己成不了五，则必须堵掉对手的成五点
  for (const index of candidates) {
    if (shapeScoreAt(board, index, opponent) >= SCORE_FIVE) return index;
  }

  const scored = scoreCandidates(board, candidates, stone, opponent);

  if (difficulty === 'easy') {
    const pool = scored.slice(0, Math.min(TOP_CANDIDATES, scored.length));
    const pick = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    return pool[Math.max(0, pick)].index;
  }

  if (difficulty === 'normal') return scored[0].index;

  // hard：对前若干候选点做「我落子 → 对手最优应手」的两层预判
  const shortlist = scored.slice(0, Math.min(TOP_CANDIDATES, scored.length));
  let best = shortlist[0].index;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const move of shortlist) {
    const next = board.slice();
    next[move.index] = stone;
    const score =
      move.score - bestReplyScore(next, stone, opponent) * DEFENSE_WEIGHT;
    if (score > bestScore) {
      bestScore = score;
      best = move.index;
    }
  }
  return best;
}
