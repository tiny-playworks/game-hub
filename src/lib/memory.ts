export const MEMORY = {
  rows: 4,
  cols: 4,
  initialTime: 30,
  bonusMatch: 3,
  bonusLevel: 10,
  pairCount: 8,
} as const;

export const MEMORY_EMOJIS = [
  '🐶',
  '🐱',
  '🐭',
  '🐹',
  '🐰',
  '🦊',
  '🐻',
  '🐼',
  '🐯',
  '🦁',
  '🐮',
  '🐷',
  '🐸',
  '🐙',
  '🦋',
  '🦄',
] as const;

export type MemoryCard = {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
  error: boolean;
};

export type MemoryStatus = 'playing' | 'lost';

export interface MemoryState {
  cards: MemoryCard[];
  level: number;
  score: number;
  moves: number;
  timeLeft: number;
  status: MemoryStatus;
  lastFlipped: number | null;
  lock: boolean;
}

export type MemoryAction =
  | { type: 'FLIP'; index: number }
  | { type: 'CLEAR_MISMATCH'; indices: [number, number] }
  | { type: 'TICK' }
  | { type: 'ADVANCE_LEVEL'; rng: () => number }
  | { type: 'RESTART'; rng: () => number };

export type MemoryEffect =
  | { type: 'mismatch_delay'; indices: [number, number]; ms: number }
  | { type: 'level_clear_delay'; ms: number }
  | { type: 'shake' }
  | { type: 'game_over' };

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function generateCards(level: number, rng: () => number): MemoryCard[] {
  const offset = (level - 1) % (MEMORY_EMOJIS.length / MEMORY.pairCount);
  const pairs = MEMORY_EMOJIS.slice(
    offset * MEMORY.pairCount,
    offset * MEMORY.pairCount + MEMORY.pairCount,
  );
  const list = [...pairs, ...pairs].map((emoji, i) => ({
    id: i,
    emoji,
    flipped: false,
    matched: false,
    error: false,
  }));
  return shuffle(list, rng);
}

export function createInitialMemoryState(rng: () => number): MemoryState {
  return {
    cards: generateCards(1, rng),
    level: 1,
    score: 0,
    moves: 0,
    timeLeft: MEMORY.initialTime,
    status: 'playing',
    lastFlipped: null,
    lock: false,
  };
}

export function allMatched(cards: MemoryCard[]): boolean {
  return cards.length > 0 && cards.every((c) => c.matched);
}

export function memoryReducer(
  state: MemoryState,
  action: MemoryAction,
): { state: MemoryState; effects: MemoryEffect[] } {
  switch (action.type) {
    case 'FLIP': {
      if (
        state.status !== 'playing' ||
        state.lock ||
        state.cards[action.index]?.flipped ||
        state.cards[action.index]?.matched
      ) {
        return { state, effects: [] };
      }

      const flippedCards = state.cards.map((c, i) =>
        i === action.index ? { ...c, flipped: true } : c,
      );

      if (state.lastFlipped === null) {
        return {
          state: {
            ...state,
            cards: flippedCards,
            lastFlipped: action.index,
          },
          effects: [],
        };
      }

      const firstIndex = state.lastFlipped;
      const secondIndex = action.index;
      const first = state.cards[firstIndex];
      const second = flippedCards[secondIndex];
      const moves = state.moves + 1;

      if (first.emoji === second.emoji) {
        const matchedCards = flippedCards.map((c, i) =>
          i === firstIndex || i === secondIndex ? { ...c, matched: true } : c,
        );
        const nextState: MemoryState = {
          ...state,
          cards: matchedCards,
          moves,
          score: state.score + 1,
          timeLeft: state.timeLeft + MEMORY.bonusMatch,
          lastFlipped: null,
        };
        const effects: MemoryEffect[] = [];
        if (allMatched(matchedCards)) {
          nextState.lock = true;
          effects.push({ type: 'level_clear_delay', ms: 1000 });
        }
        return { state: nextState, effects };
      }

      const errorCards = flippedCards.map((c, i) =>
        i === firstIndex || i === secondIndex ? { ...c, error: true } : c,
      );
      return {
        state: {
          ...state,
          cards: errorCards,
          moves,
          lastFlipped: null,
          lock: true,
        },
        effects: [
          {
            type: 'mismatch_delay',
            indices: [firstIndex, secondIndex],
            ms: 600,
          },
          { type: 'shake' },
        ],
      };
    }

    case 'CLEAR_MISMATCH': {
      const [a, b] = action.indices;
      return {
        state: {
          ...state,
          cards: state.cards.map((c, i) =>
            i === a || i === b ? { ...c, flipped: false, error: false } : c,
          ),
          lock: false,
        },
        effects: [],
      };
    }

    case 'TICK': {
      if (state.status !== 'playing' || state.timeLeft <= 0) {
        return { state, effects: [] };
      }
      const timeLeft = state.timeLeft - 1;
      if (timeLeft === 0) {
        return {
          state: { ...state, timeLeft: 0, status: 'lost' },
          effects: [{ type: 'game_over' }],
        };
      }
      return {
        state: { ...state, timeLeft },
        effects: [],
      };
    }

    case 'ADVANCE_LEVEL': {
      const level = state.level + 1;
      return {
        state: {
          ...state,
          level,
          timeLeft: state.timeLeft + MEMORY.bonusLevel,
          cards: generateCards(level, action.rng),
          lock: false,
          lastFlipped: null,
        },
        effects: [],
      };
    }

    case 'RESTART':
      return {
        state: createInitialMemoryState(action.rng),
        effects: [],
      };
  }
}
