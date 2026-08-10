import { expect, test } from '@rstest/core';
import {
  type Board,
  createInitialBoard,
  findKing,
  getAllSafeMoves,
  getLegalMoves,
  getPieceValue,
  getSafeMoves,
  getXiangqiResult,
  isInCheck,
  movePiece,
  type Piece,
  type PieceType,
  type Side,
  toChineseMoveNotation,
  XIANGQI_COLS,
  XIANGQI_ROWS,
} from '../src/lib/xiangqi';

function emptyBoard(): Board {
  return Array.from({ length: XIANGQI_ROWS }, () =>
    Array.from({ length: XIANGQI_COLS }, () => null as Piece | null),
  );
}

function place(
  board: Board,
  row: number,
  col: number,
  type: PieceType,
  side: Side,
): void {
  board[row][col] = { type, side };
}

function hasMove(moves: [number, number][], r: number, c: number): boolean {
  return moves.some(([mr, mc]) => mr === r && mc === c);
}

test('开局局面双方均未被将军', () => {
  const board = createInitialBoard();
  expect(isInCheck(board, 'red')).toBe(false);
  expect(isInCheck(board, 'black')).toBe(false);
});

test('黑车直射红帅判定为将军，中间有子则解除', () => {
  const board = emptyBoard();
  place(board, 9, 4, 'k', 'red');
  place(board, 0, 3, 'k', 'black');
  place(board, 5, 4, 'r', 'black');
  expect(isInCheck(board, 'red')).toBe(true);

  place(board, 7, 4, 'p', 'red'); // 垫子解将
  expect(isInCheck(board, 'red')).toBe(false);
});

test('马与炮的将军判定考虑蹩腿和炮架', () => {
  const horseBoard = emptyBoard();
  place(horseBoard, 9, 4, 'k', 'red');
  place(horseBoard, 0, 3, 'k', 'black');
  place(horseBoard, 7, 3, 'h', 'black');
  expect(isInCheck(horseBoard, 'red')).toBe(true);
  place(horseBoard, 8, 3, 'p', 'red'); // 蹩马腿
  expect(isInCheck(horseBoard, 'red')).toBe(false);

  const cannonBoard = emptyBoard();
  place(cannonBoard, 9, 4, 'k', 'red');
  place(cannonBoard, 0, 3, 'k', 'black');
  place(cannonBoard, 2, 4, 'c', 'black');
  expect(isInCheck(cannonBoard, 'red')).toBe(false); // 无炮架
  place(cannonBoard, 5, 4, 'p', 'red'); // 架上炮架
  expect(isInCheck(cannonBoard, 'red')).toBe(true);
});

test('将帅照面视为双方均被将军', () => {
  const board = emptyBoard();
  place(board, 9, 4, 'k', 'red');
  place(board, 0, 4, 'k', 'black');
  expect(isInCheck(board, 'red')).toBe(true);
  expect(isInCheck(board, 'black')).toBe(true);

  place(board, 4, 4, 'p', 'red'); // 中间有子即不算照面
  expect(isInCheck(board, 'red')).toBe(false);
  expect(isInCheck(board, 'black')).toBe(false);
});

test('getSafeMoves 过滤掉走后自己被将军的着法（牵制子不能离线）', () => {
  const board = emptyBoard();
  place(board, 9, 4, 'k', 'red');
  place(board, 0, 3, 'k', 'black');
  place(board, 7, 4, 'r', 'red'); // 被黑车牵制在纵线四
  place(board, 2, 4, 'r', 'black');

  const raw = getLegalMoves(board, 7, 4);
  expect(hasMove(raw, 7, 3)).toBe(true); // 未过滤时允许横走
  const safe = getSafeMoves(board, 7, 4);
  expect(hasMove(safe, 7, 3)).toBe(false); // 离线即送将
  expect(hasMove(safe, 6, 4)).toBe(true); // 沿线进退仍合法
  expect(hasMove(safe, 2, 4)).toBe(true); // 也可直接吃掉黑车
  expect(safe.every(([, c]) => c === 4)).toBe(true);
});

test('getSafeMoves 禁止走出与对方将照面的着法', () => {
  const board = emptyBoard();
  place(board, 9, 4, 'k', 'red');
  place(board, 0, 4, 'k', 'black');
  place(board, 5, 4, 'h', 'red'); // 唯一挡在双将中间的子

  expect(getLegalMoves(board, 5, 4)).toHaveLength(8);
  expect(getSafeMoves(board, 5, 4)).toHaveLength(0); // 马一动就照面
});

test('构造的绝杀局面返回 checkmate 且胜方正确', () => {
  const board = emptyBoard();
  place(board, 0, 4, 'k', 'black');
  place(board, 9, 3, 'k', 'red');
  place(board, 0, 0, 'r', 'red'); // 底线将军
  place(board, 1, 0, 'r', 'red'); // 封住次底线

  expect(isInCheck(board, 'black')).toBe(true);
  expect(getAllSafeMoves(board, 'black')).toHaveLength(0);
  expect(getXiangqiResult(board, 'black')).toEqual({
    kind: 'checkmate',
    winner: 'red',
  });
  expect(getXiangqiResult(board, 'red')).toBeNull();
});

test('困毙（无棋可走但未被将军）同样判负', () => {
  const board = emptyBoard();
  place(board, 0, 4, 'k', 'black');
  place(board, 9, 0, 'k', 'red');
  place(board, 2, 3, 'r', 'red'); // 控制纵线三
  place(board, 2, 5, 'r', 'red'); // 控制纵线五
  place(board, 2, 4, 'p', 'red'); // 控制 (1,4)，但攻击不到 (0,4)

  expect(isInCheck(board, 'black')).toBe(false);
  expect(getAllSafeMoves(board, 'black')).toHaveLength(0);
  expect(getXiangqiResult(board, 'black')).toEqual({
    kind: 'stalemate',
    winner: 'red',
  });
});

test('开局红黑双方各有 44 种合法着法', () => {
  const board = createInitialBoard();
  expect(getAllSafeMoves(board, 'red')).toHaveLength(44);
  expect(getAllSafeMoves(board, 'black')).toHaveLength(44);
});

test('getAllSafeMoves 返回的着法全部真实合法', () => {
  const board = createInitialBoard();
  for (const move of getAllSafeMoves(board, 'red')) {
    const piece = board[move.from[0]][move.from[1]];
    expect(piece?.side).toBe('red');
    const next = movePiece(board, ...move.from, ...move.to);
    expect(isInCheck(next, 'red')).toBe(false);
  }
});

test('中文记谱：平、进、退与红黑纵线编号', () => {
  const board = createInitialBoard();
  expect(toChineseMoveNotation(board, { from: [7, 7], to: [7, 4] })).toBe(
    '炮二平五',
  );
  expect(toChineseMoveNotation(board, { from: [9, 7], to: [7, 6] })).toBe(
    '马二进三',
  );
  expect(toChineseMoveNotation(board, { from: [6, 2], to: [5, 2] })).toBe(
    '兵七进一',
  );
  expect(toChineseMoveNotation(board, { from: [2, 7], to: [2, 4] })).toBe(
    '炮8平5',
  );
  expect(toChineseMoveNotation(board, { from: [3, 2], to: [4, 2] })).toBe(
    '卒3进1',
  );
  expect(toChineseMoveNotation(board, { from: [0, 1], to: [2, 2] })).toBe(
    '马2进3',
  );
});

test('中文记谱：同线双子用前/后区分', () => {
  const board = emptyBoard();
  place(board, 9, 4, 'k', 'red');
  place(board, 0, 4, 'k', 'black');
  place(board, 5, 0, 'r', 'red');
  place(board, 9, 0, 'r', 'red');
  place(board, 0, 8, 'r', 'black');
  place(board, 4, 8, 'r', 'black');

  expect(toChineseMoveNotation(board, { from: [5, 0], to: [5, 4] })).toBe(
    '前车平五',
  );
  expect(toChineseMoveNotation(board, { from: [9, 0], to: [7, 0] })).toBe(
    '后车进二',
  );
  expect(toChineseMoveNotation(board, { from: [4, 8], to: [2, 8] })).toBe(
    '前车退2',
  );
  expect(toChineseMoveNotation(board, { from: [0, 8], to: [0, 5] })).toBe(
    '后车平6',
  );
});

test('棋子价值符合车 > 炮 > 马 > 士象 > 兵，将最大', () => {
  expect(getPieceValue('r')).toBe(900);
  expect(getPieceValue('c')).toBe(450);
  expect(getPieceValue('h')).toBe(400);
  expect(getPieceValue('e')).toBe(200);
  expect(getPieceValue('a')).toBe(200);
  expect(getPieceValue('p')).toBe(100);
  expect(getPieceValue('k')).toBe(100000);
});

/** 参考实现：逐个敌子枚举走法看能否吃到将，用于和快速实现对拍 */
function bruteForceInCheck(board: Board, side: Side): boolean {
  const king = findKing(board, side);
  if (!king) return false;
  const enemy: Side = side === 'red' ? 'black' : 'red';
  const enemyKing = findKing(board, enemy);
  if (enemyKing && enemyKing[1] === king[1]) {
    let blocked = false;
    const lo = Math.min(king[0], enemyKing[0]) + 1;
    const hi = Math.max(king[0], enemyKing[0]);
    for (let r = lo; r < hi; r++) {
      if (board[r][king[1]]) blocked = true;
    }
    if (!blocked) return true;
  }
  for (let r = 0; r < XIANGQI_ROWS; r++) {
    for (let c = 0; c < XIANGQI_COLS; c++) {
      const p = board[r][c];
      if (!p || p.side !== enemy) continue;
      if (hasMove(getLegalMoves(board, r, c), king[0], king[1])) return true;
    }
  }
  return false;
}

test('随机对局中 isInCheck 与逐子枚举的参考实现结果一致', () => {
  let seed = 20260810;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  let board = createInitialBoard();
  let side: Side = 'red';
  for (let step = 0; step < 400; step++) {
    expect(isInCheck(board, 'red')).toBe(bruteForceInCheck(board, 'red'));
    expect(isInCheck(board, 'black')).toBe(bruteForceInCheck(board, 'black'));

    const candidates: [number, number, number, number][] = [];
    for (let r = 0; r < XIANGQI_ROWS; r++) {
      for (let c = 0; c < XIANGQI_COLS; c++) {
        const p = board[r][c];
        if (!p || p.side !== side) continue;
        for (const [tr, tc] of getLegalMoves(board, r, c)) {
          candidates.push([r, c, tr, tc]);
        }
      }
    }
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(random() * candidates.length)];
    board = movePiece(board, pick[0], pick[1], pick[2], pick[3]);
    side = side === 'red' ? 'black' : 'red';
  }
});
