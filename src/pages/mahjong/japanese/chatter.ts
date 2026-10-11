import { useEffect, useRef } from 'react';
import { getBaseTile } from '@/lib/mahjongRiichi';
import { getCharacterById } from '@/lib/playerCharacters';
import { evaluateTileDanger } from '@/lib/riichiAi';
import { getScoreTier } from '@/lib/riichiPresentation';
import { getShanten } from '@/lib/riichiShanten';
import type { CharacterMoment } from './characterMoments';
import type { RiichiEffect, RiichiMatchState } from './engine';
import { opponentViewOf, visibleCountsFor } from './engine/ai';
import {
  subscribeRiichiEffects,
  useRiichiStore,
} from './store/riichiMatchStore';

export const CHATTER_TRIGGERS = [
  'other-riichi',
  'stalled',
  'other-win',
  'last-place',
  'big-win',
  'double-draw',
  'danger-survived',
] as const;
export type ChatterTrigger = (typeof CHATTER_TRIGGERS)[number];
export const CHATTER_TABLE_COOLDOWN = 8000;
export const CHATTER_SEAT_COOLDOWN = 20000;
const probabilities: Record<ChatterTrigger, number> = {
  'other-riichi': 0.4,
  stalled: 0.2,
  'other-win': 0.3,
  'last-place': 0.5,
  'big-win': 0.6,
  'double-draw': 0.3,
  'danger-survived': 0.25,
};
const seats = [0, 1, 2, 3];

/** Presentation-only randomness and wall-clock cooldowns never enter a replay. */
export class ChatterController {
  private lastTable = Number.NEGATIVE_INFINITY;
  private lastSeat = seats.map(() => Number.NEGATIVE_INFINITY);
  private queue: {
    trigger: ChatterTrigger;
    seats: number[];
    roundId: number;
    expires: number;
  }[] = [];
  private progress: { shanten: number; unchanged: number }[] = [];
  private consecutiveDraws = 0;
  private pendingDanger: number | null = null;
  constructor(
    private now: () => number = Date.now,
    private random: () => number = Math.random,
  ) {}

  reset() {
    this.lastTable = Number.NEGATIVE_INFINITY;
    this.lastSeat = seats.map(() => Number.NEGATIVE_INFINITY);
    this.progress = [];
    this.consecutiveDraws = 0;
    this.pendingDanger = null;
    this.clearPending();
  }

  clearPending() {
    this.queue = [];
  }

  trigger(trigger: ChatterTrigger, speakers: number[], roundId: number) {
    if (!speakers.length || this.random() >= probabilities[trigger]) return;
    this.queue.push({
      trigger,
      seats: speakers,
      roundId,
      expires: this.now() + 8000,
    });
    this.queue = this.queue.slice(-7);
  }

  observeEffects(match: RiichiMatchState, effects: RiichiEffect[]) {
    for (const effect of effects) {
      if (effect.type === 'moment' && effect.kind === 'riichi') {
        this.trigger(
          'other-riichi',
          seats.filter((seat) => seat !== effect.seat),
          match.round.roundId,
        );
      }
    }
  }

  observeMatch(previous: RiichiMatchState | null, match: RiichiMatchState) {
    if (
      !previous ||
      previous.seed !== match.seed ||
      match.events.length < previous.events.length
    ) {
      this.reset();
      return;
    }
    const round = match.round;
    if (round.roundId !== previous.round.roundId) {
      this.progress = [];
      this.pendingDanger = null;
      const last = seats.reduce((lowest, seat) =>
        round.scores[seat] < round.scores[lowest] ? seat : lowest,
      );
      const allLast =
        round.roundNumber === 4 &&
        round.roundWind >= (match.matchLength === 'east' ? 0 : 1);
      const previousAllLast =
        previous.round.roundNumber === 4 &&
        previous.round.roundWind >= (match.matchLength === 'east' ? 0 : 1);
      const becameLast =
        previous.round.scores[last] > Math.min(...previous.round.scores);
      const entersSouth =
        round.roundWind >= 1 && previous.round.roundWind === 0;
      if (
        round.scores[last] < Math.max(...round.scores) &&
        (round.roundWind >= 1 || allLast) &&
        (becameLast || entersSouth || (allLast && !previousAllLast))
      )
        this.trigger('last-place', [last], round.roundId);
    }
    const event = match.events[match.events.length - 1];
    if (
      match.events.length > previous.events.length &&
      event &&
      (event.type === 'discard' || event.type === 'riichi')
    ) {
      const seat = event.seat;
      const shanten = getShanten(round.hands[seat], round.melds[seat]);
      const prior = this.progress[seat];
      const unchanged = prior?.shanten === shanten ? prior.unchanged + 1 : 1;
      this.progress[seat] = { shanten, unchanged };
      if (unchanged >= 8) {
        this.trigger('stalled', [seat], round.roundId);
        this.progress[seat].unchanged = 0;
      }
      if (seat === 0) {
        const state = previous.round;
        const base = getBaseTile(event.tile);
        const middle = base < 27 && base % 9 >= 1 && base % 9 <= 7;
        const visible = visibleCountsFor(state, 0);
        const dangerous =
          middle &&
          seats.some((opponent) => {
            if (opponent === 0 || !state.riichiDeclared[opponent]) return false;
            const unsuji = !state.discardPiles[opponent].some((tile) => {
              const other = getBaseTile(tile);
              return (
                Math.floor(other / 9) === Math.floor(base / 9) &&
                Math.abs(other - base) === 3
              );
            });
            return (
              unsuji &&
              evaluateTileDanger(
                event.tile,
                opponentViewOf(state, opponent),
                visible,
              ) >= 0.8
            );
          });
        if (dangerous) this.pendingDanger = round.roundId;
      }
    }
    if (this.pendingDanger === round.roundId && round.phase !== 'claim') {
      const dealtIn =
        round.result?.type === 'win' &&
        round.result.wins.some((win) => win.ronFrom === 0);
      if (!dealtIn) this.trigger('danger-survived', seats, round.roundId);
      this.pendingDanger = null;
    }
    if (
      previous.round.phase !== 'end' &&
      round.phase === 'end' &&
      round.result
    ) {
      const result = round.result;
      if (result.type === 'draw') {
        this.consecutiveDraws++;
        if (this.consecutiveDraws === 2) {
          this.trigger('double-draw', seats, round.roundId);
          this.consecutiveDraws = 0;
        }
      } else {
        this.consecutiveDraws = 0;
        const observers = seats.filter(
          (seat) =>
            !result.wins.some(
              (win) => win.winner === seat || win.ronFrom === seat,
            ),
        );
        this.trigger(
          result.wins.some((win) => getScoreTier(win))
            ? 'big-win'
            : 'other-win',
          observers,
          round.roundId,
        );
      }
    }
  }

  next(
    match: RiichiMatchState,
    playerCharacterId: string,
    blockedSeats: number[],
    cutIn = false,
  ): CharacterMoment | null {
    const now = this.now();
    this.queue = this.queue.filter(
      (item) => item.expires > now && item.roundId === match.round.roundId,
    );
    if (cutIn || now - this.lastTable < CHATTER_TABLE_COOLDOWN) return null;
    for (let index = 0; index < this.queue.length; index++) {
      const item = this.queue[index];
      const available = item.seats.filter(
        (seat) =>
          !blockedSeats.includes(seat) &&
          now - this.lastSeat[seat] >= CHATTER_SEAT_COOLDOWN,
      );
      if (!available.length) continue;
      const seat = available[Math.floor(this.random() * available.length)];
      const character = getCharacterById(
        match.seatCharacters[seat] ?? playerCharacterId,
      );
      this.queue.splice(index, 1);
      this.lastTable = now;
      this.lastSeat[seat] = now;
      return {
        id: `chatter:${match.seed}:${match.turn}:${seat}:${now}`,
        seat,
        kind: 'chatter',
        characterId: character.id,
        lineKey: `character.chatter.${character.id}.${item.trigger}.${Math.floor(this.random() * 2)}`,
      };
    }
    return null;
  }
}

export function useRiichiChatter(enabled: boolean) {
  const controller = useRef<ChatterController | null>(null);
  if (!controller.current) controller.current = new ChatterController();
  useEffect(() => {
    const chatter = controller.current as ChatterController;
    if (!enabled) {
      chatter.clearPending();
      useRiichiStore.setState((state) => ({
        moments: state.moments.filter((moment) => moment.kind !== 'chatter'),
      }));
      return;
    }
    let previous = useRiichiStore.getState();
    const publish = () => {
      const state = useRiichiStore.getState();
      if (
        !state.match ||
        state.view !== 'game' ||
        state.match.status === 'matchEnd' ||
        state.showGuide ||
        state.showMenu ||
        state.replay
      )
        return;
      const moment = chatter.next(
        state.match,
        state.playerCharacterId,
        state.moments.map((item) => item.seat),
        state.cutIns.length > 0,
      );
      if (moment)
        useRiichiStore.setState({ moments: [...state.moments, moment] });
    };
    const unsubscribe = useRiichiStore.subscribe((state) => {
      const old = previous;
      previous = state;
      if (state.match && state.match !== old.match && state.view === 'game')
        chatter.observeMatch(old.match, state.match);
      publish();
    });
    const unsubscribeEffects = subscribeRiichiEffects((effects) => {
      const state = useRiichiStore.getState();
      if (!state.match || state.view !== 'game') return;
      chatter.observeEffects(state.match, effects);
      publish();
    });
    const timer = window.setInterval(publish, 1000);
    return () => {
      unsubscribe();
      unsubscribeEffects();
      window.clearInterval(timer);
      chatter.clearPending();
    };
  }, [enabled]);
}
