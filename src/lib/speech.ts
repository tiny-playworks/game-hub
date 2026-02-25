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
