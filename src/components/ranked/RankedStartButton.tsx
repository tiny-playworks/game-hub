import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import {
  getCharacterById,
  getPlayerCharacterState,
} from '@/lib/playerCharacters';
import {
  getRankedState,
  selectRankedOpponents,
  type MatchLength,
  type RankedTicket,
} from '@/lib/ranked';
import { preloadRiichiRules } from '@/lib/riichiRules';
import { randomSeed } from '@/lib/seededRandom';
import { createUuid } from '@/lib/uuid';
import { useRiichiStore } from '@/pages/mahjong/japanese/store/riichiMatchStore';
import './ranked.css';

export function confirmRankedExit(t: (key: string) => string): boolean {
  if (!getRankedState().activeMatchId) return true;
  if (!window.confirm(t('ranked.forfeitConfirm'))) return false;
  return useRiichiStore.getState().abandonRanked();
}
export function RankedStartButton({
  matchLength,
  again = false,
}: {
  matchLength: MatchLength;
  again?: boolean;
}) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<RankedTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!ticket) return;
    const timer = window.setTimeout(() => {
      try {
        useRiichiStore.getState().startMatch({ ranked: ticket });
        setTicket(null);
        pending.current = false;
        setLoading(false);
        navigate('/game/mahjong-japanese');
      } catch {
        setError(true);
        setTicket(null);
        pending.current = false;
        setLoading(false);
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [ticket, navigate]);
  const start = async () => {
    if (pending.current) return;
    if (!confirmRankedExit(t)) return;
    pending.current = true;
    setLoading(true);
    setError(false);
    try {
      await preloadRiichiRules();
      if (!mounted.current) return;
      const rank = getRankedState();
      const characters = getPlayerCharacterState();
      const seed = randomSeed();
      setTicket({
        id: createUuid(),
        at: Date.now(),
        seed,
        band: rank.band,
        level: rank.level,
        matchLength,
        characterId: characters.activeCharacterId,
        affinityStart:
          characters.affinityByCharacter[characters.activeCharacterId] ?? 0,
        ...selectRankedOpponents(rank, characters.activeCharacterId, seed),
      });
    } catch {
      setError(true);
      setLoading(false);
      pending.current = false;
    }
  };
  return (
    <>
      <Button
        size="lg"
        className="w-full rounded-xl"
        disabled={loading}
        onClick={() => void start()}
      >
        {t(
          loading
            ? 'ranked.matching'
            : again
              ? 'ranked.again'
              : 'lobby.startRanked',
        )}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('ranked.failed')}
        </p>
      )}
      <Dialog open={ticket !== null}>
        <DialogContent
          showCloseButton={false}
          className="ranked-matchmaking"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogTitle>{t('ranked.matching')}</DialogTitle>
          <DialogDescription>
            {t('ranked.matchingDescription')}
          </DialogDescription>
          <div className="ranked-opponents">
            {ticket?.opponents.map((id, index) => {
              const character = getCharacterById(id);
              return (
                <article
                  key={id}
                  className="ranked-opponent-card"
                  style={{ animationDelay: `${index * 350}ms` }}
                >
                  <CharacterPortraitSlot
                    character={character}
                    label={t(character.nameKey)}
                    size="lg"
                  />
                  <h3>{t(character.nameKey)}</h3>
                  <p>{t(`character.rank.${character.rankBand}`)}</p>
                  <small>{character.styleTagKeys.map(t).join(' · ')}</small>
                </article>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
