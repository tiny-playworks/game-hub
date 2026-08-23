import { createRiichiDeck, dealRiichi } from '@/lib/mahjongRiichi';
import { RIICHI_TIME_BANK_INITIAL_SECONDS } from '@/lib/riichiClock';
import { createInitialFuritenState } from '@/lib/riichiFuriten';
import { RIICHI_INITIAL_POINTS } from '@/lib/riichiSettlement';
import type { RiichiGameState } from './types';

export function initRiichiGame(
  dealer = 0,
  roundWind = 0,
  roundNumber = 1,
  honba = 0,
  scores: number[] = [
    RIICHI_INITIAL_POINTS,
    RIICHI_INITIAL_POINTS,
    RIICHI_INITIAL_POINTS,
    RIICHI_INITIAL_POINTS,
  ],
  timeBanks: number[] = [
    RIICHI_TIME_BANK_INITIAL_SECONDS,
    RIICHI_TIME_BANK_INITIAL_SECONDS,
    RIICHI_TIME_BANK_INITIAL_SECONDS,
    RIICHI_TIME_BANK_INITIAL_SECONDS,
  ],
  riichiPot = 0,
  lastSettlement?: RiichiGameState['lastSettlement'],
  matchLength: 'east' | 'south' = 'south',
): RiichiGameState {
  const deck = createRiichiDeck();
  const [hands, rest] = dealRiichi(deck, dealer);
  const doraIndicators = [rest[0]];
  const uraDoraIndicator = rest[1];
  const wall = rest.slice(2);
  return {
    hands,
    wall,
    discardPiles: [[], [], [], []],
    melds: [[], [], [], []],
    currentPlayer: dealer,
    drawnTile: null,
    lastDrawWasRinshan: false,
    doraIndicators,
    phase: 'discard',
    lastDiscard: null,
    lastDiscardFrom: null,
    claimIndex: 0,
    lastClaimMsg: null,
    roundWind,
    roundNumber,
    honba,
    dealer,
    scores: [...scores],
    timeBanks: [...timeBanks],
    riichiPot,
    matchLength,
    riichiDeclared: [false, false, false, false],
    ippatsuPossible: [false, false, false, false],
    furitenStates: [
      createInitialFuritenState(),
      createInitialFuritenState(),
      createInitialFuritenState(),
      createInitialFuritenState(),
    ],
    riichiDiscard: [null, null, null, null],
    uraDoraIndicators: uraDoraIndicator === undefined ? [] : [uraDoraIndicator],
    timeoutEvents: [],
    lastSettlement,
  };
}
