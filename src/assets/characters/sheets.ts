import type { CharacterExpression } from '@/lib/playerCharacters';
import type { AoiOutfit } from '@/lib/characterOutfits';
import casual from './aoi/casual.jpg';
import moonlight from './aoi/moonlight.jpg';
import vermilion from './aoi/vermilion.jpg';
import ink from './aoi/ink.jpg';
import blossom from './aoi/blossom.jpg';

// Viewports exclude board labels and neighboring panels, without repainting the source art.
const sheets = {
  casual: {
    src: casual,
    columns: [816, 476, 1165],
    widths: [330, 320, 349],
    top: 62,
    height: 532,
    avatarY: 615,
  },
  moonlight: {
    src: moonlight,
    columns: [836, 472, 1192],
    widths: [333, 342, 321],
    top: 62,
    height: 514,
    avatarY: 596,
  },
  vermilion: {
    src: vermilion,
    columns: [851, 512, 1192],
    widths: [324, 322, 325],
    top: 60,
    height: 517,
    avatarY: 599,
  },
  ink: {
    src: ink,
    columns: [851, 512, 1192],
    widths: [324, 322, 325],
    top: 60,
    height: 517,
    avatarY: 599,
  },
  blossom: {
    src: blossom,
    columns: [850, 511, 1192],
    widths: [325, 321, 324],
    top: 60,
    height: 517,
    avatarY: 599,
  },
} satisfies Record<AoiOutfit, unknown>;

export function getCharacterSheet(
  id: string,
  expression: CharacterExpression,
  portrait: boolean,
  outfit = 'casual',
) {
  if (id !== 'aoi') return undefined;
  const sheet = sheets[outfit as AoiOutfit] ?? sheets.casual;
  const index = { normal: 0, happy: 1, frustrated: 2 }[expression];
  return {
    src: sheet.src,
    width: 1536,
    height: 1024,
    viewBox: `${sheet.columns[index]} ${portrait ? sheet.top : sheet.avatarY} ${sheet.widths[index]} ${portrait ? sheet.height : 370}`,
  };
}
