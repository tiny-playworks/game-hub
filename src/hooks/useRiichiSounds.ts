/** 日麻音效仅在首次播放时加载；短促摸打声使用本地合成音。 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { playRiichiTileSound } from '@/lib/riichiAudio';
import {
  getAudioContext,
  playBeep,
  speak,
  stopSoundEffects,
  stopSpeech,
  trackAudioOscillator,
  unlockAudioContext,
} from '@/lib/speech';

const activeVoiceElements = new Set<HTMLAudioElement>();
const activeVoiceCompletions = new Map<HTMLAudioElement, () => void>();

export function stopRiichiVoicePlayback(): void {
  for (const audio of activeVoiceElements) {
    try {
      audio.pause();
      audio.currentTime = 0;
      activeVoiceCompletions.get(audio)?.();
    } catch {
      // Unloaded audio elements may reject seeking on some browsers.
    }
  }
  stopSpeech();
}

export function stopRiichiAudioPlayback(): void {
  stopRiichiVoicePlayback();
  stopSoundEffects();
}

/** A short rising chord, synthesized locally; no voice assets are needed. */
function yakumanChime(volume: number) {
  const silent = () => {};
  if (volume <= 0) return silent;
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') return silent;
    const oscillators: OscillatorNode[] = [];
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
      oscillators.push(oscillator);
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      trackAudioOscillator(oscillator, gain);
      oscillator.start(ctx.currentTime + index * 0.07);
      oscillator.stop(ctx.currentTime + 0.9);
    });
    return () => {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      for (const oscillator of oscillators) {
        try { oscillator.stop(); } catch { /* Already finished. */ }
      }
    };
  } catch {
    /* Audio availability must not interrupt settlement. */
    return silent;
  }
}

type Voice = 'rich' | 'chi' | 'pon' | 'kan' | 'tumo' | 'ron';
const BASE = '/sounds/riichi';

export function useRiichiSounds() {
  const { audioVolumes } = usePlayerProfile();
  const { sfx, voice } = audioVolumes;
  const cache = useRef(new Map<Voice, HTMLAudioElement>());
  const effects = useRef(new Map<() => void, number>());
  const ownEffect = useCallback((stop: () => void, durationMs: number) => {
    const cancel = () => {
      const timer = effects.current.get(cancel);
      if (timer === undefined) return;
      window.clearTimeout(timer);
      effects.current.delete(cancel);
      stop();
    };
    const timer = window.setTimeout(() => effects.current.delete(cancel), durationMs);
    effects.current.set(cancel, timer);
    return cancel;
  }, []);

  // User gesture unlock for mobile audio environments
  useEffect(() => {
    const unlock = () => unlockAudioContext();
    window.addEventListener('pointerdown', unlock, {
      once: true,
      passive: true,
    });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (voice <= 0) stopRiichiVoicePlayback();
    if (sfx <= 0) stopSoundEffects();
  }, [sfx, voice]);

  useEffect(
    () => () => {
      for (const cancel of [...effects.current.keys()]) cancel();
      for (const audio of cache.current.values()) {
        audio.pause();
        activeVoiceCompletions.get(audio)?.();
        activeVoiceElements.delete(audio);
      }
    },
    [],
  );

  const playVoice = useCallback(
    (name: Voice) => {
      if (voice <= 0 || navigator.userActivation?.hasBeenActive === false) return Promise.resolve();
      let audio = cache.current.get(name);
      if (!audio) {
        audio = new Audio(`${BASE}/${name}.m4a`);
        audio.preload = 'none';
        cache.current.set(name, audio);
        activeVoiceElements.add(audio);
      }
      try {
        audio.volume = 0.8 * voice;
        activeVoiceCompletions.get(audio)?.();
        audio.currentTime = 0;
      } catch { return Promise.resolve(); }
      const element = audio;
      return new Promise<void>((resolve) => {
        let timer = 0;
        const complete = () => {
          window.clearTimeout(timer);
          element.removeEventListener('ended', complete);
          element.removeEventListener('error', complete);
          if (activeVoiceCompletions.get(element) === complete) activeVoiceCompletions.delete(element);
          resolve();
        };
        activeVoiceCompletions.set(element, complete);
        element.addEventListener('ended', complete, { once: true });
        element.addEventListener('error', complete, { once: true });
        timer = window.setTimeout(complete, 5000);
        try { void element.play().catch(complete); } catch { complete(); }
      });
    },
    [voice],
  );

  return useMemo(
    () => ({
      playRiichi: () => playVoice('rich'),
      playChi: () => playVoice('chi'),
      playPon: () => playVoice('pon'),
      playKan: () => playVoice('kan'),
      playTsumo: () => playVoice('tumo'),
      playRon: () => playVoice('ron'),
      playDiscard: () => { ownEffect(playRiichiTileSound('discard', sfx), 200); },
      playDraw: () => { ownEffect(playRiichiTileSound('draw', sfx), 200); },
      playRyuukyoku: () => speak('りゅうきょく', 'ja', voice),
      playTimeWarning: () => playBeep(940, 110, 0.035 * sfx),
      playYakuman: () => ownEffect(yakumanChime(sfx), 1000),
    }),
    [playVoice, sfx, voice, ownEffect],
  );
}
