import {
  applyEvent,
  createMatch,
  decideAiClaim,
  decideAiTurn,
  getPendingSeats,
  type RiichiAiLevel,
  type RiichiEvent,
  type RiichiMatchState,
  type RiichiRuleConfig,
} from '../../src/pages/mahjong/japanese/engine';

/** 为当前局面生成一个 AI 事件（四家都由 AI 决策） */
export function nextAutoEvent(
  match: RiichiMatchState,
  levels: RiichiAiLevel[] = ['standard', 'standard', 'standard', 'standard'],
): RiichiEvent | null {
  if (match.status === 'roundEnd') return { type: 'nextRound' };
  if (match.status !== 'playing') return null;
  const round = match.round;
  const seat = getPendingSeats(round)[0];
  if (seat === undefined) return null;
  if (round.phase === 'discard') return decideAiTurn(round, seat, levels[seat]);
  return {
    type: 'claim',
    seat,
    response: decideAiClaim(round, seat, levels[seat]),
  };
}

export interface SimOptions {
  seed: number;
  matchLength?: 'east' | 'south';
  rules?: Partial<RiichiRuleConfig>;
  levels?: RiichiAiLevel[];
  maxSteps?: number;
  onStep?: (
    before: RiichiMatchState,
    event: RiichiEvent,
    after: RiichiMatchState,
  ) => void;
}

export function simulateMatch(options: SimOptions): RiichiMatchState {
  let match = createMatch({
    seed: options.seed,
    matchLength: options.matchLength ?? 'south',
    rules: options.rules,
  }).match;
  const maxSteps = options.maxSteps ?? 20000;
  for (let i = 0; i < maxSteps; i++) {
    const event = nextAutoEvent(match, options.levels);
    if (!event) break;
    const step = applyEvent(match, event);
    if (!step) {
      throw new Error(
        `Illegal AI event at step ${i}: ${JSON.stringify(event)} phase=${match.round.phase}`,
      );
    }
    options.onStep?.(match, event, step.match);
    match = step.match;
  }
  return match;
}
