import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import aoiStory from '@/assets/stories/aoi.webp';
import ayaStory from '@/assets/stories/aya.webp';
import chitoseStory from '@/assets/stories/chitose.webp';
import koharuStory from '@/assets/stories/koharu.webp';
import mahiruStory from '@/assets/stories/mahiru.webp';
import mioStory from '@/assets/stories/mio.webp';
import rinStory from '@/assets/stories/rin.webp';
import soraStory from '@/assets/stories/sora.webp';
import yoruStory from '@/assets/stories/yoru.webp';
import tsubakiStory from '@/assets/characters/tsubaki/happy.webp';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import type { CharacterStory } from '@/lib/characterStories';
import { getCharacterById } from '@/lib/playerCharacters';
import { CharacterPortraitSlot } from './CharacterPortraitSlot';

const challengeStoryArt: Record<string, string> = {
  aoi: aoiStory,
  koharu: koharuStory,
  mio: mioStory,
  rin: rinStory,
  chitose: chitoseStory,
  sora: soraStory,
  aya: ayaStory,
  mahiru: mahiruStory,
  yoru: yoruStory,
  tsubaki: tsubakiStory,
};

export function CharacterStoryPlayer({
  story,
  onClose,
}: {
  story: CharacterStory;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [index, setIndex] = useState(0);
  const character = getCharacterById(story.characterId);
  const line = story.lines[index];
  const expression =
    [...story.lines.slice(0, index + 1)]
      .reverse()
      .find((item) => item.expression)?.expression ?? 'normal';
  const advance = () => {
    if (index === story.lines.length - 1) onClose();
    else setIndex(index + 1);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="character-story-dialog paper-texture rounded-3xl sm:max-w-2xl"
        overlayClassName="z-[140]"
        showCloseButton={false}
        onKeyDown={(event) => {
          if (event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            advance();
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            setIndex((value) => Math.max(0, value - 1));
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            advance();
          }
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <DialogTitle>{t(story.titleKey)}</DialogTitle>
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('story.skip')}
          </Button>
        </div>
        <DialogDescription className="sr-only">
          {t('story.instructions')}
        </DialogDescription>
        <div className="character-story-stage">
          {story.stage === 4 ? (
            <img
              className="character-story-illustration"
              src={challengeStoryArt[story.characterId]}
              alt={`${t(character.nameKey)} · ${t(story.titleKey)}`}
              decoding="async"
            />
          ) : (
            <CharacterPortraitSlot
              character={character}
              expression={expression}
              size="xl"
              label={t(character.nameKey)}
            />
          )}
        </div>
        <button
          type="button"
          className="character-story-copy"
          onClick={advance}
          aria-label={t('story.advance')}
        >
          <strong className="text-sm text-primary">
            {t(line.speaker === 'player' ? 'story.player' : character.nameKey)}
          </strong>
          <span className="mt-3 flex-1 text-base leading-8">
            {t(line.textKey)}
          </span>
          <span className="mt-2 text-right text-xs text-muted-foreground">
            {index + 1}/{story.lines.length} · {t('story.advanceHint')}
          </span>
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={() => setIndex(0)}>
            <RotateCcw className="size-4" />
            {t('story.replay')}
          </Button>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              <ChevronLeft className="size-4" />
              {t('story.previous')}
            </Button>
            <Button size="sm" onClick={advance}>
              {t(
                index === story.lines.length - 1
                  ? 'story.finish'
                  : 'story.next',
              )}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
