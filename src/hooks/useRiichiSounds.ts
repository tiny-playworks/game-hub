/**
 * 日麻音效：立直/吃/碰/杠/自摸/荣和用 wav（public/sounds/riichi/*.wav）。
 * 出牌/摸牌用 discard.wav / draw.wav；缺失时 Howler onloaderror → beep 兜底。
 * 音量：`audioVolumes.sfx` 作用于 wav/beep，`audioVolumes.voice` 作用于 TTS。
 */

import { useMemo } from 'react';
import useSound from 'use-sound';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { playBeep, speak } from '@/lib/speech';

const BASE = '/sounds/riichi';

export function useRiichiSounds() {
  const { audioVolumes } = usePlayerProfile();
  const sfx = audioVolumes.sfx;
  const voice = audioVolumes.voice;

  const sfxHookVol = 0.8 * sfx;

  const baseOpts = useMemo(
    () => ({
      volume: sfxHookVol,
    }),
    [sfxHookVol],
  );

  const onDiscardLoadError = useMemo(
    () => () => playBeep(880, 120, 0.04 * sfx),
    [sfx],
  );
  const onDrawLoadError = useMemo(
    () => () => playBeep(660, 100, 0.04 * sfx),
    [sfx],
  );

  const [playRich] = useSound(`${BASE}/rich.wav`, baseOpts);
  const [playChi] = useSound(`${BASE}/chi.wav`, baseOpts);
  const [playPon] = useSound(`${BASE}/pon.wav`, baseOpts);
  const [playKan] = useSound(`${BASE}/kan.wav`, baseOpts);
  const [playTumo] = useSound(`${BASE}/tumo.wav`, baseOpts);
  const [playRon] = useSound(`${BASE}/ron.wav`, baseOpts);

  const [playDiscardSound] = useSound(`${BASE}/discard.wav`, {
    ...baseOpts,
    onloaderror: onDiscardLoadError,
  });
  const [playDrawSound] = useSound(`${BASE}/draw.wav`, {
    ...baseOpts,
    onloaderror: onDrawLoadError,
  });

  const playDiscard = () => {
    playDiscardSound();
  };
  const playDraw = () => {
    playDrawSound();
  };

  const playRyuukyoku = () => speak('りゅうきょく', 'ja', voice);

  const playRiichi = () => {
    playRich();
    speak('リーチ', 'ja', voice);
  };

  const playTimeWarning = () => playBeep(940, 110, 0.035 * sfx);

  return {
    playRiichi,
    playChi,
    playPon,
    playKan,
    playTsumo: playTumo,
    playRon,
    playDiscard,
    playDraw,
    playRyuukyoku,
    playTimeWarning,
  };
}
