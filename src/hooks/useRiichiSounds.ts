/**
 * 日麻音效：立直/吃/碰/杠/自摸/荣和用 wav（public/sounds/riichi/*.wav）。
 * 出牌/摸牌不做语音播报，避免高频打断；流局保留 TTS 兜底。
 */

import useSound from 'use-sound';
import { playBeep, speak } from '@/lib/speech';

const BASE = '/sounds/riichi';

export function useRiichiSounds() {
  const [playRich] = useSound(`${BASE}/rich.wav`, { volume: 0.8 });
  const [playChi] = useSound(`${BASE}/chi.wav`, { volume: 0.8 });
  const [playPon] = useSound(`${BASE}/pon.wav`, { volume: 0.8 });
  const [playKan] = useSound(`${BASE}/kan.wav`, { volume: 0.8 });
  const [playTumo] = useSound(`${BASE}/tumo.wav`, { volume: 0.8 });
  const [playRon] = useSound(`${BASE}/ron.wav`, { volume: 0.8 });

  /** 打牌：高频事件，默认静音 */
  const playDiscard = () => {};
  /** 摸牌：高频事件，默认静音 */
  const playDraw = () => {};
  /** 流局（无 wav，用 TTS） */
  const playRyuukyoku = () => speak('りゅうきょく', 'ja');
  /** 立直：保留 wav，同时补一个日语 TTS，确保有明确语音「リーチ」 */
  const playRiichi = () => {
    playRich();
    speak('リーチ', 'ja');
  };
  /** 倒计时临界轻提示音 */
  const playTimeWarning = () => playBeep(940, 110, 0.035);

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
