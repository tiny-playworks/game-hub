import {
  createInitialBoard,
  findKing,
  getAllSafeMoves,
  getSafeMoves,
  getXiangqiResult,
  isInCheck,
  movePiece,
  type Board,
  type Side,
  type XiangqiMove,
} from '@/lib/xiangqi';
import { chooseXiangqiMove } from '@/lib/xiangqiAi';
import { defineAdapter } from '../adapter';

interface State {
  board: Board;
  currentSeat: number;
  firstSeat: number;
  lastMove: XiangqiMove | null;
  ply: number;
}
const sideOf = (state: State, seat: number): Side =>
  seat === state.firstSeat ? 'red' : 'black';
function point(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(Number.isInteger) &&
    value[0] >= 0 &&
    value[0] < 10 &&
    value[1] >= 0 &&
    value[1] < 9
  );
}

export const xiangqiAdapter = defineAdapter<State>({
  gameId: 'xiangqi',
  seats: 2,
  spectators: true,
  negotiation: true,
  timeoutPolicy: 'pause-on-disconnect',
  init: (_seed, _settings, firstSeat) => ({
    board: createInitialBoard(),
    currentSeat: firstSeat,
    firstSeat,
    lastMove: null,
    ply: 0,
  }),
  currentActors: (state) => [state.currentSeat],
  validate: (state, seat, action) => {
    if (
      action.type !== 'move' ||
      state.currentSeat !== seat ||
      !point(action.from) ||
      !point(action.to)
    )
      return false;
    const [row, col] = action.from;
    return (
      state.board[row][col]?.side === sideOf(state, seat) &&
      getSafeMoves(state.board, row, col).some(
        ([r, c]) => r === action.to[0] && c === action.to[1],
      )
    );
  },
  apply: (state, seat, action) =>
    action.type !== 'move'
      ? state
      : {
          ...state,
          board: movePiece(state.board, ...action.from, ...action.to),
          currentSeat: 1 - seat,
          lastMove: { from: action.from, to: action.to },
          ply: state.ply + 1,
        },
  projectView: (state) => ({
    gameId: 'xiangqi',
    board: state.board,
    currentSeat: state.currentSeat,
    lastMove: state.lastMove,
    ply: state.ply,
    inCheck: isInCheck(state.board, sideOf(state, state.currentSeat)),
  }),
  aiAction: (state, seat, settings) => {
    const move =
      chooseXiangqiMove(
        state.board,
        sideOf(state, seat),
        settings.difficulty,
      ) ?? getAllSafeMoves(state.board, sideOf(state, seat))[0];
    return { type: 'move', ...move };
  },
  defaultTimeoutAction: (state, seat) => ({
    type: 'move',
    ...getAllSafeMoves(state.board, sideOf(state, seat))[0],
  }),
  result: (state) => {
    const red = findKing(state.board, 'red');
    const black = findKing(state.board, 'black');
    const result = getXiangqiResult(
      state.board,
      sideOf(state, state.currentSeat),
    );
    const winner = !red ? 'black' : !black ? 'red' : result?.winner;
    return winner
      ? {
          outcomes: [0, 1].map((seat) =>
            sideOf(state, seat) === winner ? 'win' : 'lose',
          ),
          teams: [0, 1],
        }
      : null;
  },
  ply: (state) => state.ply,
});
