import {
  JOURNEY_CONTENT_VERSION,
  JOURNEY_STAGE_IDS,
  normalizeJourneyProgress,
  isJourneyAttemptId,
  isJourneyStageId,
  type JourneyAttemptInput,
  type JourneyEvaluation,
  type JourneyStageId,
} from '../../shared/contracts/journey';
export { JOURNEY_STAGE_IDS, normalizeJourneyProgress };
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

export type JourneyCharacterId =
  | 'aoi'
  | 'rin'
  | 'mio'
  | 'koharu'
  | 'chitose'
  | 'sora'
  | 'aya'
  | 'mahiru'
  | 'yoru';

export interface JourneyStageDefinition {
  id: JourneyStageId;
  characterId: JourneyCharacterId;
  opponents: [string, string, string];
  seed: number;
  prefixEventCount: number;
  titleKey: string;
  goalKey: string;
  venueKey: string;
  introKey: string;
  nextStageId: JourneyStageId | null;
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
    introKey: 'journey.stage.aoi.intro',
    nextStageId: 'rin-tempo',
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
    introKey: 'journey.stage.rin.intro',
    nextStageId: 'mio-defense',
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
    introKey: 'journey.stage.mio.intro',
    nextStageId: 'koharu-call',
  },
  {
    id: 'koharu-call',
    characterId: 'koharu',
    opponents: ['koharu', 'aoi', 'mio'],
    seed: 41,
    prefixEventCount: 36,
    titleKey: 'journey.stage.koharu.title',
    goalKey: 'journey.stage.koharu.goal',
    venueKey: 'journey.stage.koharu.venue',
    introKey: 'journey.stage.koharu.intro',
    nextStageId: 'chitose-closed',
  },
  {
    id: 'chitose-closed',
    characterId: 'chitose',
    opponents: ['chitose', 'mio', 'aoi'],
    seed: 56,
    prefixEventCount: 13,
    titleKey: 'journey.stage.chitose.title',
    goalKey: 'journey.stage.chitose.goal',
    venueKey: 'journey.stage.chitose.venue',
    introKey: 'journey.stage.chitose.intro',
    nextStageId: 'sora-value',
  },
  {
    id: 'sora-value',
    characterId: 'sora',
    opponents: ['sora', 'chitose', 'rin'],
    seed: 62,
    prefixEventCount: 12,
    titleKey: 'journey.stage.sora.title',
    goalKey: 'journey.stage.sora.goal',
    venueKey: 'journey.stage.sora.venue',
    introKey: 'journey.stage.sora.intro',
    nextStageId: 'aya-riichi',
  },
  {
    id: 'aya-riichi',
    characterId: 'aya',
    opponents: ['aya', 'sora', 'rin'],
    seed: 76,
    prefixEventCount: 39,
    titleKey: 'journey.stage.aya.title',
    goalKey: 'journey.stage.aya.goal',
    venueKey: 'journey.stage.aya.venue',
    introKey: 'journey.stage.aya.intro',
    nextStageId: 'mahiru-flush',
  },
  {
    id: 'mahiru-flush',
    characterId: 'mahiru',
    opponents: ['mahiru', 'sora', 'aya'],
    seed: 85,
    prefixEventCount: 10,
    titleKey: 'journey.stage.mahiru.title',
    goalKey: 'journey.stage.mahiru.goal',
    venueKey: 'journey.stage.mahiru.venue',
    introKey: 'journey.stage.mahiru.intro',
    nextStageId: 'yoru-reading',
  },
  {
    id: 'yoru-reading',
    characterId: 'yoru',
    opponents: ['yoru', 'mahiru', 'aya'],
    seed: 91,
    prefixEventCount: 44,
    titleKey: 'journey.stage.yoru.title',
    goalKey: 'journey.stage.yoru.goal',
    venueKey: 'journey.stage.yoru.venue',
    introKey: 'journey.stage.yoru.intro',
    nextStageId: null,
  },
];

const AI_LEVELS: RiichiSeatAiLevels = ['standard', 'standard', 'standard', 'standard'];
const MAX_JOURNEY_EVENTS = 512;

export function getJourneyStage(id: unknown): JourneyStageDefinition | null {
  return JOURNEY_STAGES.find((stage) => stage.id === id) ?? null;
}

export function getJourneyStageForCharacter(
  characterId: unknown,
): JourneyStageDefinition | null {
  return JOURNEY_STAGES.find((stage) => stage.characterId === characterId) ?? null;
}

export function computeSuitFocusCount(match: RiichiMatchState, seat = 0): number {
  const suits = [0, 0, 0, 0];
  const tiles = [
    ...match.round.hands[seat],
    ...match.round.melds[seat].flatMap((meld) => meld.tiles.slice(0, 3)),
  ];
  for (const tile of tiles) {
    const suit = Math.min(3, Math.max(0, Math.floor(tile / 9)));
    suits[suit]++;
  }
  return Math.max(suits[0], suits[1], suits[2]) + suits[3];
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
  if (stage.id === 'rin-tempo' || stage.id === 'koharu-call') {
    const options = getSeatClaimOptions(match.round, 0);
    if (!options || (!options.pon && options.chi.length === 0))
      throw new Error('Journey tempo stage no longer starts at its advertised decision');
  }
  if (
    (stage.id === 'mio-defense' || stage.id === 'yoru-reading') &&
    !match.round.riichiDeclared.some((value, seat) => seat !== 0 && value)
  )
    throw new Error('Journey defense stage must begin under riichi threat');
  if (stage.id === 'aya-riichi' && (match.round.turnOptions?.riichiDiscards.length ?? 0) === 0)
    throw new Error('Journey riichi stage must begin with a riichi discard available');
  if (stage.id === 'mahiru-flush' && computeSuitFocusCount(match, 0) < 9)
    throw new Error('Journey flush stage must begin with a concentrated suit hand');
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

export function resolveFailureReasonKey(
  stageId: JourneyStageId,
  metrics: {
    safeFinish: boolean;
    reachedTenpai: boolean;
    openedMeld: boolean;
    pointsDelta: number;
    declaredRiichi: boolean;
    suitFocusCount: number;
  },
): string {
  if (!metrics.safeFinish) return 'journey.failure.dealtIn';
  switch (stageId) {
    case 'aoi-balance':
      return 'journey.failure.notTenpai';
    case 'rin-tempo':
      return !metrics.openedMeld
        ? 'journey.failure.noOpenMeld'
        : 'journey.failure.notTenpai';
    case 'mio-defense':
      return 'journey.failure.dealtIn';
    case 'koharu-call':
      return 'journey.failure.noOpenMeld';
    case 'chitose-closed':
      return metrics.openedMeld
        ? 'journey.failure.openedHand'
        : 'journey.failure.notTenpai';
    case 'sora-value':
      return 'journey.failure.noScoreGain';
    case 'aya-riichi':
      return 'journey.failure.noRiichi';
    case 'mahiru-flush':
      return 'journey.failure.suitScattered';
    case 'yoru-reading':
      return metrics.openedMeld
        ? 'journey.failure.openedUnderThreat'
        : 'journey.failure.dealtIn';
  }
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
  let declaredRiichi = Boolean(initial.round.riichiDeclared[0]);
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
    if (event.type !== 'nextRound' && event.seat === 0 && event.type === 'riichi') {
      declaredRiichi = true;
      reachedTenpai = true;
    }
    if (event.type !== 'nextRound' && event.seat === 0 && event.type === 'tsumo')
      reachedTenpai = true;
    if (match.round.phase === 'end' && hasOwnWin(match)) reachedTenpai = true;
    if (match.round.phase !== 'end' && isTenpai(match.round.hands[0], match.round.melds[0]))
      reachedTenpai = true;
    if (match.round.melds[0].some((meld) => meld.type !== 'angang')) openedMeld = true;
    if (match.round.riichiDeclared[0]) declaredRiichi = true;
  }

  if (match.status !== 'roundEnd' || match.round.phase !== 'end' || !match.round.result)
    throw new Error('Journey replay must end at the current round result');
  const settlement = match.round.result.settlement;
  const pointsDelta = settlement.newScores[0] - initial.round.scores[0];
  const openMelds = match.round.melds[0].filter((meld) => meld.type !== 'angang').length;
  const survivedThreat = wasThreatened && !hasDealIn(match);
  const safeFinish = !hasDealIn(match);
  const suitFocusCount = computeSuitFocusCount(match, 0);

  let completed = false;
  switch (stage.id) {
    case 'aoi-balance':
      completed = reachedTenpai && safeFinish;
      break;
    case 'rin-tempo':
      completed = openedMeld && reachedTenpai && safeFinish;
      break;
    case 'mio-defense':
      completed = survivedThreat;
      break;
    case 'koharu-call':
      completed = openedMeld && safeFinish;
      break;
    case 'chitose-closed':
      completed = !openedMeld && reachedTenpai && safeFinish;
      break;
    case 'sora-value':
      completed = pointsDelta > 0 && safeFinish;
      break;
    case 'aya-riichi':
      completed = declaredRiichi && safeFinish;
      break;
    case 'mahiru-flush':
      completed = suitFocusCount >= 9 && safeFinish;
      break;
    case 'yoru-reading':
      completed = survivedThreat && !openedMeld;
      break;
  }

  return {
    completed,
    pointsDelta,
    playerDiscards,
    openMelds,
    reachedTenpai,
    survivedThreat,
    declaredRiichi,
    suitFocusCount,
    failureReasonKey: completed
      ? null
      : resolveFailureReasonKey(stage.id, {
          safeFinish,
          reachedTenpai,
          openedMeld,
          pointsDelta,
          declaredRiichi,
          suitFocusCount,
        }),
  };
}
