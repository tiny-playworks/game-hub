import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RiichiEventArtwork } from '@/components/riichi/RiichiEventArtwork';
import { useLocale } from '@/contexts/LocaleContext';
import { useCosmetics } from '@/hooks/useCosmetics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  COSMETIC_IMAGE_TIMEOUT_MS,
  getCosmeticMotion,
  preloadCosmeticMotion,
} from '@/lib/cosmeticMedia';
import { getCharacterById } from '@/lib/playerCharacters';
import { characterRoomAppearance } from '../../../../../shared/contracts/roomAppearance';
import type { RiichiPlayerSettings } from '@/lib/playerProfile';
import { cn } from '@/lib/utils';
import { CUT_IN_DURATION_MS } from '../characterMoments';
import { useRiichiStore } from '../store/riichiMatchStore';

export function CharacterCutIn({
  mode,
}: {
  mode: RiichiPlayerSettings['presentation'];
}) {
  const { t } = useLocale();
  const { equipped } = useCosmetics();
  const reducedMotion = useReducedMotion();
  const moment = useRiichiStore((state) => state.cutIns[0]);
  const finish = useRiichiStore((state) => state.finishCutIn);
  const clear = useRiichiStore((state) => state.clearCutIns);
  const seatCharacters = useRiichiStore((state) => state.match?.seatCharacters);
  const opponentWinIds = (seatCharacters ?? []).slice(1).map((id) => characterRoomAppearance(id ?? undefined).winEffect).join('|');
  const effectId = moment?.seat === 0 ? equipped['riichi-effect'] : 'riichi-default';
  const motion =
    mode === 'full' && moment?.kind === 'riichi'
      ? getCosmeticMotion(effectId)
      : undefined;
  const finishCurrent = useCallback(() => {
    if (moment) finish(moment.id);
  }, [moment, finish]);

  useEffect(() => {
    if (mode !== 'full' || reducedMotion) return;
    preloadCosmeticMotion(equipped['riichi-effect']);
    preloadCosmeticMotion(equipped['win-effect']);
    preloadCosmeticMotion('riichi-default');
    for (const id of opponentWinIds.split('|')) if (id) preloadCosmeticMotion(id);
  }, [mode, reducedMotion, equipped['riichi-effect'], equipped['win-effect'], opponentWinIds]);

  useEffect(() => {
    if (!moment) return;
    if (mode === 'off' || reducedMotion) {
      clear();
      return;
    }
    const timer = window.setTimeout(
      () => finish(moment.id),
      mode === 'simple'
        ? 350
        : motion
          ? motion.durationMs + COSMETIC_IMAGE_TIMEOUT_MS + 400
          : CUT_IN_DURATION_MS,
    );
    const skip = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      finish(moment.id);
    };
    document.addEventListener('keydown', skip);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', skip);
    };
  }, [moment, mode, reducedMotion, finish, clear, motion]);
  if (
    !moment ||
    mode === 'off' ||
    reducedMotion ||
    typeof document === 'undefined'
  )
    return null;
  const character = getCharacterById(moment.characterId);
  return createPortal(
    <button
      type="button"
      className="riichi-character-cutin"
      data-mode={mode}
      data-seat={moment.seat}
      data-kind={moment.kind}
      data-illustrated={Boolean(motion)}
      aria-label={t('riichi.cutin.skip')}
      onClick={finishCurrent}
    >
      <RiichiEventArtwork
        key={moment.id}
        className={cn('riichi-character-cutin-band bg-linear-to-r', character.accent, mode === 'simple' && 'is-simple')}
        mode={mode}
        layout="cutin"
        kind="riichi"
        effectId={moment.kind === 'riichi' && mode === 'full' ? effectId : undefined}
        actor={{ name: t(character.nameKey), characterId: character.id, line: t(moment.lineKey) }}
        title={t(`riichi.cutin.${moment.kind}`)}
        onComplete={finishCurrent}
      />
      <span className="riichi-cutin-skip">{t('riichi.cutin.skip')}</span>
    </button>,
    document.body,
  );
}
