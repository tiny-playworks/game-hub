import { CharacterPortraitSlot } from '@/components/characters/CharacterPortraitSlot';
import { CosmeticEffect } from '@/components/cosmetics/CosmeticEffect';
import { getCharacterById } from '@/lib/playerCharacters';
import { getAvatarPresetById, type RiichiPlayerSettings } from '@/lib/playerProfile';
import { cn } from '@/lib/utils';
import './riichi-events.css';

export interface RiichiEventActor {
  name: string;
  characterId?: string;
  avatarPresetId?: string;
  line?: string;
}

/** Presentational only: callers own event identity, game progression and skipping. */
export function RiichiEventArtwork({ effectId, kind, mode, actor, title, layout, still = false, className, onComplete }: {
  effectId?: string;
  kind: 'riichi' | 'win';
  mode: RiichiPlayerSettings['presentation'];
  actor?: RiichiEventActor;
  title?: string;
  layout: 'cutin' | 'table' | 'result';
  still?: boolean;
  className?: string;
  onComplete?: () => void;
}) {
  if (mode === 'off') return null;
  const preset = actor && !actor.characterId ? getAvatarPresetById(actor.avatarPresetId ?? 'pine') : null;
  return (
    <span className={cn('riichi-event-art', className)} data-layout={layout} data-mode={mode}>
      {effectId && <CosmeticEffect id={effectId} kind={kind} still={still || mode !== 'full'}
        audible onComplete={onComplete} />}
      {actor && <>
        {mode === 'full' && (actor.characterId ? (
          <CharacterPortraitSlot character={getCharacterById(actor.characterId)} expression="happy"
            size={layout === 'cutin' ? 'cutin' : 'md'} label={actor.name} className="riichi-cutin-portrait riichi-event-portrait" />
        ) : preset && (
          <span className={cn('riichi-event-avatar', preset.bgClass, preset.fgClass)} aria-hidden="true">{preset.glyph}</span>
        ))}
        <span className="riichi-cutin-copy riichi-event-copy">
          <span className="riichi-cutin-name">{actor.name}</span>
          {title && <strong>{title}</strong>}
          {mode === 'full' && actor.line && <span className="riichi-cutin-line">{actor.line}</span>}
        </span>
      </>}
    </span>
  );
}
