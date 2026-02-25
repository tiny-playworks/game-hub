/**
 * 通用麻将音效：川麻/国标复用 public/sounds/riichi 的 吃/碰/杠/自摸/荣和 wav；
 * 打牌/摸牌/流局用浏览器 TTS 中文播报。
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

  const playDiscard = () => speak('出', 'zh');
  const playDraw = () => speak('摸', 'zh');
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
