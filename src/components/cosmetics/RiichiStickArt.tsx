import defaultStick from '@/assets/cosmetics/riichi-stick-default.webp';
import inkStick from '@/assets/cosmetics/riichi-stick-ink.webp';
import lightningStick from '@/assets/cosmetics/riichi-stick-lightning.webp';
import sakuraStick from '@/assets/cosmetics/riichi-stick-sakura.webp';
import sparksStick from '@/assets/cosmetics/riichi-stick-sparks.webp';

const stickArt: Record<string, string> = {
  'riichi-default': defaultStick,
  'riichi-ink': inkStick,
  'riichi-lightning': lightningStick,
  'riichi-sakura': sakuraStick,
  'riichi-sparks': sparksStick,
};

export function RiichiStickArt({ design }: { design: string }) {
  return (
    <img
      className="cosmetic-riichi-stick-art"
      src={stickArt[design] ?? defaultStick}
      alt=""
      aria-hidden="true"
    />
  );
}
