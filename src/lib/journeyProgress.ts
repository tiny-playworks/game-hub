import {
  normalizeJourneyProgress,
  recordJourneyEvaluation,
  type JourneyAttemptInput,
  type JourneyEvaluation,
  type JourneyProgressState,
} from '../../shared/contracts/journey';
import { validateJourneyAttempt, getJourneyStage } from '@/lib/riichiJourney';
import {
  markCharactersEncountered,
  syncPlayerCharacterUnlocks,
} from '@/lib/playerCharacters';
import { commitStorageChanges, gameStorage, getStorageDriver } from '@/lib/storage';

export { normalizeJourneyProgress, recordJourneyEvaluation };
export type { JourneyAttemptInput, JourneyEvaluation, JourneyProgressState };

export const JOURNEY_PROGRESS_STORAGE_KEY = 'game-hub-journey-v1';
export const JOURNEY_PROGRESS_CHANGED_EVENT = 'game-hub:journey-progress-changed';

export function getJourneyProgress(): JourneyProgressState {
  try {
    return normalizeJourneyProgress(
      JSON.parse(gameStorage.getItem(JOURNEY_PROGRESS_STORAGE_KEY) ?? 'null'),
    );
  } catch {
    return normalizeJourneyProgress(null);
  }
}

export function recordLocalJourneyAttempt(input: JourneyAttemptInput): {
  state: JourneyProgressState;
  evaluation: JourneyEvaluation;
  duplicate: boolean;
} {
  if (getStorageDriver()) throw new Error('Member journey progress requires the household service');
  const evaluation = validateJourneyAttempt(input);
  const previous = getJourneyProgress();
  const duplicate = previous.creditedAttemptIds.includes(input.attemptId);
  const state = recordJourneyEvaluation(previous, input.attemptId, input.stageId, evaluation, Date.now(), input.variation);
  if (!duplicate) {
    commitStorageChanges({ [JOURNEY_PROGRESS_STORAGE_KEY]: JSON.stringify(state) });
    const stage = getJourneyStage(input.stageId);
    if (stage) markCharactersEncountered(stage.opponents);
    if (evaluation.completed) syncPlayerCharacterUnlocks();
    if (typeof window !== 'undefined')
      window.dispatchEvent(new Event(JOURNEY_PROGRESS_CHANGED_EVENT));
  }
  return { state, evaluation, duplicate };
}
