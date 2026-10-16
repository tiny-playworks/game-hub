import { useEffect } from 'react';
import { getCharacterById } from '@/lib/playerCharacters';
import type { RiichiPlayerSettings } from '@/lib/playerProfile';
import { getAiDelayMs, getDecisionTotalSeconds } from '@/lib/riichiClock';
import {
  decideAiClaim,
  decideAiTurn,
  getPendingSeats,
  getSeatClaimOptions,
  getSeatTurnOptions,
  type RiichiEvent,
} from './engine';
import { useRiichiStore } from './store/riichiMatchStore';
import type { RiichiGameState } from './types';

export const AI_TURN_DELAY_MS = 900;
export const AI_CLAIM_DELAY_MS = 560;
const AUTO_ACTION_DELAY_MS = 350;

/** 自家决策点标识：同一决策点内他家响应不会重置计时 */
export function humanDecisionKey(round: RiichiGameState): string {
  const discards = round.discardPiles.reduce((s, p) => s + p.length, 0);
  const melds = round.melds.reduce((s, m) => s + m.length, 0);
  return [
    round.roundId,
    round.phase,
    round.currentPlayer,
    round.wall.length,
    round.rinshanTiles.length,
    discards,
    melds,
  ].join(':');
}

/** 超时或自动出牌时的默认舍牌：优先摸切 */
export function defaultDiscardTile(round: RiichiGameState): number | null {
  const options = getSeatTurnOptions(round, 0);
  if (!options || options.discardable.length === 0) return null;
  if (
    round.drawnTile !== null &&
    options.discardable.includes(round.drawnTile)
  ) {
    return round.drawnTile;
  }
  return options.discardable[options.discardable.length - 1];
}

function autoHumanEvent(
  round: RiichiGameState,
  settings: RiichiPlayerSettings,
): RiichiEvent | null {
  const claim = getSeatClaimOptions(round, 0);
  if (claim) {
    if (claim.ron && settings.autoWin) {
      return { type: 'claim', seat: 0, response: { type: 'ron' } };
    }
    if (!claim.ron && settings.noCall) {
      return { type: 'claim', seat: 0, response: { type: 'pass' } };
    }
    return null;
  }
  const turn = getSeatTurnOptions(round, 0);
  if (!turn) return null;
  if (turn.tsumo && settings.autoWin) return { type: 'tsumo', seat: 0 };
  if (
    round.riichiDeclared[0] &&
    settings.autoTsumogiri &&
    !turn.tsumo &&
    turn.ankan.length === 0 &&
    round.drawnTile !== null
  ) {
    return { type: 'discard', seat: 0, tile: round.drawnTile };
  }
  return null;
}

/**
 * 唯一的对局调度：AI 摸打与鸣牌、自家自动操作与超时。
 * 每个定时回调执行前都会核对 turn，局面已推进则丢弃。
 */
export function useRiichiAutomation(settings: RiichiPlayerSettings): void {
  const match = useRiichiStore((s) => s.match);
  const view = useRiichiStore((s) => s.view);
  const replayOpen = useRiichiStore((s) => s.replay !== null);
  const guideOpen = useRiichiStore((s) => s.showGuide);
  const menuOpen = useRiichiStore((s) => s.showMenu);
  const presenting = useRiichiStore((s) => s.cutIns.length > 0);
  const onlinePending = useRiichiStore((s) => s.onlinePending);

  useEffect(() => {
    const store = useRiichiStore.getState();
    const current = match;
    if (
      !current ||
      view !== 'game' ||
      replayOpen ||
      guideOpen ||
      menuOpen ||
      presenting ||
      onlinePending ||
      current.status !== 'playing'
    ) {
      return;
    }
    const round = current.round;
    const token = current.turn;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => {
      timers.push(
        window.setTimeout(() => {
          const latest = useRiichiStore.getState();
          if (latest.match?.turn !== token || latest.cutIns.length > 0) return;
          fn();
        }, ms),
      );
    };
    const pending = getPendingSeats(round);
    const aiSeats = pending.filter((seat) => seat !== 0);
    const aiTurnDelayMs = getAiDelayMs(settings.aiSpeed, 'discard');
    const aiClaimDelayMs = getAiDelayMs(settings.aiSpeed, 'claim');

    if (round.phase === 'discard' && aiSeats.length > 0) {
      const seat = aiSeats[0];
      later(aiTurnDelayMs, () => {
        const latest = useRiichiStore.getState().match;
        if (!latest) return;
        const id = latest.seatCharacters[seat];
        const event = decideAiTurn(
          latest.round,
          seat,
          latest.seatAiLevels[seat] ?? latest.rules.aiLevel,
          id ? getCharacterById(id).style : undefined,
          latest.rules,
        );
        if (event) {
          useRiichiStore
            .getState()
            .dispatch({ ...event, elapsed: aiTurnDelayMs / 1000 });
        }
      });
    }

    if (round.phase === 'claim' && aiSeats.length > 0) {
      later(aiClaimDelayMs, () => {
        for (const seat of aiSeats) {
          const latest = useRiichiStore.getState().match;
          if (
            latest?.round.phase !== 'claim' ||
            useRiichiStore.getState().cutIns.length > 0
          )
            return;
          if (!getSeatClaimOptions(latest.round, seat)) continue;
          useRiichiStore.getState().dispatch({
            type: 'claim',
            seat,
            response: decideAiClaim(
              latest.round,
              seat,
              latest.seatAiLevels[seat] ?? latest.rules.aiLevel,
              getCharacterById(latest.seatCharacters[seat] ?? 'mio').style,
              latest.rules,
            ),
            elapsed: aiClaimDelayMs / 1000,
          });
        }
      });
    }

    if (pending.includes(0)) {
      const key = humanDecisionKey(round);
      let clock = store.decisionClock;
      if (!clock || clock.key !== key) {
        clock = { key, startedAt: Date.now() };
        store.setDecisionClock(clock);
      }
      const auto = autoHumanEvent(round, settings);
      if (auto) {
        later(AUTO_ACTION_DELAY_MS, () => {
          useRiichiStore.getState().dispatch(auto);
        });
      }
      const totalSeconds = getDecisionTotalSeconds(
        round.timeBanks[0],
        round.phase,
        settings.turnTimeLimit,
      );
      if (totalSeconds !== null) {
        const totalMs = totalSeconds * 1000;
        const remainMs = Math.max(0, clock.startedAt + totalMs - Date.now());
        later(remainMs, () => {
          const latest = useRiichiStore.getState().match;
          if (!latest) return;
          const elapsed = totalMs / 1000;
          if (latest.round.phase === 'claim') {
            useRiichiStore.getState().dispatch({
              type: 'claim',
              seat: 0,
              response: { type: 'pass' },
              elapsed,
              timeout: true,
            });
            return;
          }
          const tile = defaultDiscardTile(latest.round);
          if (tile !== null) {
            useRiichiStore.getState().dispatch({
              type: 'discard',
              seat: 0,
              tile,
              elapsed,
              timeout: true,
            });
          }
        });
      }
    } else if (store.decisionClock) {
      store.setDecisionClock(null);
    }

    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
    // match 变化即代表局面推进；settings 变化时重新评估自动操作
  }, [match, view, replayOpen, guideOpen, menuOpen, presenting, onlinePending, settings]);
}

/** 自家操作时附带本次决策用时（秒） */
export function withElapsed<T extends RiichiEvent>(event: T): T {
  const clock = useRiichiStore.getState().decisionClock;
  if (!clock || event.type === 'nextRound') return event;
  return {
    ...event,
    elapsed: ((clock.pausedAt ?? Date.now()) - clock.startedAt) / 1000,
  };
}
