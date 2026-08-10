export type TicPlayer = 'X' | 'O';

export interface TicMove {
  player: TicPlayer;
  index: number;
}

export const TIC_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function boardFromMoves(moves: TicMove[]): (TicPlayer | null)[] {
  const board: (TicPlayer | null)[] = Array(9).fill(null);
  for (const m of moves) {
    board[m.index] = m.player;
  }
  return board;
}

export function getWinningLine(moves: TicMove[]): number[] | null {
  const board = boardFromMoves(moves);
  for (const line of TIC_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return line;
    }
  }
  return null;
}

/** 若存在连线，胜者为 moves 中最后一手的玩家 */
export function getWinner(moves: TicMove[]): TicPlayer | null {
  if (!getWinningLine(moves)) return null;
  return moves[moves.length - 1]?.player ?? null;
}

/**
 * 落子；非法（占用或已结束）返回 null。
 * 每方最多 3 子，第 4 子时移除该方最旧子。
 */
export function applyMove(
  moves: TicMove[],
  player: TicPlayer,
  index: number,
): TicMove[] | null {
  if (getWinner(moves)) return null;
  const board = boardFromMoves(moves);
  if (board[index] !== null) return null;

  const nextMoves = [...moves, { player, index }];
  if (nextMoves.filter((m) => m.player === player).length > 3) {
    const oldestIndex = nextMoves.findIndex((m) => m.player === player);
    if (oldestIndex !== -1) {
      nextMoves.splice(oldestIndex, 1);
    }
  }
  return nextMoves;
}

/** 当前玩家已有 3 子时，返回其最旧子索引（即将淡出） */
export function fadingIndex(
  moves: TicMove[],
  currentPlayer: TicPlayer,
): number | null {
  if (getWinner(moves)) return null;
  const playerMoves = moves.filter((m) => m.player === currentPlayer);
  if (playerMoves.length === 3) return playerMoves[0].index;
  return null;
}

function opponentOf(player: TicPlayer): TicPlayer {
  return player === 'X' ? 'O' : 'X';
}

/**
 * AI 选点：能赢则赢，否则挡对手，否则在空位中按 rng 随机。
 * 模拟时使用 applyMove 语义（含 3 子上限）。
 */
export function chooseTicTacToeMove(
  moves: TicMove[],
  aiPlayer: TicPlayer,
  rng: () => number = Math.random,
): number | null {
  if (getWinner(moves)) return null;

  const board = boardFromMoves(moves);
  const emptyCells = board
    .map((c, i) => (c === null ? i : -1))
    .filter((i) => i !== -1);

  if (emptyCells.length === 0) return null;

  const findWinningIndex = (player: TicPlayer): number | null => {
    for (const i of emptyCells) {
      const simulated = applyMove(moves, player, i);
      if (simulated && getWinner(simulated) === player) return i;
    }
    return null;
  };

  const winMove = findWinningIndex(aiPlayer);
  if (winMove !== null) return winMove;

  const blockMove = findWinningIndex(opponentOf(aiPlayer));
  if (blockMove !== null) return blockMove;

  const pick = Math.floor(rng() * emptyCells.length);
  return emptyCells[Math.min(pick, emptyCells.length - 1)];
}
