import { useState } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useCharacters } from '@/hooks/useCosmetics';
import { AOI_OUTFITS } from '@/lib/characterOutfits';
import {
  type CharacterDef,
  updatePlayerCharacterState,
} from '@/lib/playerCharacters';
import { CharacterPortraitSlot } from './CharacterPortraitSlot';

export function CharacterOutfitPicker({
  character,
}: {
  character: CharacterDef;
}) {
  const { t } = useLocale();
  const household = useOptionalHousehold();
  const state = useCharacters();
  const [error, setError] = useState('');
  if (character.id !== 'aoi') return null;
  const current = state.outfitByCharacter?.aoi ?? 'casual';
  return (
    <fieldset className="venue-outfits">
      <legend>{t('outfit.title')}</legend>
      <div className="venue-outfit-options">
        {AOI_OUTFITS.map((outfit) => (
          <button
            key={outfit}
            type="button"
            aria-label={t(`outfit.${outfit}`)}
            aria-pressed={current === outfit}
            onClick={async () => {
              try {
                if (household?.currentMember)
                  await household.selectAoiOutfit(outfit);
                else
                  updatePlayerCharacterState((value) => ({
                    outfitByCharacter: {
                      ...value.outfitByCharacter,
                      aoi: outfit,
                    },
                  }));
                setError('');
              } catch {
                setError(t('storage.title'));
              }
            }}
          >
            <CharacterPortraitSlot
              character={character}
              size="md"
              outfit={outfit}
              label={t(`outfit.${outfit}`)}
            />
            <span>{t(`outfit.${outfit}`)}</span>
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
