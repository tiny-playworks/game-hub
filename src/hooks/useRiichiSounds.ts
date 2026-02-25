/**
 * 日麻音效：立直/吃/碰/杠/自摸/荣和用 wav（public/sounds/riichi/*.wav）；
 * 打牌/摸牌/流局无资源时用浏览器 TTS 播报。
 */

import useSound from 'use-sound';
import { speak } from '@/lib/speech';

const BASE = '/sounds/riichi';

export function useRiichiSounds() {
  const [playRich] = useSound(`${BASE}/rich.wav`, { volume: 0.8 });
  const [playChi] = useSound(`${BASE}/chi.wav`, { volume: 0.8 });
  const [playPon] = useSound(`${BASE}/pon.wav`, { volume: 0.8 });
  const [playKan] = useSound(`${BASE}/kan.wav`, { volume: 0.8 });
  const [playTumo] = useSound(`${BASE}/tumo.wav`, { volume: 0.8 });
  const [playRon] = useSound(`${BASE}/ron.wav`, { volume: 0.8 });

  /** 打牌（无 wav，用 TTS 短音） */
  const playDiscard = () => speak('ぽん', 'ja');
  /** 摸牌（无 wav，用 TTS） */
  const playDraw = () => speak('ひ', 'ja');
  /** 流局（无 wav，用 TTS） */
  const playRyuukyoku = () => speak('りゅうきょく', 'ja');

  return {
    playRiichi: playRich,
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
