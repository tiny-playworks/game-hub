import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { CosmeticEffect } from '@/components/cosmetics/CosmeticEffect';
import { useLocale } from '@/contexts/LocaleContext';
import { useCosmetics } from '@/hooks/useCosmetics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  COSMETIC_IMAGE_TIMEOUT_MS,
  getCosmeticMotion,
  preloadCosmeticMotion,
} from '@/lib/cosmeticMedia';
import { getCharacterById } from '@/lib/playerCharacters';
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
  const motion =
    mode === 'full' && moment?.kind === 'riichi'
      ? getCosmeticMotion(equipped['riichi-effect'])
      : undefined;
  const finishCurrent = useCallback(() => {
    if (moment) finish(moment.id);
  }, [moment, finish]);

  useEffect(() => {
    if (mode !== 'full' || reducedMotion) return;
    preloadCosmeticMotion(equipped['riichi-effect']);
    preloadCosmeticMotion(equipped['win-effect']);
  }, [mode, reducedMotion, equipped]);

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
      <span
        key={moment.id}
        className={cn(
          'riichi-character-cutin-band bg-linear-to-r',
          character.accent,
          mode === 'simple' && 'is-simple',
        )}
      >
        {moment.kind === 'riichi' && mode === 'full' && (
          <CosmeticEffect
            key={moment.id}
            id={equipped['riichi-effect']}
            kind="riichi"
            onComplete={finishCurrent}
          />
        )}
        {mode === 'full' && (
          <CharacterPortraitSlot
            character={character}
            expression="happy"
            size="cutin"
            label={t(character.nameKey)}
            className="riichi-cutin-portrait"
          />
        )}
        <span className="riichi-cutin-copy" aria-live="assertive">
          {mode === 'full' && (
            <span className="riichi-cutin-name">{t(character.nameKey)}</span>
          )}
          <strong>{t(`riichi.cutin.${moment.kind}`)}</strong>
          {mode === 'full' && (
            <span className="riichi-cutin-line">{t(moment.lineKey)}</span>
          )}
        </span>
      </span>
      <span className="riichi-cutin-skip">{t('riichi.cutin.skip')}</span>
    </button>,
    document.body,
  );
}
