import { Dices } from 'lucide-react';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { CHARACTER_DEFS, getCharacterById } from '@/lib/playerCharacters';
import type { OpponentSelection } from '../engine';

export function OpponentSelector({
  mainCharacterId,
  value,
  onChange,
}: {
  mainCharacterId: string;
  value: OpponentSelection;
  onChange: (value: OpponentSelection) => void;
}) {
  const { t, locale } = useLocale();
  const pool = CHARACTER_DEFS.filter(
    (character) => character.id !== mainCharacterId,
  );
  return (
    <fieldset className="riichi-opponent-picker">
      <legend>{t('riichi.opponents.title')}</legend>
      <p>
        {formatMessage(locale, 'riichi.opponents.description', {
          name: t(getCharacterById(mainCharacterId).nameKey),
        })}
      </p>
      <div className="riichi-opponent-options">
        {value.map((id, index) => {
          const character = id && pool.find((character) => character.id === id);
          return (
            <label key={index}>
              <span>{t(`game.mahjong.seats.${index + 1}`)}</span>
              <div className="riichi-opponent-preview">
                {character ? (
                  <CharacterPortraitSlot
                    character={character}
                    size="sm"
                    label={t(character.nameKey)}
                    className="riichi-character-avatar"
                  />
                ) : (
                  <span className="riichi-random-avatar">
                    <Dices size={20} aria-hidden="true" />
                  </span>
                )}
                <small>
                  {character
                    ? t(character.styleTagKeys[0])
                    : t('riichi.opponents.random')}
                </small>
              </div>
              <select
                aria-label={formatMessage(locale, 'riichi.opponents.seat', {
                  seat: t(`game.mahjong.seats.${index + 1}`),
                })}
                value={character ? character.id : ''}
                onChange={(event) => {
                  const next: OpponentSelection = [...value];
                  next[index] = event.target.value || null;
                  onChange(next);
                }}
              >
                <option value="">{t('riichi.opponents.random')}</option>
                {pool.map((option) => (
                  <option
                    key={option.id}
                    value={option.id}
                    disabled={value.some(
                      (picked, other) =>
                        other !== index && picked === option.id,
                    )}
                  >
                    {t(option.nameKey)}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      <button
        type="button"
        className="riichi-opponent-randomize"
        onClick={() => onChange([null, null, null])}
      >
        <Dices size={16} aria-hidden="true" />
        {t('riichi.opponents.reset')}
      </button>
    </fieldset>
  );
}
