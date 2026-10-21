import { getAudioContext, trackAudioOscillator } from './speech';
import type { CosmeticMotionPhase } from './cosmeticMedia';

type StopSound = () => void;
const silent: StopSound = () => {};
const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

/** Small reusable noise buffer; no downloads and no continuous rendering loop. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let state = 0x51f15e;
    for (let index = 0; index < samples.length; index++) {
      state = (Math.imul(state, 1664525) + 1013904223) | 0;
      samples[index] = (state >>> 0) / 2147483648 - 1;
    }
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

function soundGraph(volume: number) {
  if (volume <= 0 || navigator.userActivation?.hasBeenActive === false) return null;
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return null;
  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [];
  const gains: GainNode[] = [];
  let stopped = false;
  const connect = (source: AudioScheduledSourceNode, duration: number, level: number, attack: number, filter?: BiquadFilterNode) => {
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level * volume), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    if (filter) { source.connect(filter); filter.connect(gain); nodes.push(filter); }
    else source.connect(gain);
    gain.connect(ctx.destination);
    trackAudioOscillator(source, gain);
    source.addEventListener('ended', () => filter?.disconnect(), { once: true });
    sources.push(source);
    gains.push(gain);
    source.start(now);
    source.stop(now + duration + 0.015);
  };
  return {
    tone(frequency: number, duration: number, level: number, endFrequency = frequency, type: OscillatorType = 'sine') {
      const source = ctx.createOscillator();
      source.type = type;
      source.frequency.setValueAtTime(frequency, ctx.currentTime);
      source.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), ctx.currentTime + duration);
      connect(source, duration, level, 0.004);
    },
    noise(frequency: number, duration: number, level: number, type: BiquadFilterType = 'bandpass', attack = 0.006) {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = 0.8;
      connect(source, duration, level, attack, filter);
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      for (const gain of gains) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
      }
      for (const source of sources) {
        try { source.stop(); } catch { /* Already finished. */ }
      }
      for (const node of nodes) node.disconnect();
    },
  };
}

export function playRiichiTileSound(kind: 'draw' | 'discard', volume: number): StopSound {
  const graph = soundGraph(volume);
  if (!graph) return silent;
  try {
    if (kind === 'draw') {
      graph.noise(1500, 0.09, 0.065, 'highpass');
      graph.tone(560, 0.055, 0.022, 410);
    } else {
      graph.noise(2400, 0.065, 0.12);
      graph.tone(850, 0.075, 0.06, 390);
      graph.tone(1780, 0.045, 0.025, 1210, 'triangle');
    }
    return graph.stop;
  } catch { graph.stop(); return silent; }
}

/** A cue is played only when its painted frame is actually reached. */
export function playCosmeticCue(id: string, phase: CosmeticMotionPhase, volume: number): StopSound {
  const graph = soundGraph(volume);
  if (!graph) return silent;
  try {
    const impact = phase === 'impact';
    const tail = phase === 'settle';
    const duration = impact ? 0.23 : tail ? 0.18 : 0.27;
    const power = impact ? 0.12 : tail ? 0.035 : 0.055;
    if (id.includes('lightning') || id === 'win-aya') {
      graph.noise(impact ? 2900 : 1700, duration, power, 'highpass');
      graph.tone(impact ? 125 : 320, duration, power * 0.5, impact ? 48 : 670, 'triangle');
    } else if (id === 'win-dragon') {
      graph.noise(impact ? 620 : 1100, duration + 0.08, power, 'lowpass', impact ? 0.004 : 0.06);
      graph.tone(impact ? 145 : 95, duration + 0.05, power * 0.7, impact ? 52 : 175);
      if (impact) graph.tone(880, 0.23, 0.035, 660, 'triangle');
    } else if (id.includes('sparks') || id.includes('fireworks')) {
      graph.noise(impact ? 3200 : 2100, duration, power, 'highpass');
      if (impact) graph.tone(110, 0.19, 0.065, 45);
    } else if (id.includes('sakura') || id === 'win-tsubaki') {
      graph.noise(3200, duration, power * 0.5, 'highpass', 0.025);
      graph.tone(impact ? 1318.5 : 987.77, duration, power * 0.22, tail ? 880 : 1480);
    } else if (id === 'win-galaxy' || id === 'win-yoru') {
      graph.tone(impact ? 783.99 : 523.25, duration + 0.05, power * 0.45);
      graph.tone(impact ? 1174.66 : 783.99, duration, power * 0.22);
      graph.noise(2400, duration, power * 0.2, 'highpass', 0.04);
    } else if (id.includes('ink') || id === 'win-mio' || id === 'win-chitose') {
      graph.noise(id === 'win-chitose' ? 1900 : 850, duration, power * 0.65, 'bandpass', 0.035);
      if (impact) graph.tone(id === 'win-mio' ? 620 : 460, 0.17, 0.028, 330);
    } else {
      graph.noise(impact ? 2300 : 1500, duration, power * 0.55);
      graph.tone(impact ? 780 : 400, duration * 0.6, power * 0.4, impact ? 300 : 520, 'triangle');
    }
    return graph.stop;
  } catch { graph.stop(); return silent; }
}
