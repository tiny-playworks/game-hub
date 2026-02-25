/** 五子棋棋盘边长 */
export const GOMOKU_SIZE = 15;

export type GomokuStone = 'B' | 'W' | null;
export type GomokuWinner = 'B' | 'W' | null;

/**
 * 判定五子棋胜负：横、竖、两斜方向任意五子连珠即胜。
 * @param board 长度 GOMOKU_SIZE * GOMOKU_SIZE 的棋盘，索引 row * SIZE + col
 */
export function getGomokuWinner(board: GomokuStone[]): GomokuWinner {
  const SIZE = GOMOKU_SIZE;
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
        let count = 1;
        let nr = r + dr;
        let nc = c + dc;
        while (
          nr >= 0 &&
          nr < SIZE &&
          nc >= 0 &&
          nc < SIZE &&
          at(nr, nc) === stone
        ) {
          count++;
          nr += dr;
          nc += dc;
        }
        if (count >= 5) return stone;
      }
    }
  }
  return null;
}
