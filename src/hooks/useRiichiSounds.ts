/** 日麻音效仅在首次播放时加载；短促摸打声使用本地合成音。 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { playBeep, speak } from '@/lib/speech';

/** A short rising chord, synthesized locally; no voice assets are needed. */
function yakumanChime(volume: number) {
  if (volume <= 0 || typeof window.AudioContext === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.055 * volume,
      ctx.currentTime + 0.08,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.85);
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(ctx.currentTime + index * 0.07);
      oscillator.stop(ctx.currentTime + 0.9);
    });
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 1000);
  } catch {
    /* Audio availability must not interrupt settlement. */
  }
}

type Voice = 'rich' | 'chi' | 'pon' | 'kan' | 'tumo' | 'ron';
const BASE = '/sounds/riichi';

export function useRiichiSounds() {
  const { audioVolumes } = usePlayerProfile();
  const { sfx, voice } = audioVolumes;
  const cache = useRef(new Map<Voice, HTMLAudioElement>());

  // User gesture unlock for mobile audio environments
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctx =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          if (ctx.state === 'suspended') {
            void ctx.resume();
          }
          void ctx.close().catch(() => undefined);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('pointerdown', unlock, {
      once: true,
      passive: true,
    });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const playVoice = useCallback(
    (name: Voice) => {
      if (voice <= 0) return;
      let audio = cache.current.get(name);
      if (!audio) {
        audio = new Audio(`${BASE}/${name}.m4a`);
        audio.preload = 'none';
        cache.current.set(name, audio);
      }
      audio.volume = 0.8 * voice;
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    },
    [voice],
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
      playYakuman: () => yakumanChime(sfx),
    }),
    [playVoice, sfx, voice],
  );
}
