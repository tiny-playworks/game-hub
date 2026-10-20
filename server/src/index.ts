import Fastify from 'fastify';
import { ApiError, assertSameOrigin } from './auth';
import { openDatabase } from './db';
import { prepareRiichiRuntime } from './riichi/runtime';
import { registerArcadeRoutes } from './routes/arcade';
import { registerCharacterRoutes } from './routes/characters';
import { registerMemberRoutes } from './routes/members';
import { registerProgressRoutes } from './routes/progress';
import { registerRiichiRoutes } from './routes/riichi';
import { registerShopRoutes } from './routes/shop';
import { registerSyncRoutes } from './routes/sync';
import { registerReplayRoutes } from './routes/replays';
import { registerLeaderboardRoutes } from './routes/leaderboard';
import { registerJourneyRoutes } from './routes/journey';
import { RoomManager } from './rooms/RoomManager';
import { registerRoomRoutes } from './routes/rooms';
import { setupRoomWebSocket } from './rooms/socket';
import { GameRoomManager } from './gameRooms/GameRoomManager';
import { registerGameRoomRoutes } from './routes/gameRooms';

const app = Fastify({
  logger: true,
  bodyLimit: 12 * 1024 * 1024,
  trustProxy: process.env.GAME_HUB_TRUST_PROXY === '1',
});
const db = openDatabase();

app.addHook('onRequest', async (request) => {
  if (request.url.startsWith('/api/v1/')) assertSameOrigin(request);
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ApiError) {
    reply.code(error.status).send(error.body);
    return;
  }
  app.log.error(error);
  reply.code(500).send({
    code: 'INTERNAL_ERROR',
    messageKey: 'household.error.INTERNAL_ERROR',
    retryable: false,
  });
});

app.get('/healthz', async () => {
  db.prepare('SELECT 1').get();
  return { status: 'ok', revision: process.env.GAME_HUB_REVISION ?? 'unknown' };
});
registerMemberRoutes(app, db);
registerArcadeRoutes(app, db);
registerCharacterRoutes(app, db);
registerProgressRoutes(app, db);
registerRiichiRoutes(app, db);
registerShopRoutes(app, db);
registerSyncRoutes(app, db);
registerReplayRoutes(app, db);
registerJourneyRoutes(app, db);
registerLeaderboardRoutes(app, db);

const roomManager = new RoomManager(db);
registerRoomRoutes(app, db, roomManager);
const gameManager = new GameRoomManager(db, (error) => app.log.error(error));
registerGameRoomRoutes(app, db, gameManager);

app.addHook('onClose', async () => {
  gameManager.close();
  db.close();
});

try {
  await prepareRiichiRuntime();
  await app.listen({
    host: process.env.GAME_HUB_HOST ?? '0.0.0.0',
    port: Number(process.env.GAME_HUB_PORT ?? 8787),
  });
  setupRoomWebSocket(app.server, db, roomManager, gameManager);
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await app.close();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close();
  });
}
