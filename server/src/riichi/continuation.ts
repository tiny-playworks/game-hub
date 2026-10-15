import {
  applyEvent, createMatch, isReplayFile, type RiichiEffect,
  type RiichiEvent, type RiichiMatchState, type RiichiReplayFile,
} from '@/pages/mahjong/japanese/engine';

function semantic(event: RiichiEvent): unknown {
  if (event.type === 'nextRound') return event;
  const { elapsed: _elapsed, timeout: _timeout, ...action } = event;
  return action;
}

/** A disconnected free game may extend its confirmed prefix, never replace it. */
export function replayFreeContinuation(replay: RiichiReplayFile, confirmed?: RiichiMatchState): {
  match: RiichiMatchState; effects: RiichiEffect[];
} {
  if (replay?.ranked) throw new Error('RANKED_NOT_ALLOWED');
  if (!isReplayFile(replay) || replay.events.length > 20000)
    throw new Error('INVALID_REPLAY');
  if (confirmed) {
    for (const key of ['seed', 'version', 'matchLength', 'rules', 'seatCharacters', 'seatAiLevels'] as const) {
      if (JSON.stringify(replay[key]) !== JSON.stringify(confirmed[key])) throw new Error('MATCH_CONFLICT');
    }
    if (replay.events.length < confirmed.events.length || confirmed.events.some((event, i) =>
      JSON.stringify(semantic(event)) !== JSON.stringify(semantic(replay.events[i]))))
      throw new Error('MATCH_CONFLICT');
  }
  const initial = createMatch(replay);
  let match = initial.match;
  const effects = confirmed ? [] : [...initial.effects];
  for (let i = 0; i < replay.events.length; i++) {
    const step = applyEvent(match, replay.events[i]);
    if (!step) throw new Error('REPLAY_FAILED');
    match = step.match;
    if (i >= (confirmed?.events.length ?? 0)) effects.push(...step.effects);
  }
  return { match, effects };
}
