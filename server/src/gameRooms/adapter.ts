import type {
  FamilyGameId, GameAction, GameBoardView, GameOutcome, GameRoomSettings,
} from '../../../shared/contracts/gameRoom';

export interface AdapterResult {
  outcomes: GameOutcome[];
  teams: number[];
  spring?: boolean;
  multiplier?: number;
}

export interface GameAdapter<State = unknown> {
  gameId: FamilyGameId;
  seats: number;
  spectators: boolean;
  negotiation: boolean;
  timeoutPolicy: 'pause-on-disconnect' | 'autoplay-after-grace';
  init(seed: number, settings: GameRoomSettings, firstSeat: number): State;
  currentActors(state: State): number[];
  validate(state: State, seat: number, action: GameAction): boolean;
  apply(state: State, seat: number, action: GameAction): State;
  projectView(state: State, viewer: number | null): GameBoardView;
  aiAction(state: State, seat: number, settings: GameRoomSettings): GameAction;
  defaultTimeoutAction(state: State, seat: number): GameAction;
  result(state: State): AdapterResult | null;
  ply(state: State): number;
}

/** The registry erases only the internal state type; adapters own all decoding. */
export function defineAdapter<State>(adapter: GameAdapter<State>): GameAdapter {
  return adapter as GameAdapter;
}

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}
