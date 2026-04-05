/**
 * 吃/碰/杠/自摸/荣和 wav 的轻量封装（资源位于 public/sounds/riichi/）。
 * 产品仅日本立直麻将；对局内请用 useRiichiSounds。本 hook 供测试与接口一致性保留。
 */

import { useMemo } from 'react';
import useSound from 'use-sound';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { speak } from '@/lib/speech';

const BASE = '/sounds/riichi';

export function useMahjongSounds() {
  const { audioVolumes } = usePlayerProfile();
  const sfx = audioVolumes.sfx;
  const voice = audioVolumes.voice;

  const baseOpts = useMemo(() => ({ volume: 0.8 * sfx }), [sfx]);

  const [playChi] = useSound(`${BASE}/chi.wav`, baseOpts);
  const [playPon] = useSound(`${BASE}/pon.wav`, baseOpts);
  const [playKan] = useSound(`${BASE}/kan.wav`, baseOpts);
  const [playTumo] = useSound(`${BASE}/tumo.wav`, baseOpts);
  const [playRon] = useSound(`${BASE}/ron.wav`, baseOpts);

  const playDiscard = () => {};
  const playDraw = () => {};
  const playRyuukyoku = () => speak('流局', 'zh', voice);

  return {
    playChi,
    playPon,
    playKan,
    playTsumo: playTumo,
    playRon,
    playDiscard,
    playDraw,
    playRyuukyoku,
  };
}
