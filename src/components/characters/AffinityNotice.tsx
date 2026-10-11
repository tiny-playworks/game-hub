import { Heart, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { type CharacterStory, getCharacterStory } from '@/lib/characterStories';
import { formatMessage } from '@/lib/i18n';
import { AFFINITY_STAGE_EVENT, getCharacterById } from '@/lib/playerCharacters';
import { CharacterStoryPlayer } from './CharacterStoryPlayer';

type Notice = { characterId: string; stage: number };
export function AffinityNotice() {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Notice[]>([]);
  const [story, setStory] = useState<CharacterStory | null>(null);
  const [noticeHost, setNoticeHost] = useState<HTMLElement | null>(null);
  const notice = queue[0];
  const dismiss = () => setQueue((items) => items.slice(1));
  useEffect(() => {
    const add = (event: Event) =>
      setQueue((items) => [
        ...items,
        ...(event as CustomEvent<Notice[]>).detail,
      ]);
    window.addEventListener(AFFINITY_STAGE_EVENT, add);
    return () => window.removeEventListener(AFFINITY_STAGE_EVENT, add);
  }, []);
  useEffect(() => {
    if (!notice || story) {
      setNoticeHost(null);
      return;
    }
    let dialog: Element | null = null;
    let host: HTMLElement | null = null;
    // Keep the reward inside the terminal dialog's focus scope when it is open.
    const attach = () => {
      const next = document.querySelector(
        '.riichi-result-modal[role="dialog"]',
      );
      if (next === dialog) return;
      host?.remove();
      dialog = next;
      host = next ? document.createElement('div') : null;
      if (host && next) next.prepend(host);
      setNoticeHost(host);
    };
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    attach();
    return () => {
      observer.disconnect();
      host?.remove();
    };
  }, [notice, story]);
  const notification =
    notice && !story ? (
      <aside
        className="affinity-notice"
        data-embedded={!!noticeHost}
        role="status"
        aria-live="polite"
      >
        <button
          type="button"
          className="absolute right-3 top-3 text-muted-foreground"
          aria-label={t('story.dismiss')}
          onClick={dismiss}
        >
          <X className="size-4" />
        </button>
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Heart className="size-4 text-rose-400" />
          {t('affinity.increased')}
        </p>
        <p className="mt-2 text-sm leading-6">
          {formatMessage(
            locale,
            notice.stage === 4
              ? 'affinity.frameUnlocked'
              : 'affinity.storyUnlocked',
            {
              character: t(getCharacterById(notice.characterId).nameKey),
              stage: notice.stage,
            },
          )}
        </p>
        <Button
          className="mt-4 w-full"
          size="sm"
          onClick={() => {
            if (notice.stage < 4)
              setStory(
                getCharacterStory(notice.characterId, notice.stage) ?? null,
              );
            else navigate(`/characters/${notice.characterId}`);
            dismiss();
          }}
        >
          {t(notice.stage === 4 ? 'characters.viewRewards' : 'story.read')}
        </Button>
      </aside>
    ) : null;
  return (
    <>
      {noticeHost ? createPortal(notification, noticeHost) : notification}
      {story && (
        <CharacterStoryPlayer
          key={story.id}
          story={story}
          onClose={() => setStory(null)}
        />
      )}
    </>
  );
}
