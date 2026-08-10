/** 五子棋棋盘边长 */
export const GOMOKU_SIZE = 15;

export type GomokuStone = 'B' | 'W' | null;
export type GomokuWinner = 'B' | 'W' | null;

/** 胜局信息：获胜方与构成连珠的全部格子索引（长连时包含全部同色子） */
export interface GomokuWin {
  stone: 'B' | 'W';
  line: number[];
}

/**
 * 判定五子棋胜负并返回连珠线：横、竖、两斜方向任意五子连珠即胜。
 * @param board 长度 GOMOKU_SIZE * GOMOKU_SIZE 的棋盘，索引 row * SIZE + col
 */
export function getGomokuWin(board: GomokuStone[]): GomokuWin | null {
  const SIZE = GOMOKU_SIZE;
  const inBoard = (r: number, c: number) =>
    r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  const at = (r: number, c: number) => board[r * SIZE + c];
  const dirs: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const stone = at(r, c);
      if (!stone) continue;
      for (const [dr, dc] of dirs) {
        // 只从连珠起点向前统计，保证 line 覆盖该方向上全部同色子
        if (inBoard(r - dr, c - dc) && at(r - dr, c - dc) === stone) continue;
        const line: number[] = [];
        let nr = r;
        let nc = c;
        while (inBoard(nr, nc) && at(nr, nc) === stone) {
          line.push(nr * SIZE + nc);
          nr += dr;
          nc += dc;
        }
        if (line.length >= 5) return { stone, line };
      }
    }
  }
  return null;
}

/**
 * 判定五子棋胜负，只关心胜方。
 * @param board 长度 GOMOKU_SIZE * GOMOKU_SIZE 的棋盘，索引 row * SIZE + col
 */
export function getGomokuWinner(board: GomokuStone[]): GomokuWinner {
  return getGomokuWin(board)?.stone ?? null;
}
