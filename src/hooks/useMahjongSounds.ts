/**
 * 吃/碰/杠/自摸/荣和 wav 的轻量封装（资源位于 public/sounds/riichi/）。
 * 产品仅日本立直麻将；对局内请用 useRiichiSounds。本 hook 供测试与接口一致性保留。
 */

import useSound from 'use-sound';
import { speak } from '@/lib/speech';

const BASE = '/sounds/riichi';

export function useMahjongSounds() {
  const [playChi] = useSound(`${BASE}/chi.wav`, { volume: 0.8 });
  const [playPon] = useSound(`${BASE}/pon.wav`, { volume: 0.8 });
  const [playKan] = useSound(`${BASE}/kan.wav`, { volume: 0.8 });
  const [playTumo] = useSound(`${BASE}/tumo.wav`, { volume: 0.8 });
  const [playRon] = useSound(`${BASE}/ron.wav`, { volume: 0.8 });

  const playDiscard = () => {};
  const playDraw = () => {};
  const playRyuukyoku = () => speak('流局', 'zh');

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
