import { expect, test } from '@rstest/core';
import {
  type Board,
  createInitialBoard,
  isInCheck,
  movePiece,
} from '../src/lib/chess';
import {
  type ChessMove,
  chooseChessMove,
  getAllChessMoves,
} from '../src/lib/chessAi';

function blankBoard(): Board {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
}

/** 线性同余随机源，保证测试可复现 */
function makeRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function sameMove(a: ChessMove, b: ChessMove): boolean {
  return (
    a.from[0] === b.from[0] &&
    a.from[1] === b.from[1] &&
    a.to[0] === b.to[0] &&
    a.to[1] === b.to[1]
  );
}

test('初始局面白方有 20 个合法走法', () => {
  expect(getAllChessMoves(createInitialBoard(), 'white')).toHaveLength(20);
  expect(getAllChessMoves(createInitialBoard(), 'black')).toHaveLength(20);
});

test('初始局面返回合法走法', () => {
  const board = createInitialBoard();
  const legal = getAllChessMoves(board, 'white');
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    const move = chooseChessMove(board, 'white', difficulty, makeRng(3));
    expect(move).not.toBeNull();
    if (!move) continue;
    expect(legal.some((m) => sameMove(m, move))).toBe(true);
  }
});

test('吃掉无保护的后', () => {
  const board = blankBoard();
  board[7][0] = { type: 'K', side: 'white' };
  board[4][0] = { type: 'R', side: 'white' };
  board[4][4] = { type: 'Q', side: 'black' };
  board[0][7] = { type: 'K', side: 'black' };
  for (const difficulty of ['normal', 'hard'] as const) {
    const move = chooseChessMove(board, 'white', difficulty);
    expect(move).toEqual({ from: [4, 0], to: [4, 4] });
  }
});

test('找到一步将杀（底线杀）', () => {
  const board = blankBoard();
  board[0][7] = { type: 'K', side: 'black' };
  board[1][6] = { type: 'P', side: 'black' };
  board[1][7] = { type: 'P', side: 'black' };
  board[7][0] = { type: 'R', side: 'white' };
  board[7][4] = { type: 'K', side: 'white' };
  for (const difficulty of ['normal', 'hard'] as const) {
    const move = chooseChessMove(board, 'white', difficulty);
    expect(move).toEqual({ from: [7, 0], to: [0, 0] });
    if (!move) continue;
    const next = movePiece(board, 7, 0, 0, 0);
    expect(isInCheck(next, 'black')).toBe(true);
    expect(getAllChessMoves(next, 'black')).toHaveLength(0);
  }
});

test('hard 能看到两步将杀（双车梯形杀）', () => {
  const board = blankBoard();
  board[0][7] = { type: 'K', side: 'black' };
  board[2][0] = { type: 'R', side: 'white' };
  board[3][1] = { type: 'R', side: 'white' };
  board[7][4] = { type: 'K', side: 'white' };
  // 起始局面不存在一步杀
  expect(getAllChessMoves(board, 'white').length).toBeGreaterThan(0);
  const move = chooseChessMove(board, 'white', 'hard');
  expect(move).not.toBeNull();
  if (!move) return;
  // 第一步把车横到第 1 行封住黑王，黑王只能沿底线横移，第二步用另一只车封底线成杀
  const afterFirst = movePiece(
    board,
    move.from[0],
    move.from[1],
    move.to[0],
    move.to[1],
  );
  const replies = getAllChessMoves(afterFirst, 'black');
  expect(replies.length).toBeGreaterThan(0);
  for (const reply of replies) {
    const afterReply = movePiece(
      afterFirst,
      reply.from[0],
      reply.from[1],
      reply.to[0],
      reply.to[1],
    );
    const mate = chooseChessMove(afterReply, 'white', 'normal');
    expect(mate).not.toBeNull();
    if (!mate) continue;
    const final = movePiece(
      afterReply,
      mate.from[0],
      mate.from[1],
      mate.to[0],
      mate.to[1],
    );
    expect(isInCheck(final, 'black')).toBe(true);
    expect(getAllChessMoves(final, 'black')).toHaveLength(0);
  }
});

test('不会走出让自己王被将的棋', () => {
  const board = blankBoard();
  board[7][4] = { type: 'K', side: 'white' };
  board[6][4] = { type: 'N', side: 'white' };
  board[6][0] = { type: 'P', side: 'white' };
  board[0][4] = { type: 'R', side: 'black' };
  board[0][0] = { type: 'K', side: 'black' };
  // 被牵制的马没有任何合法走法
  expect(
    getAllChessMoves(board, 'white').some(
      (m) => m.from[0] === 6 && m.from[1] === 4,
    ),
  ).toBe(false);
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    const move = chooseChessMove(board, 'white', difficulty, makeRng(17));
    expect(move).not.toBeNull();
    if (!move) continue;
    const next = movePiece(
      board,
      move.from[0],
      move.from[1],
      move.to[0],
      move.to[1],
    );
    expect(isInCheck(next, 'white')).toBe(false);
  }
});

test('传入固定随机源时结果确定', () => {
  const board = createInitialBoard();
  const first = chooseChessMove(board, 'white', 'easy', makeRng(2026));
  expect(first).not.toBeNull();
  for (let i = 0; i < 3; i++) {
    const again = chooseChessMove(board, 'white', 'easy', makeRng(2026));
    expect(again).toEqual(first);
  }
  expect(chooseChessMove(board, 'white', 'normal')).toEqual(
    chooseChessMove(board, 'white', 'normal', makeRng(1)),
  );
});

test('无合法走法时返回 null（逼和）', () => {
  const board = blankBoard();
  board[0][0] = { type: 'K', side: 'black' };
  board[2][1] = { type: 'Q', side: 'white' };
  board[7][7] = { type: 'K', side: 'white' };
  expect(isInCheck(board, 'black')).toBe(false);
  expect(getAllChessMoves(board, 'black')).toHaveLength(0);
  expect(chooseChessMove(board, 'black', 'normal')).toBeNull();
});

test('hard（深度 3）在时间预算内完成', () => {
  const board = createInitialBoard();
  const start = Date.now();
  const move = chooseChessMove(board, 'white', 'hard');
  const elapsed = Date.now() - start;
  expect(move).not.toBeNull();
  expect(elapsed).toBeLessThan(2000);
});
