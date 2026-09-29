/** 日麻音效仅在首次播放时加载；短促摸打声使用本地合成音。 */
import { useCallback, useMemo, useRef } from 'react';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { playBeep, speak } from '@/lib/speech';

type Voice = 'rich' | 'chi' | 'pon' | 'kan' | 'tumo' | 'ron';
const BASE = '/sounds/riichi';

export function useRiichiSounds() {
  const { audioVolumes } = usePlayerProfile();
  const { sfx, voice } = audioVolumes;
  const cache = useRef(new Map<Voice, HTMLAudioElement>());
  const playVoice = useCallback(
    (name: Voice) => {
      if (sfx <= 0) return;
      let audio = cache.current.get(name);
      if (!audio) {
        audio = new Audio(`${BASE}/${name}.m4a`);
        audio.preload = 'none';
        cache.current.set(name, audio);
      }
      audio.volume = 0.8 * sfx;
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    },
    [sfx],
  );

  return useMemo(
    () => ({
      playRiichi: () => {
        playVoice('rich');
        speak('リーチ', 'ja', voice);
      },
      playChi: () => playVoice('chi'),
      playPon: () => playVoice('pon'),
      playKan: () => playVoice('kan'),
      playTsumo: () => playVoice('tumo'),
      playRon: () => playVoice('ron'),
      playDiscard: () => playBeep(880, 120, 0.04 * sfx),
      playDraw: () => playBeep(660, 100, 0.04 * sfx),
      playRyuukyoku: () => speak('りゅうきょく', 'ja', voice),
      playTimeWarning: () => playBeep(940, 110, 0.035 * sfx),
    }),
    [playVoice, sfx, voice],
  );
}
