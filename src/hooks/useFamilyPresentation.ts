import { useCallback, useEffect, useRef, useState } from 'react';
import { stopRiichiVoicePlayback, useRiichiSounds } from './useRiichiSounds';
import { usePlayerProfile } from './usePlayerProfile';
import { useReducedMotion } from './useReducedMotion';
import { preloadCosmeticMotion } from '@/lib/cosmeticMedia';
import type { RoomPresentationBaseline } from '@/lib/household/roomClient';
import type { PlayerViewSnapshot, RoomPresentationEvent, RoomPresentationSound } from '../../shared/contracts/room';

/** Server-confirmed public effects only. The cursor survives ordinary snapshot re-renders. */
export function useFamilyPresentation(view: PlayerViewSnapshot | null, connected: boolean, baseline: RoomPresentationBaseline | null) {
  const { riichiSettings } = usePlayerProfile();
  const reduced = useReducedMotion();
  const sounds = useRiichiSounds();
  const soundRef = useRef(sounds);
  soundRef.current = sounds;
  const [riichi, setRiichi] = useState<RoomPresentationEvent[]>([]);
  const [wins, setWins] = useState<RoomPresentationEvent[]>([]);
  const [liveResult, setLiveResult] = useState(false);
  const last = useRef<{ epoch: string; cursor: number; matchId: string } | null>(null);
  const lastBaseline = useRef(baseline?.version ?? 0);
  const initialized = useRef(false);
  const announcements = useRef<{ generation: number; queue: RoomPresentationSound[]; running: boolean }>({ generation: 0, queue: [], running: false });
  const matchId = view?.matchId;
  const equippedIds = [...new Set(view?.seats.flatMap((seat) => seat.appearance
    ? [seat.appearance.riichiEffect, seat.appearance.winEffect] : []) ?? [])].join('|');

  const cancelAnnouncements = useCallback(() => {
    announcements.current.generation++;
    announcements.current.queue = [];
    announcements.current.running = false;
    stopRiichiVoicePlayback();
  }, []);
  const announce = useCallback((incoming: RoomPresentationSound[]) => {
    const state = announcements.current;
    state.queue.push(...incoming);
    state.queue = state.queue.slice(-4);
    if (state.running) return;
    state.running = true;
    const generation = state.generation;
    const drain = async () => {
      while (generation === state.generation && state.queue.length) {
        const sound = state.queue.shift();
        const players = soundRef.current;
        if (sound === 'riichi') await players.playRiichi();
        else if (sound === 'chi') await players.playChi();
        else if (sound === 'pon') await players.playPon();
        else if (sound === 'kan') await players.playKan();
        else if (sound === 'ron') await players.playRon();
        else if (sound === 'tsumo') await players.playTsumo();
        else if (sound === 'ryuukyoku') players.playRyuukyoku();
      }
      if (generation === state.generation) state.running = false;
    };
    void drain();
  }, []);

  useEffect(() => {
    const stream = view?.presentation;
    if (!connected || !view) {
      setRiichi([]); setWins([]); setLiveResult(false);
      last.current = null;
      if (!connected) { initialized.current = false; cancelAnnouncements(); }
      return;
    }
    if (!stream) {
      setRiichi([]); setWins([]); setLiveResult(false);
      last.current = null;
      initialized.current = false;
      return;
    }
    const previous = last.current;
    const reset = !initialized.current || lastBaseline.current !== (baseline?.version ?? 0) ||
      (previous?.matchId === view.matchId && previous.epoch !== stream.epoch);
    let cursor = previous?.epoch === stream.epoch ? previous.cursor : 0;
    last.current = { epoch: stream.epoch, cursor: stream.cursor, matchId: view.matchId };
    initialized.current = true;
    lastBaseline.current = baseline?.version ?? 0;
    if (reset) {
      // Anchor at the first received snapshot, not a later React-batched live update.
      cursor = baseline?.matchId === view.matchId && baseline.epoch === stream.epoch
        ? baseline.cursor : stream.cursor;
      cancelAnnouncements(); setRiichi([]); setWins([]); setLiveResult(false);
    }
    if (document.hidden) { setRiichi([]); setWins([]); cancelAnnouncements(); return; }
    const incoming = stream.events.filter((event) => event.sequence > cursor);
    if (!incoming.length) {
      if (view.status === 'playing') { setWins([]); setLiveResult(false); }
      return;
    }
    const winning = incoming.filter((event) => event.sound === 'ron' || event.sound === 'tsumo');
    const visual = riichiSettings.presentation !== 'off';
    if (winning.length) {
      cancelAnnouncements();
      announce([winning[0].sound]);
      setRiichi([]);
      setLiveResult(true);
      setWins(visual ? winning : []);
    } else {
      const ordinary = incoming.filter((event) => event.sound === 'draw' || event.sound === 'discard').at(-1);
      if (ordinary?.sound === 'draw') soundRef.current.playDraw();
      else if (ordinary?.sound === 'discard') soundRef.current.playDiscard();
      announce(incoming.filter((event) => event.sound !== 'draw' && event.sound !== 'discard').map((event) => event.sound));
      if (visual) setRiichi((current) => [...current, ...incoming.filter((event) => event.sound === 'riichi')].slice(-3));
      if (view.status === 'playing') { setWins([]); setLiveResult(false); }
    }
  }, [view, connected, baseline, riichiSettings.presentation, announce, cancelAnnouncements]);

  useEffect(() => {
    if (!matchId || !equippedIds || riichiSettings.presentation !== 'full' || reduced) return;
    // Only equipped assets for this table are decoded; other shop effects stay on demand.
    for (const id of equippedIds.split('|')) preloadCosmeticMotion(id);
  }, [matchId, equippedIds, riichiSettings.presentation, reduced]);

  useEffect(() => {
    if (riichiSettings.presentation === 'off') { setRiichi([]); setWins([]); }
  }, [riichiSettings.presentation]);

  useEffect(() => {
    const visibility = () => {
      if (document.hidden) { setRiichi([]); setWins([]); cancelAnnouncements(); }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); cancelAnnouncements(); };
  }, [cancelAnnouncements]);

  const finishRiichi = useCallback((id: string) => setRiichi((current) => current.filter((event) => event.id !== id)), []);
  const finishWin = useCallback((id: string) => setWins((current) => current.filter((event) => event.id !== id)), []);
  const current = connected && last.current?.matchId === matchId && last.current?.epoch === view?.presentation?.epoch;
  return { riichi: current ? riichi[0] : undefined, win: current ? wins[0] : undefined,
    liveResult: current && liveResult, finishRiichi, finishWin };
}
