/**
 * 浏览器自带 TTS（speechSynthesis），用于无音效文件时的占位播报。
 * 日麻场景：打牌、摸牌、流局等。
 */

function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
}

/** 使用浏览器 TTS 朗读文本；无权限或未支持则不执行 */
export function speak(text: string, lang: 'ja' | 'zh' = 'ja'): void {
  if (!text.trim() || !isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ja' ? 'ja-JP' : 'zh-CN';
    u.volume = 0.9;
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

/** 轻提示音（短促 beep），用于倒计时临界提醒。 */
export function playBeep(
  frequency = 880,
  durationMs = 120,
  volume = 0.04,
): void {
  if (typeof window === 'undefined') return;
  const Ctx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    window.setTimeout(() => {
      oscillator.stop();
      ctx.close().catch(() => {});
    }, durationMs);
  } catch {
    // ignore
  }
}
