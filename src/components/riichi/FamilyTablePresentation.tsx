import { useEffect } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COSMETIC_IMAGE_TIMEOUT_MS, getCosmeticMotion } from '@/lib/cosmeticMedia';
import { getCharacterById } from '@/lib/playerCharacters';
import { normalizeRoomAppearance } from '../../../shared/contracts/roomAppearance';
import type { PlayerViewSnapshot, RoomPresentationEvent, PlayerSeatPrivateState } from '../../../shared/contracts/room';
import { RiichiEventArtwork, type RiichiEventActor } from './RiichiEventArtwork';

function actorFor(seat: PlayerSeatPrivateState, t: (key: string) => string): RiichiEventActor {
  const identity = seat.identity;
  return {
    name: identity.type === 'ai' && identity.characterId ? t(getCharacterById(identity.characterId).nameKey) : identity.name,
    characterId: identity.type === 'ai' ? identity.characterId : undefined,
    avatarPresetId: identity.avatarPresetId,
  };
}

export function FamilyRiichiToast({ view, event, onComplete }: {
  view: PlayerViewSnapshot;
  event: RoomPresentationEvent;
  onComplete: (id: string) => void;
}) {
  const { t } = useLocale();
  const { riichiSettings } = usePlayerProfile();
  const reduced = useReducedMotion();
  const appearance = normalizeRoomAppearance(view.seats[event.seat]?.appearance);
  const mode = riichiSettings.presentation;
  useEffect(() => {
    const motion = getCosmeticMotion(appearance.riichiEffect);
    const timer = window.setTimeout(() => onComplete(event.id), mode !== 'full' || reduced
      ? 350 : (motion?.durationMs ?? 1500) + COSMETIC_IMAGE_TIMEOUT_MS + 400);
    return () => window.clearTimeout(timer);
  }, [event.id, appearance.riichiEffect, mode, reduced, onComplete]);
  if (mode === 'off') return null;
  return <aside className="family-event-toast" aria-live="polite">
    <RiichiEventArtwork key={event.id} mode={mode} layout="table" kind="riichi"
      effectId={appearance.riichiEffect} title={t('riichi.cutin.riichi')}
      actor={actorFor(view.seats[event.seat], t)} onComplete={() => onComplete(event.id)} />
    <button type="button" className="family-event-skip" onClick={() => onComplete(event.id)}>{t('riichi.presentation.skip')}</button>
  </aside>;
}

export function FamilyWinCelebration({ view, event, liveResult, onComplete }: {
  view: PlayerViewSnapshot;
  event?: RoomPresentationEvent;
  liveResult: boolean;
  onComplete: (id: string) => void;
}) {
  const { t } = useLocale();
  const { riichiSettings } = usePlayerProfile();
  const reduced = useReducedMotion();
  const result = view.result;
  const winner = result?.type === 'win' ? result.wins.find((win) => win.winner === event?.seat) ?? result.wins[0] : null;
  const appearance = normalizeRoomAppearance(winner ? view.seats[winner.winner].appearance : undefined);
  const mode = riichiSettings.presentation;
  const hasWinner = Boolean(winner);
  useEffect(() => {
    if (!event || !winner) return;
    const motion = getCosmeticMotion(appearance.winEffect);
    const timer = window.setTimeout(() => onComplete(event.id), mode !== 'full' || reduced
      ? 350 : (motion?.durationMs ?? 2500) + COSMETIC_IMAGE_TIMEOUT_MS + 400);
    return () => window.clearTimeout(timer);
  }, [event?.id, hasWinner, appearance.winEffect, mode, reduced, onComplete]);
  if (!winner || mode === 'off' || (liveResult && !event)) return null;
  return <div className="family-win-art">
    <RiichiEventArtwork key={event?.id ?? 'restored-result'} mode={mode} layout="result" kind="win"
      effectId={appearance.winEffect} still={!event}
      title={t(winner.isTsumo ? 'riichi.cutin.tsumo' : 'riichi.cutin.ron')}
      actor={actorFor(view.seats[winner.winner], t)}
      onComplete={event ? () => onComplete(event.id) : undefined} />
    {event && <button type="button" className="family-event-skip" onClick={() => onComplete(event.id)}>{t('riichi.presentation.skip')}</button>}
  </div>;
}
