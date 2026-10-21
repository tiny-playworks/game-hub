import riichiDefaultAtlas from '@/assets/cosmetics/motion/riichi-default-atlas.webp';
import riichiDefaultPoster from '@/assets/cosmetics/motion/riichi-default-poster.webp';
import riichiSparksAtlas from '@/assets/cosmetics/motion/riichi-sparks-atlas.webp';
import riichiSparksPoster from '@/assets/cosmetics/motion/riichi-sparks-poster.webp';
import riichiSakuraAtlas from '@/assets/cosmetics/motion/riichi-sakura-atlas.webp';
import riichiSakuraPoster from '@/assets/cosmetics/motion/riichi-sakura-poster.webp';
import lightningAtlas from '@/assets/cosmetics/motion/riichi-lightning-atlas.webp';
import lightningPoster from '@/assets/cosmetics/motion/riichi-lightning-poster.webp';
import riichiInkAtlas from '@/assets/cosmetics/motion/riichi-ink-atlas.webp';
import riichiInkPoster from '@/assets/cosmetics/motion/riichi-ink-poster.webp';
import winDefaultAtlas from '@/assets/cosmetics/motion/win-default-atlas.webp';
import winDefaultPoster from '@/assets/cosmetics/motion/win-default-poster.webp';
import winFireworksAtlas from '@/assets/cosmetics/motion/win-fireworks-atlas.webp';
import winFireworksPoster from '@/assets/cosmetics/motion/win-fireworks-poster.webp';
import winSakuraAtlas from '@/assets/cosmetics/motion/win-sakura-atlas.webp';
import winSakuraPoster from '@/assets/cosmetics/motion/win-sakura-poster.webp';
import dragonAtlas from '@/assets/cosmetics/motion/win-dragon-atlas.webp';
import dragonPoster from '@/assets/cosmetics/motion/win-dragon-poster.webp';
import winGalaxyAtlas from '@/assets/cosmetics/motion/win-galaxy-atlas.webp';
import winGalaxyPoster from '@/assets/cosmetics/motion/win-galaxy-poster.webp';
import winMioAtlas from '@/assets/cosmetics/motion/win-mio-atlas.webp';
import winMioPoster from '@/assets/cosmetics/motion/win-mio-poster.webp';
import winChitoseAtlas from '@/assets/cosmetics/motion/win-chitose-atlas.webp';
import winChitosePoster from '@/assets/cosmetics/motion/win-chitose-poster.webp';
import winAyaAtlas from '@/assets/cosmetics/motion/win-aya-atlas.webp';
import winAyaPoster from '@/assets/cosmetics/motion/win-aya-poster.webp';
import winYoruAtlas from '@/assets/cosmetics/motion/win-yoru-atlas.webp';
import winYoruPoster from '@/assets/cosmetics/motion/win-yoru-poster.webp';
import winTsubakiAtlas from '@/assets/cosmetics/motion/win-tsubaki-atlas.webp';
import winTsubakiPoster from '@/assets/cosmetics/motion/win-tsubaki-poster.webp';

export type CosmeticMotionPhase = 'gather' | 'build' | 'impact' | 'settle';
export interface CosmeticMotionCue { frame: number; phase: CosmeticMotionPhase }

export interface CosmeticMotionAsset {
  atlas: string;
  poster: string;
  columns: number;
  frameCount: number;
  frameSize: number;
  durationMs: number;
  cues: readonly CosmeticMotionCue[];
}

function motionAsset(
  atlas: string,
  poster: string,
  kind: 'riichi' | 'win',
): CosmeticMotionAsset {
  return {
    atlas,
    poster,
    columns: 6,
    frameCount: kind === 'riichi' ? 18 : 30,
    frameSize: kind === 'riichi' ? 320 : 256,
    durationMs: kind === 'riichi' ? 1500 : 2500,
    cues: (kind === 'riichi' ? [0, 5, 10, 15] : [0, 8, 18, 26]).map((frame, index) => ({
      frame,
      phase: (['gather', 'build', 'impact', 'settle'] as const)[index],
    })),
  };
}

const motionAssets: Partial<Record<string, CosmeticMotionAsset>> = {
  'riichi-default': motionAsset(riichiDefaultAtlas, riichiDefaultPoster, 'riichi'),
  'riichi-sparks': motionAsset(riichiSparksAtlas, riichiSparksPoster, 'riichi'),
  'riichi-sakura': motionAsset(riichiSakuraAtlas, riichiSakuraPoster, 'riichi'),
  'riichi-lightning': motionAsset(lightningAtlas, lightningPoster, 'riichi'),
  'riichi-ink': motionAsset(riichiInkAtlas, riichiInkPoster, 'riichi'),
  'win-default': motionAsset(winDefaultAtlas, winDefaultPoster, 'win'),
  'win-fireworks': motionAsset(winFireworksAtlas, winFireworksPoster, 'win'),
  'win-sakura': motionAsset(winSakuraAtlas, winSakuraPoster, 'win'),
  'win-dragon': motionAsset(dragonAtlas, dragonPoster, 'win'),
  'win-galaxy': motionAsset(winGalaxyAtlas, winGalaxyPoster, 'win'),
  'win-mio': motionAsset(winMioAtlas, winMioPoster, 'win'),
  'win-chitose': motionAsset(winChitoseAtlas, winChitosePoster, 'win'),
  'win-aya': motionAsset(winAyaAtlas, winAyaPoster, 'win'),
  'win-yoru': motionAsset(winYoruAtlas, winYoruPoster, 'win'),
  'win-tsubaki': motionAsset(winTsubakiAtlas, winTsubakiPoster, 'win'),
};

export function getCosmeticMotion(id: string): CosmeticMotionAsset | undefined {
  return motionAssets[id];
}

export const COSMETIC_IMAGE_TIMEOUT_MS = 3000;
const imageCache = new Map<string, Promise<HTMLImageElement>>();

/** Decode only requested atlases; keep a small cache rather than every shop item. */
export function loadCosmeticAtlas(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) {
    imageCache.delete(url);
    imageCache.set(url, cached);
    return cached;
  }

  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    const timer = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error('Cosmetic image timed out'));
    }, COSMETIC_IMAGE_TIMEOUT_MS);
    image.onload = () => {
      void image.decode().then(
        () => {
          window.clearTimeout(timer);
          resolve(image);
        },
        (error: unknown) => {
          window.clearTimeout(timer);
          reject(error);
        },
      );
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('Cosmetic image could not be loaded'));
    };
    image.src = url;
  });

  imageCache.set(url, pending);
  // Four seated players can each equip a riichi and a winning effect.
  if (imageCache.size > 8) {
    const oldest = imageCache.keys().next().value;
    if (oldest !== undefined) imageCache.delete(oldest);
  }
  void pending.catch(() => {
    if (imageCache.get(url) === pending) imageCache.delete(url);
  });
  return pending;
}

export function preloadCosmeticMotion(id: string): void {
  const asset = getCosmeticMotion(id);
  if (asset && typeof window !== 'undefined') {
    void loadCosmeticAtlas(asset.atlas).catch(() => undefined);
  }
}
