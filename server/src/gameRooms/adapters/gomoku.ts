import { GOMOKU_SIZE, getGomokuWin, type GomokuStone } from '@/lib/gomoku';
import { chooseGomokuMove } from '@/lib/gomokuAi';
import { defineAdapter } from '../adapter';

interface State {
  board: GomokuStone[];
  currentSeat: number;
  firstSeat: number;
  lastMove: number | null;
  ply: number;
}

export const gomokuAdapter = defineAdapter<State>({
  gameId: 'gomoku',
  seats: 2,
  spectators: true,
  negotiation: true,
  timeoutPolicy: 'pause-on-disconnect',
  init: (_seed, _settings, firstSeat) => ({
    board: Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(null),
    currentSeat: firstSeat,
    firstSeat,
    lastMove: null,
    ply: 0,
  }),
  currentActors: (state) => [state.currentSeat],
  validate: (state, seat, action) =>
    action.type === 'place' &&
    state.currentSeat === seat &&
    Number.isInteger(action.index) &&
    action.index >= 0 &&
    action.index < state.board.length &&
    state.board[action.index] === null,
  apply: (state, seat, action) => {
    if (action.type !== 'place') return state;
    const board = [...state.board];
    board[action.index] = seat === state.firstSeat ? 'B' : 'W';
    return {
      ...state,
      board,
      currentSeat: 1 - seat,
      lastMove: action.index,
      ply: state.ply + 1,
    };
  },
  projectView: (state) => ({
    gameId: 'gomoku',
    board: state.board,
    currentSeat: state.currentSeat,
    lastMove: state.lastMove,
    ply: state.ply,
    winningLine: getGomokuWin(state.board)?.line ?? [],
  }),
  aiAction: (state, seat, settings) => ({
    type: 'place',
    index:
      chooseGomokuMove(
        state.board,
        seat === state.firstSeat ? 'B' : 'W',
        settings.difficulty,
      ) ?? state.board.findIndex((stone) => stone === null),
  }),
  defaultTimeoutAction: (state) => ({
    type: 'place',
    index: state.board.findIndex((stone) => !stone),
  }),
  result: (state) => {
    const win = getGomokuWin(state.board);
    if (!win && state.board.includes(null)) return null;
    const winner = win
      ? win.stone === 'B'
        ? state.firstSeat
        : 1 - state.firstSeat
      : null;
    return {
      outcomes: [0, 1].map((seat) =>
        winner === null ? 'draw' : seat === winner ? 'win' : 'lose',
      ),
      teams: [0, 1],
    };
  },
  ply: (state) => state.ply,
});
