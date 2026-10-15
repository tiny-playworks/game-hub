import {
  JOURNEY_CONTENT_VERSION,
  isJourneyAttemptId,
  isJourneyStageId,
  type JourneyAttemptInput,
  type JourneyEvaluation,
  type JourneyStageId,
} from '../../shared/contracts/journey';
import {
  applyEvent,
  createMatch,
  isReplayFile,
  type RiichiEvent,
  type RiichiMatchState,
  type RiichiReplayFile,
} from '@/pages/mahjong/japanese/engine/match';
import { getSeatClaimOptions } from '@/pages/mahjong/japanese/engine/selectors';
import { isTenpai } from '@/pages/mahjong/japanese/engine/hand';
import { getPracticeAiEvent } from '@/lib/riichiPractice';
import type { RiichiSeatAiLevels } from '@/pages/mahjong/japanese/engine/rules';

export interface JourneyStageDefinition {
  id: JourneyStageId;
  characterId: 'aoi' | 'rin' | 'mio';
  opponents: [string, string, string];
  seed: number;
  prefixEventCount: number;
  titleKey: string;
  goalKey: string;
  venueKey: string;
}

/** Fixed, versioned opening situations. Bump JOURNEY_CONTENT_VERSION if these change. */
export const JOURNEY_STAGES: readonly JourneyStageDefinition[] = [
  {
    id: 'aoi-balance',
    characterId: 'aoi',
    opponents: ['aoi', 'rin', 'mio'],
    seed: 4,
    prefixEventCount: 17,
    titleKey: 'journey.stage.aoi.title',
    goalKey: 'journey.stage.aoi.goal',
    venueKey: 'journey.stage.aoi.venue',
  },
  {
    id: 'rin-tempo',
    characterId: 'rin',
    opponents: ['rin', 'aoi', 'mio'],
    seed: 33,
    prefixEventCount: 10,
    titleKey: 'journey.stage.rin.title',
    goalKey: 'journey.stage.rin.goal',
    venueKey: 'journey.stage.rin.venue',
  },
  {
    id: 'mio-defense',
    characterId: 'mio',
    opponents: ['mio', 'rin', 'aya'],
    seed: 3,
    prefixEventCount: 39,
    titleKey: 'journey.stage.mio.title',
    goalKey: 'journey.stage.mio.goal',
    venueKey: 'journey.stage.mio.venue',
  },
];

const AI_LEVELS: RiichiSeatAiLevels = ['standard', 'standard', 'standard', 'standard'];
const MAX_JOURNEY_EVENTS = 512;

export function getJourneyStage(id: unknown): JourneyStageDefinition | null {
  return JOURNEY_STAGES.find((stage) => stage.id === id) ?? null;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function canonicalEvent(event: RiichiEvent): unknown {
  if (event.type === 'nextRound') return event;
  const { elapsed: _elapsed, timeout: _timeout, ...semantic } = event;
  return semantic;
}

function isRecordedTimingSafe(event: RiichiEvent): boolean {
  if (event.type === 'nextRound') return false;
  return (event.elapsed === undefined || event.elapsed === 0) && event.timeout !== true;
}

function generateStageStart(stage: JourneyStageDefinition): RiichiMatchState {
  let match = createMatch({
    seed: stage.seed,
    matchLength: 'east',
    seatCharacters: [null, ...stage.opponents],
    seatAiLevels: AI_LEVELS,
  }).match;
  for (let index = 0; index < stage.prefixEventCount; index++) {
    const event = getPracticeAiEvent(match, null);
    if (!event) throw new Error(`Journey stage ${stage.id} has an incomplete preset`);
    const step = applyEvent(match, event);
    if (!step) throw new Error(`Journey stage ${stage.id} has an invalid preset`);
    match = step.match;
  }
  if (match.status !== 'playing' || match.round.phase === 'end')
    throw new Error(`Journey stage ${stage.id} starts after the round ended`);
  if (stage.id === 'rin-tempo') {
    const options = getSeatClaimOptions(match.round, 0);
    if (!options || (!options.pon && options.chi.length === 0))
      throw new Error('Journey tempo stage no longer starts at its advertised decision');
  }
  if (stage.id === 'mio-defense' && !match.round.riichiDeclared.some((value, seat) => seat !== 0 && value))
    throw new Error('Journey defense stage must begin under riichi threat');
  return match;
}

/** Build a fresh copy so retries cannot mutate the shared deterministic preset. */
export function createJourneyMatch(stageId: JourneyStageId): RiichiMatchState {
  const stage = getJourneyStage(stageId);
  if (!stage) throw new Error('Unknown journey stage');
  return structuredClone(generateStageStart(stage));
}

function hasDealIn(match: RiichiMatchState): boolean {
  return match.round.result?.type === 'win' &&
    match.round.result.wins.some((win) => win.ronFrom === 0);
}

function hasOwnWin(match: RiichiMatchState): boolean {
  return match.round.result?.type === 'win' &&
    match.round.result.wins.some((win) => win.winner === 0);
}

function inputIsValid(input: JourneyAttemptInput): boolean {
  return !!input &&
    typeof input === 'object' &&
    isJourneyAttemptId(input.attemptId) &&
    isJourneyStageId(input.stageId) &&
    input.contentVersion === JOURNEY_CONTENT_VERSION &&
    isReplayFile(input.replay);
}

/** Replays and verifies the fixed opening, every deterministic AI action, and the goal. */
export function validateJourneyAttempt(input: JourneyAttemptInput): JourneyEvaluation {
  if (!inputIsValid(input)) throw new Error('Invalid journey attempt');
  const stage = getJourneyStage(input.stageId);
  if (!stage) throw new Error('Invalid journey stage');
  const file: RiichiReplayFile = input.replay;
  if (
    file.ranked !== undefined ||
    file.seed !== stage.seed ||
    file.matchLength !== 'east' ||
    file.events.length <= stage.prefixEventCount ||
    file.events.length > MAX_JOURNEY_EVENTS ||
    !sameJson(file.seatCharacters, [null, ...stage.opponents]) ||
    !sameJson(file.seatAiLevels, AI_LEVELS)
  ) throw new Error('Journey replay does not match the fixed stage');

  let match = createMatch({
    seed: stage.seed,
    matchLength: 'east',
    rules: file.rules,
    seatCharacters: [null, ...stage.opponents],
    seatAiLevels: AI_LEVELS,
  }).match;
  if (!sameJson(file.rules, match.rules)) throw new Error('Journey rules were changed');

  for (let index = 0; index < stage.prefixEventCount; index++) {
    const expected = getPracticeAiEvent(match, null);
    const actual = file.events[index];
    if (!expected || !actual || !isRecordedTimingSafe(actual) ||
      !sameJson(canonicalEvent(actual), canonicalEvent(expected)))
      throw new Error('Journey preset prefix is invalid');
    const step = applyEvent(match, expected);
    if (!step) throw new Error('Journey preset prefix cannot be replayed');
    match = step.match;
  }
  if (match.status !== 'playing' || match.round.phase === 'end')
    throw new Error('Journey replay begins after the round ended');

  const initial = match;
  const wasThreatened = initial.round.riichiDeclared.some((value, seat) => seat !== 0 && value);
  let reachedTenpai = false;
  let openedMeld = false;
  let playerDiscards = 0;

  for (let index = stage.prefixEventCount; index < file.events.length; index++) {
    if (match.status !== 'playing') throw new Error('Journey replay contains actions after round end');
    const event = file.events[index];
    if (!isRecordedTimingSafe(event)) throw new Error('Journey replay contains timed-out actions');
    const expectedAi = getPracticeAiEvent(match, 0);
    if (expectedAi) {
      if (!sameJson(canonicalEvent(event), canonicalEvent(expectedAi)))
        throw new Error('Journey replay AI action is not deterministic');
    } else if (event.type === 'nextRound' || event.seat !== 0) {
      throw new Error('Journey replay contains an action outside the player turn');
    }

    const step = applyEvent(match, event);
    if (!step) throw new Error('Journey replay contains an illegal action');
    match = step.match;

    if (event.type !== 'nextRound' && event.seat === 0 &&
      (event.type === 'discard' || event.type === 'riichi'))
      playerDiscards++;
    if (event.type !== 'nextRound' && event.seat === 0 && event.type === 'tsumo')
      reachedTenpai = true;
    if (match.round.phase === 'end' && hasOwnWin(match)) reachedTenpai = true;
    if (match.round.phase !== 'end' && isTenpai(match.round.hands[0], match.round.melds[0]))
      reachedTenpai = true;
    if (match.round.melds[0].some((meld) => meld.type !== 'angang')) openedMeld = true;
  }

  if (match.status !== 'roundEnd' || match.round.phase !== 'end' || !match.round.result)
    throw new Error('Journey replay must end at the current round result');
  const settlement = match.round.result.settlement;
  const pointsDelta = settlement.newScores[0] - initial.round.scores[0];
  const openMelds = match.round.melds[0].filter((meld) => meld.type !== 'angang').length;
  const survivedThreat = wasThreatened && !hasDealIn(match);
  const safeFinish = !hasDealIn(match);
  const completed = stage.id === 'aoi-balance'
    ? reachedTenpai && safeFinish
    : stage.id === 'rin-tempo'
      ? openedMeld && reachedTenpai && safeFinish
      : survivedThreat;

  return {
    completed,
    pointsDelta,
    playerDiscards,
    openMelds,
    reachedTenpai,
    survivedThreat,
  };
}
