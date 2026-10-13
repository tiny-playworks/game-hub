export const AOI_OUTFITS = [
  'casual',
  'moonlight',
  'vermilion',
  'ink',
  'blossom',
] as const;
export type AoiOutfit = (typeof AOI_OUTFITS)[number];

export function normalizeCharacterOutfits(
  raw: unknown,
): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const aoi = (raw as Record<string, unknown>).aoi;
  return typeof aoi === 'string' && AOI_OUTFITS.includes(aoi as AoiOutfit)
    ? { aoi }
    : {};
}
