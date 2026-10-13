import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { getCosmetic, normalizeCosmetics } from '@/lib/cosmetics';
import { apiError, requireSession } from '../auth';
import { getMember, readSnapshot, saveSnapshot, transaction } from '../db';

export function registerShopRoutes(app: FastifyInstance, db: DatabaseSync): void {
  app.post('/api/v1/shop/purchases', async (request) => {
    const { member } = requireSession(db, request);
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      typeof (body as { itemId?: unknown }).itemId !== 'string') {
      throw apiError(400, 'BAD_REQUEST');
    }
    const itemId = (body as { itemId: string }).itemId;
    const item = getCosmetic(itemId);
    if (!item || item.price === null) throw apiError(404, 'ITEM_UNAVAILABLE');
    return transaction(db, () => {
      const current = getMember(db, member.id);
      if (!current) throw apiError(401, 'UNAUTHORIZED');
      const snapshot = readSnapshot(current);
      if (snapshot.cosmetics.owned.includes(itemId)) {
        throw apiError(409, 'ALREADY_OWNED', false, current.revision);
      }
      if (snapshot.wallet.coins < item.price!) {
        throw apiError(409, 'INSUFFICIENT_COINS', false, current.revision);
      }
      const next = saveSnapshot(db, current, {
        ...snapshot,
        wallet: {
          ...snapshot.wallet,
          coins: snapshot.wallet.coins - item.price!,
          ledger: [
            ...snapshot.wallet.ledger,
            { at: Date.now(), delta: -item.price!, reasonKey: 'wallet.reason.cosmetic' },
          ].slice(-50),
        },
        cosmetics: normalizeCosmetics({
          ...snapshot.cosmetics,
          owned: [...snapshot.cosmetics.owned, itemId],
        }),
      });
      return { snapshot: next, itemId };
    });
  });
}
