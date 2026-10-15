import defaultStick from '@/assets/cosmetics/riichi-stick-default.png';
import inkStick from '@/assets/cosmetics/riichi-stick-ink.png';
import lightningStick from '@/assets/cosmetics/riichi-stick-lightning.png';
import sakuraStick from '@/assets/cosmetics/riichi-stick-sakura.png';
import sparksStick from '@/assets/cosmetics/riichi-stick-sparks.png';

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
