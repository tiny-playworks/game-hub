/**
 * 浏览器自带 TTS（speechSynthesis），用于无音效文件时的占位播报。
 * 日麻场景：打牌、摸牌、流局等。
 */

function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
}

let audioContext: AudioContext | null = null;
const activeOscillators = new Set<OscillatorNode>();
const activeGains = new Map<GainNode, number>();

/** Keep the context unlocked by a user gesture for later game effects on mobile. */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioContext && audioContext.state !== 'closed') return audioContext;
  const Ctx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  try {
    audioContext = new Ctx();
    return audioContext;
  } catch {
    return null;
  }
}

export function unlockAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined);
}

export function trackAudioOscillator(
  oscillator: OscillatorNode,
  gain: GainNode,
): void {
  activeOscillators.add(oscillator);
  activeGains.set(gain, (activeGains.get(gain) ?? 0) + 1);
  oscillator.addEventListener(
    'ended',
    () => {
      activeOscillators.delete(oscillator);
      const remaining = (activeGains.get(gain) ?? 1) - 1;
      if (remaining <= 0) activeGains.delete(gain);
      else activeGains.set(gain, remaining);
    },
    { once: true },
  );
}

export function stopSoundEffects(): void {
  const now = audioContext?.currentTime ?? 0;
  for (const gain of activeGains.keys()) {
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
    } catch {
      // Audio device changes must not block the mute control.
    }
  }
  for (const oscillator of activeOscillators) {
    try {
      oscillator.stop();
    } catch {
      /* Already stopped. */
    }
  }
  activeOscillators.clear();
  activeGains.clear();
}

export function stopSpeech(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* Unsupported voice backend. */
  }
}

/** 使用浏览器 TTS 朗读文本；无权限或未支持则不执行。`volumeScale` 为 0–1，与档案「语音」音量相乘。 */
export function speak(
  text: string,
  lang: 'ja' | 'zh' = 'ja',
  volumeScale = 1,
): void {
  if (!text.trim() || !isSpeechSupported()) return;
  const scale = Math.min(1, Math.max(0, volumeScale));
  if (scale <= 0) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ja' ? 'ja-JP' : 'zh-CN';
    u.volume = 0.9 * scale;
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
  if (typeof window === 'undefined' || volume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    trackAudioOscillator(oscillator, gain);
    oscillator.start();
    oscillator.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // ignore
  }
}
