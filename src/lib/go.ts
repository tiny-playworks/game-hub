/** 围棋 9×9 入门：落子、提子、打劫、 pass、数目（子空合计） */

export type Stone = 'B' | 'W';
export type Cell = Stone | null;
export type Board = Cell[][];

const SIZE = 9;
export const GO_SIZE = SIZE;

const ADJ: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

/** 获取与 (r,c) 同色的连通块（坐标数组） */
function getGroup(board: Board, r: number, c: number): [number, number][] {
  const color = board[r][c];
  if (!color) return [];
  const out: [number, number][] = [];
  const seen = new Set<string>();
  const key = (a: number, b: number) => `${a},${b}`;
  const dfs = (i: number, j: number) => {
    if (!inBounds(i, j) || board[i][j] !== color || seen.has(key(i, j))) return;
    seen.add(key(i, j));
    out.push([i, j]);
    for (const [di, dj] of ADJ) dfs(i + di, j + dj);
  };
  dfs(r, c);
  return out;
}

/** 某块棋的气（相邻空点个数） */
function countLiberties(board: Board, group: [number, number][]): number {
  const empty = new Set<string>();
  for (const [i, j] of group) {
    for (const [di, dj] of ADJ) {
      const ni = i + di;
      const nj = j + dj;
      if (inBounds(ni, nj) && !board[ni][nj]) empty.add(`${ni},${nj}`);
    }
  }
  return empty.size;
}

/** 落子后提掉无气的敌子，返回被提掉的敌子数；会修改 board 副本。若只提一子，通过 outCapturedPoint 返回该子坐标（用于打劫） */
function captureDead(
  board: Board,
  excludeR: number,
  excludeC: number,
  side: Stone,
  outCapturedPoint?: { r: number; c: number },
): number {
  const enemy: Stone = side === 'B' ? 'W' : 'B';
  let captured = 0;
  let singleR = -1;
  let singleC = -1;
  for (const [di, dj] of ADJ) {
    const nr = excludeR + di;
    const nc = excludeC + dj;
    if (!inBounds(nr, nc) || board[nr][nc] !== enemy) continue;
    const group = getGroup(board, nr, nc);
    if (countLiberties(board, group) !== 0) continue;
    for (const [i, j] of group) {
      if (captured === 0) {
        singleR = i;
        singleC = j;
      }
      board[i][j] = null;
      captured += 1;
    }
  }
  if (outCapturedPoint && captured === 1) {
    outCapturedPoint.r = singleR;
    outCapturedPoint.c = singleC;
  }
  return captured;
}

export interface GoState {
  board: Board;
  blackTurn: boolean;
  blackCaptured: number;
  whiteCaptured: number;
  lastPass: boolean;
  /** 打劫禁入点：对方刚提一子，我方不能立刻在该点回提 */
  koPoint: [number, number] | null;
  gameOver: boolean;
}

export function createInitialBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

export function createInitialState(): GoState {
  const board = createInitialBoard();
  return {
    board,
    blackTurn: true,
    blackCaptured: 0,
    whiteCaptured: 0,
    lastPass: false,
    koPoint: null,
    gameOver: false,
  };
}

/** 是否可以在 (r,c) 落子（空位、非自杀或可提子、非打劫） */
export function canPlace(state: GoState, r: number, c: number): boolean {
  const { board, blackTurn, koPoint } = state;
  if (state.gameOver || board[r][c]) return false;
  if (koPoint && koPoint[0] === r && koPoint[1] === c) return false; // 打劫禁入
  const side: Stone = blackTurn ? 'B' : 'W';
  const next = board.map((row) => row.map((cell) => cell));
  next[r][c] = side;
  const captured = captureDead(next, r, c, side);
  const myGroup = getGroup(next, r, c);
  const libs = countLiberties(next, myGroup);
  if (libs === 0 && captured === 0) return false; // 自杀且未提子
  return true;
}

/** 落子并返回新状态；若不可落子返回原 state */
export function placeStone(state: GoState, r: number, c: number): GoState {
  if (!canPlace(state, r, c)) return state;
  const { board, blackTurn, blackCaptured, whiteCaptured } = state;
  const side: Stone = blackTurn ? 'B' : 'W';
  const nextBoard = board.map((row) => row.map((cell) => cell));
  nextBoard[r][c] = side;
  const ko: { r: number; c: number } = { r: -1, c: -1 };
  const captured = captureDead(nextBoard, r, c, side, ko);
  const newBlackCaptured = blackCaptured + (side === 'B' ? 0 : captured);
  const newWhiteCaptured = whiteCaptured + (side === 'B' ? captured : 0);
  const koPoint: [number, number] | null = captured === 1 ? [ko.r, ko.c] : null;
  return {
    board: nextBoard,
    blackTurn: !blackTurn,
    blackCaptured: newBlackCaptured,
    whiteCaptured: newWhiteCaptured,
    lastPass: false,
    koPoint,
    gameOver: false,
  };
}

/**  pass 一手 */
export function pass(state: GoState): GoState {
  if (state.gameOver) return state;
  const bothPass = state.lastPass;
  return {
    ...state,
    blackTurn: !state.blackTurn,
    lastPass: true,
    gameOver: bothPass,
  };
}

/** 数目：子空合计（中国规则简化）— 己方子 + 己方围住的空；终局后调用 */
export function getScore(state: GoState): { black: number; white: number } {
  const board = state.board;
  const blackStones = board.flat().filter((c) => c === 'B').length;
  const whiteStones = board.flat().filter((c) => c === 'W').length;
  const emptyVisited = new Set<string>();
  const key = (r: number, c: number) => `${r},${c}`;
  let blackTerritory = 0;
  let whiteTerritory = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== null || emptyVisited.has(key(r, c))) continue;
      const stack: [number, number][] = [[r, c]];
      const component = new Set<string>();
      let touchesBlack = false;
      let touchesWhite = false;
      while (stack.length > 0) {
        const top = stack.pop();
        if (!top) break;
        const [i, j] = top;
        const k = key(i, j);
        if (emptyVisited.has(k)) continue;
        if (board[i][j] !== null) continue;
        emptyVisited.add(k);
        component.add(k);
        for (const [di, dj] of ADJ) {
          const ni = i + di;
          const nj = j + dj;
          if (!inBounds(ni, nj)) continue;
          const cell = board[ni][nj];
          if (cell === 'B') touchesBlack = true;
          if (cell === 'W') touchesWhite = true;
          if (cell === null) stack.push([ni, nj]);
        }
      }
      const size = component.size;
      if (touchesBlack && !touchesWhite) blackTerritory += size;
      if (touchesWhite && !touchesBlack) whiteTerritory += size;
    }
  }
  return {
    black: blackStones + blackTerritory,
    white: whiteStones + whiteTerritory,
  };
}
