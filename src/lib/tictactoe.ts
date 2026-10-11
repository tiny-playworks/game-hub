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
  rules: 'fading' | 'classic' = 'fading',
): TicMove[] | null {
  if (getWinner(moves)) return null;
  const board = boardFromMoves(moves);
  if (board[index] !== null) return null;

  const nextMoves = [...moves, { player, index }];
  if (
    rules === 'fading' &&
    nextMoves.filter((m) => m.player === player).length > 3
  ) {
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

// The classic nine-cell hard mode has a finite minimax tree and an unbeaten second player.
// Easy and normal retain the original three-stone rotation rule.
export function chooseTicDifficultyMove(
  moves: TicMove[],
  player: TicPlayer,
  difficulty: string,
  rng: () => number = Math.random,
): number | null {
  const board = boardFromMoves(moves),
    empty = board
      .map((cell, index) => (cell ? -1 : index))
      .filter((index) => index >= 0);
  if (getWinner(moves) || !empty.length) return null;
  if (difficulty === 'easy')
    return empty[Math.min(empty.length - 1, Math.floor(rng() * empty.length))];
  if (difficulty !== 'hard') return chooseTicTacToeMove(moves, player, rng);
  const cache = new Map<string, number>();
  const search = (position: TicMove[], turn: TicPlayer): number => {
    const winner = getWinner(position);
    if (winner)
      return winner === player ? 10 - position.length : position.length - 10;
    const cells = boardFromMoves(position);
    const free = cells.flatMap((cell, index) => (cell ? [] : [index]));
    if (!free.length) return 0;
    const key = turn + cells.map((cell) => cell ?? '-').join('');
    const known = cache.get(key);
    if (known !== undefined) return known;
    const scores = free.map((index) =>
      search(
        applyMove(position, turn, index, 'classic') ?? position,
        opponentOf(turn),
      ),
    );
    const value = turn === player ? Math.max(...scores) : Math.min(...scores);
    cache.set(key, value);
    return value;
  };
  return [...empty].sort(
    (a, b) =>
      search(
        applyMove(moves, player, b, 'classic') ?? moves,
        opponentOf(player),
      ) -
        search(
          applyMove(moves, player, a, 'classic') ?? moves,
          opponentOf(player),
        ) || Number(b === 4) - Number(a === 4),
  )[0];
}
