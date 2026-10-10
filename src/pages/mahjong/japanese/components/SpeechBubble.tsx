import { useEffect } from 'react';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { useLocale } from '@/contexts/LocaleContext';
import { getCharacterById, type LineTrigger } from '@/lib/playerCharacters';
import { type CharacterMoment, SPEECH_DURATION_MS } from '../characterMoments';
import { useRiichiStore } from '../store/riichiMatchStore';

export function SpeechBubble({ moment }: { moment?: CharacterMoment }) {
  const { t } = useLocale();
  const expire = useRiichiStore((state) => state.expireMoment);
  useEffect(() => {
    if (!moment) return;
    const timer = window.setTimeout(
      () => expire(moment.id),
      SPEECH_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [moment, expire]);
  if (!moment) return null;
  return (
    <p
      className="riichi-speech-bubble"
      data-seat={moment.seat}
      data-moment={moment.kind}
      aria-live="polite"
    >
      {t(moment.lineKey)}
    </p>
  );
}

/** 结算弹窗遮住牌桌时，仍能看到赢家与放铳者的回应。 */
export function CharacterQuotes({
  moments,
  kinds,
}: {
  moments: CharacterMoment[];
  kinds: LineTrigger[];
}) {
  const { t } = useLocale();
  return (
    <div className="riichi-character-quotes">
      {moments
        .filter((moment) => kinds.includes(moment.kind))
        .map((moment) => {
          const character = getCharacterById(moment.characterId);
          return (
            <blockquote key={moment.id} data-moment={moment.kind}>
              <CharacterPortraitSlot
                character={character}
                size="sm"
                label={t(character.nameKey)}
                className="riichi-character-avatar"
              />
              <div>
                <strong>{t(character.nameKey)}</strong>
                <p>{t(moment.lineKey)}</p>
              </div>
            </blockquote>
          );
        })}
    </div>
  );
}
