import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { useLocale } from '@/contexts/LocaleContext';
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
  const moment = useRiichiStore((state) => state.cutIns[0]);
  const finish = useRiichiStore((state) => state.finishCutIn);
  const clear = useRiichiStore((state) => state.clearCutIns);
  useEffect(() => {
    if (!moment) return;
    if (mode === 'off') {
      clear();
      return;
    }
    const timer = window.setTimeout(
      () => finish(moment.id),
      CUT_IN_DURATION_MS,
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
  }, [moment, mode, finish, clear]);
  if (!moment || mode === 'off' || typeof document === 'undefined') return null;
  const character = getCharacterById(moment.characterId);
  return createPortal(
    <button
      type="button"
      className="riichi-character-cutin"
      data-mode={mode}
      data-seat={moment.seat}
      data-kind={moment.kind}
      aria-label={t('riichi.cutin.skip')}
      onClick={() => finish(moment.id)}
    >
      <span
        key={moment.id}
        className={cn(
          'riichi-character-cutin-band bg-gradient-to-r',
          character.accent,
          mode === 'simple' && 'is-simple',
        )}
      >
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
