import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { AOI_OUTFITS } from '@/lib/characterOutfits';
import { CHARACTER_DEFS, normalizePlayerCharacterState } from '@/lib/playerCharacters';
import { apiError, requireSession } from '../auth';
import { getMember, readSnapshot, saveSnapshot, transaction } from '../db';

export function registerCharacterRoutes(app: FastifyInstance, db: DatabaseSync): void {
  app.patch('/api/v1/me/characters', async (request) => {
    const { member } = requireSession(db, request);
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw apiError(400, 'BAD_REQUEST');
    const { baseRevision, activeCharacterId, aoiOutfit } = body as Record<string, unknown>;
    if (!Number.isSafeInteger(baseRevision) ||
      (activeCharacterId === undefined) === (aoiOutfit === undefined))
      throw apiError(400, 'BAD_REQUEST');
    if (activeCharacterId !== undefined &&
      (typeof activeCharacterId !== 'string' ||
        !CHARACTER_DEFS.some((character) => character.id === activeCharacterId)))
      throw apiError(400, 'BAD_REQUEST');
    if (aoiOutfit !== undefined &&
      (typeof aoiOutfit !== 'string' || !(AOI_OUTFITS as readonly string[]).includes(aoiOutfit)))
      throw apiError(400, 'BAD_REQUEST');
    return transaction(db, () => {
      const current = getMember(db, member.id);
      if (!current) throw apiError(401, 'UNAUTHORIZED');
      if (current.revision !== baseRevision)
        throw apiError(409, 'REVISION_CONFLICT', true, current.revision);
      const snapshot = readSnapshot(current);
      if (activeCharacterId !== undefined &&
        !snapshot.characters.unlockedCharacterIds.includes(activeCharacterId as string))
        throw apiError(404, 'ITEM_UNAVAILABLE');
      const characters = normalizePlayerCharacterState({
        ...snapshot.characters,
        ...(activeCharacterId !== undefined ? { activeCharacterId } : {}),
        ...(aoiOutfit !== undefined ? {
          outfitByCharacter: {
            ...snapshot.characters.outfitByCharacter,
            aoi: aoiOutfit,
          },
        } : {}),
        updatedAt: Date.now(),
      });
      return { snapshot: saveSnapshot(db, current, { ...snapshot, characters }) };
    });
  });
}
