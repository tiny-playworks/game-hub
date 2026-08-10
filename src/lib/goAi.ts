/**
 * 围棋 9×9 启发式 AI。
 *
 * 不做蒙特卡洛搜索，只用一层「吃子 / 逃子 / 打吃 / 位置价值」的评估，
 * 目标是给入门玩家一个不会送死、也不会瞬间卡死浏览器的对手。
 */

import {
  canPlace,
  countLiberties,
  GO_SIZE,
  type GoState,
  getGroup,
  getScore,
  placeStone,
  type Stone,
} from './go';

export type GoDifficulty = 'easy' | 'normal' | 'hard';

export type GoAiMove =
  | { kind: 'play'; row: number; col: number }
  | { kind: 'pass' };

const ADJ: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const DIAG: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const inBounds = (r: number, c: number) =>
  r >= 0 && r < GO_SIZE && c >= 0 && c < GO_SIZE;

/** 到最近边线的距离，0 表示一路 */
const lineOf = (r: number, c: number) =>
  Math.min(r, c, GO_SIZE - 1 - r, GO_SIZE - 1 - c);

/**
 * (r,c) 是否是 side 的真眼：四邻全是己方，且对角线上敌子不超过允许数
 * （边角允许 0 个，中腹允许 1 个）。填自己的真眼是纯亏损，AI 必须避开。
 */
function isOwnEye(board: GoState['board'], r: number, c: number, side: Stone) {
  if (board[r][c]) return false;
  for (const [dr, dc] of ADJ) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    if (board[nr][nc] !== side) return false;
  }
  let enemyDiag = 0;
  let offBoardDiag = 0;
  for (const [dr, dc] of DIAG) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) {
      offBoardDiag += 1;
      continue;
    }
    if (board[nr][nc] && board[nr][nc] !== side) enemyDiag += 1;
  }
  return enemyDiag <= (offBoardDiag > 0 ? 0 : 1);
}

interface Candidate {
  row: number;
  col: number;
  score: number;
}

/** 评估在 (r,c) 落子的收益 */
function scoreMove(state: GoState, r: number, c: number): number {
  const side: Stone = state.blackTurn ? 'B' : 'W';
  const board = state.board;

  if (isOwnEye(board, r, c, side)) return Number.NEGATIVE_INFINITY;

  const next = placeStone(state, r, c);
  if (next === state) return Number.NEGATIVE_INFINITY;

  const capturedNow =
    side === 'B'
      ? next.whiteCaptured - state.whiteCaptured
      : next.blackCaptured - state.blackCaptured;

  let score = capturedNow * 140;

  // 自身死活：落子后这块棋剩几口气
  const myGroup = getGroup(next.board, r, c);
  const myLibs = countLiberties(next.board, myGroup);
  if (myLibs === 1 && capturedNow === 0) {
    score -= 220 + myGroup.length * 60; // 自紧一气，几乎总是坏棋
  } else if (myLibs === 2) {
    score -= 12;
  } else {
    score += Math.min(myLibs, 6) * 6;
  }

  for (const [dr, dc] of ADJ) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    const cell = board[nr][nc];
    if (!cell) continue;

    const group = getGroup(board, nr, nc);
    const libs = countLiberties(board, group);

    if (cell === side) {
      // 己方接不归：救被打吃的棋
      if (libs === 1 && myLibs >= 2) score += 90 + group.length * 45;
      score += 6; // 连接自己
    } else {
      // 打吃对方
      if (libs === 2) score += 34 + group.length * 12;
      score += 8; // 贴着对方走，争夺地盘
    }
  }

  // 位置价值：9 路盘三线最实用，一线基本无价值
  const line = lineOf(r, c);
  const POSITION = [-30, 4, 20, 14, 10];
  score += POSITION[Math.min(line, 4)];

  // 开局别下在自己已有的厚势里
  let ownNeighbours = 0;
  for (const [dr, dc] of [...ADJ, ...DIAG]) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc] === side) ownNeighbours += 1;
  }
  if (ownNeighbours >= 5) score -= 25;

  // 留下劫争的落点稍微降权，入门局面不鼓励打劫
  if (next.koPoint) score -= 10;

  return score;
}

/** 走完这一手后，对手能立刻提掉我多少子（hard 难度用来做一层前瞻） */
function opponentBestCapture(state: GoState): number {
  let best = 0;
  for (let r = 0; r < GO_SIZE; r++) {
    for (let c = 0; c < GO_SIZE; c++) {
      if (state.board[r][c]) continue;
      if (!canPlace(state, r, c)) continue;
      const after = placeStone(state, r, c);
      if (after === state) continue;
      const captured = state.blackTurn
        ? after.whiteCaptured - state.whiteCaptured
        : after.blackCaptured - state.blackCaptured;
      if (captured > best) best = captured;
    }
  }
  return best;
}

/**
 * 选择一手棋。返回 pass 的情况：没有任何不亏的点，或者对手已经 pass 且我方领先。
 */
export function chooseGoMove(
  state: GoState,
  difficulty: GoDifficulty = 'normal',
  rng: () => number = Math.random,
): GoAiMove {
  if (state.gameOver) return { kind: 'pass' };

  const side: Stone = state.blackTurn ? 'B' : 'W';

  // 对方虚着且我方已领先，跟着虚着结束对局，而不是无意义地继续填子
  if (state.lastPass) {
    const score = getScore(state);
    const myScore = side === 'B' ? score.black : score.white;
    const theirScore = side === 'B' ? score.white : score.black;
    if (myScore > theirScore) return { kind: 'pass' };
  }

  const candidates: Candidate[] = [];
  for (let r = 0; r < GO_SIZE; r++) {
    for (let c = 0; c < GO_SIZE; c++) {
      if (state.board[r][c]) continue;
      if (!canPlace(state, r, c)) continue;
      const score = scoreMove(state, r, c);
      if (score === Number.NEGATIVE_INFINITY) continue;
      candidates.push({ row: r, col: c, score });
    }
  }

  if (candidates.length === 0) return { kind: 'pass' };

  if (difficulty === 'hard') {
    // 只对最有希望的若干点做一层前瞻，避免 81 次全盘模拟拖慢界面
    candidates.sort((a, b) => b.score - a.score);
    for (const candidate of candidates.slice(0, 10)) {
      const after = placeStone(state, candidate.row, candidate.col);
      candidate.score -= opponentBestCapture(after) * 110;
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  if (difficulty === 'easy') {
    // 只保证不下亏损点，从前 40% 里随机挑，让新手有喘息空间
    const pool = candidates.filter((m) => m.score > -40);
    const usable = pool.length > 0 ? pool : candidates;
    const window = Math.max(1, Math.ceil(usable.length * 0.4));
    const picked = usable[Math.floor(rng() * window) % window];
    return { kind: 'play', row: picked.row, col: picked.col };
  }

  const best = candidates[0];
  // 全盘只剩亏损点时收手
  if (best.score < -60) return { kind: 'pass' };

  // 同分随机，避免每局开头一模一样
  const tied = candidates.filter((m) => m.score === best.score);
  const picked = tied[Math.floor(rng() * tied.length) % tied.length];
  return { kind: 'play', row: picked.row, col: picked.col };
}
