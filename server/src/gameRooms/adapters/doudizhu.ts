import {
  bidForSeat,
  canBidForSeat,
  canPassForSeat,
  canPlayForSeat,
  cardRank,
  createBiddingState,
  getAIBid,
  getAIPlayForSeat,
  passForSeat,
  playHandForSeat,
  type DoudizhuState,
} from '@/lib/doudizhu';
import { defineAdapter, seededRandom } from '../adapter';

interface State {
  game: DoudizhuState;
  seed: number;
  ply: number;
  bombs: number;
}

export const doudizhuAdapter = defineAdapter<State>({
  gameId: 'doudizhu',
  seats: 3,
  spectators: false,
  negotiation: false,
  timeoutPolicy: 'autoplay-after-grace',
  init: (seed, _settings, firstSeat) => ({
    game: createBiddingState(seededRandom(seed), firstSeat),
    seed,
    ply: 0,
    bombs: 0,
  }),
  currentActors: (state) => [state.game.currentPlayer],
  validate: (state, seat, action) => {
    if (action.type === 'bid')
      return canBidForSeat(state.game, seat, action.score);
    if (action.type === 'play')
      return canPlayForSeat(state.game, seat, action.cards);
    if (action.type === 'pass') return canPassForSeat(state.game, seat);
    return false;
  },
  apply: (state, seat, action) => {
    let game = state.game;
    if (action.type === 'bid')
      game = bidForSeat(
        game,
        seat,
        action.score,
        seededRandom(state.seed + state.ply + 1),
      );
    if (action.type === 'play')
      game = playHandForSeat(game, seat, action.cards);
    if (action.type === 'pass') game = passForSeat(game, seat);
    const bomb =
      action.type === 'play' &&
      (game.lastPlay?.hand.type === 'bomb' ||
        game.lastPlay?.hand.type === 'rocket');
    return {
      ...state,
      game,
      ply: state.ply + 1,
      bombs: state.bombs + Number(bomb),
    };
  },
  projectView: (state, viewer) => {
    const game = state.game;
    return {
      gameId: 'doudizhu',
      phase: game.gameOver ? 'finished' : (game.phase ?? 'playing'),
      currentSeat: game.currentPlayer,
      landlord: game.phase === 'bidding' ? null : game.landlord,
      hand: viewer === null ? [] : game.hands[viewer],
      handCounts: game.hands.map((hand) => hand.length),
      bottomCards: game.phase === 'bidding' ? [] : (game.bottomCards ?? []),
      bids: game.bids ?? [],
      highestBid: game.highestBid ?? 0,
      lastPlay: game.lastPlay,
      playedCards: game.playedCards ?? [],
      canPass: viewer !== null && canPassForSeat(game, viewer),
      spring: game.spring ?? false,
      multiplier: 2 ** (state.bombs + Number(game.spring)),
      dealNumber: game.dealNumber ?? 1,
      ply: state.ply,
    };
  },
  aiAction: (state, seat, settings) =>
    state.game.phase === 'bidding'
      ? { type: 'bid', score: getAIBid(state.game, seat, settings.difficulty) }
      : getAIPlayForSeat(state.game, seat, settings.difficulty),
  defaultTimeoutAction: (state, seat) =>
    state.game.phase === 'bidding'
      ? { type: 'bid', score: 0 }
      : canPassForSeat(state.game, seat)
        ? { type: 'pass' }
        : {
            type: 'play',
            cards: [
              [...state.game.hands[seat]].sort(
                (a, b) => cardRank(a) - cardRank(b) || a - b,
              )[0],
            ],
          },
  result: (state) =>
    state.game.gameOver
      ? {
          outcomes: [0, 1, 2].map((seat) =>
            Number(seat !== state.game.landlord) === state.game.winner
              ? 'win'
              : 'lose',
          ),
          teams: [0, 1, 2].map((seat) => Number(seat !== state.game.landlord)),
          spring: state.game.spring,
          multiplier: 2 ** (state.bombs + Number(state.game.spring)),
        }
      : null,
  ply: (state) => state.ply,
});
