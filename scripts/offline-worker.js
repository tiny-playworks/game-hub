/* global OFFLINE_BUILD */
const PREFIX = 'game-hub-offline-v1-';
const READY = '/__game_hub_offline_ready__';
let downloading = null;
self.addEventListener('install', (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);

async function status() {
  const names = (await caches.keys()).filter((name) => name.startsWith(PREFIX));
  const completed = [];
  for (const name of names) {
    const response = await (await caches.open(name)).match(READY);
    if (response) completed.push({ name, ...(await response.json()) });
  }
  return completed.sort((a, b) => b.savedAt - a.savedAt);
}
async function download(report) {
  const name = `${PREFIX}${OFFLINE_BUILD.version}-${Date.now()}`;
  const cache = await caches.open(name);
  let done = 0;
  let failed = false;
  const queue = [...OFFLINE_BUILD.assets, '/offline-manifest.json'];
  // Bound concurrency to avoid exhausting browser connections or memory.
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, async () => {
      while (queue.length && !failed) {
        const path = queue.shift();
        try {
          const response = await fetch(path, {
            cache: 'reload',
            credentials: 'omit',
          });
          if (
            !response.ok ||
            response.redirected ||
            (path !== '/index.html' &&
              !path.endsWith('.html') &&
              response.headers.get('content-type')?.includes('text/html'))
          )
            throw new Error('Asset unavailable');
          await cache.put(path, response);
          report({
            type: 'progress',
            done: ++done,
            total: OFFLINE_BUILD.assets.length + 1,
          });
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }),
  );
  if (results.some((result) => result.status === 'rejected')) {
    await caches.delete(name);
    throw new Error('Download incomplete');
  }
  await cache.put(
    READY,
    new Response(
      JSON.stringify({
        version: OFFLINE_BUILD.version,
        savedAt: Date.now(),
        bytes: OFFLINE_BUILD.bytes,
      }),
    ),
  );
  // Keep the previous successful build for open tabs and interrupted updates.
  const completed = await status();
  const keep = new Set(completed.slice(0, 2).map((item) => item.name));
  await Promise.all(
    (await caches.keys())
      .filter((key) => key.startsWith(PREFIX) && !keep.has(key))
      .map((key) => caches.delete(key)),
  );
}
self.addEventListener('message', (event) => {
  const port = event.ports[0];
  if (!port) return;
  const report = (value) => port.postMessage(value);
  event.waitUntil(
    (async () => {
      try {
        if (event.data?.type === 'download') {
          if (downloading) {
            report({ type: 'error' });
            return;
          }
          downloading = download(report);
          try {
            await downloading;
          } finally {
            downloading = null;
          }
        } else if (event.data?.type === 'clear') {
          if (downloading) {
            report({ type: 'error' });
            return;
          }
          await Promise.all(
            (await caches.keys())
              .filter((name) => name.startsWith(PREFIX))
              .map((name) => caches.delete(name)),
          );
        } else if (event.data?.type !== 'status') return;
        report({ type: 'done', completed: await status() });
      } catch {
        report({ type: 'error' });
      }
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/ws' ||
    url.pathname === '/healthz' ||
    url.pathname === '/offline-worker.js'
  )
    return;
  event.respondWith(
    (async () => {
      const completed = await status();
      const cached = async (path) => {
        for (const item of completed) {
          const match = await (await caches.open(item.name)).match(path);
          if (match) return match;
        }
      };
      if (request.mode === 'navigate') {
        try {
          return await fetch(request);
        } catch {
          return (await cached('/index.html')) ?? Response.error();
        }
      }
      // Only immutable build assets are served cache-first. Manifest/version is network-first.
      if (url.pathname.startsWith('/static/')) {
        const match = await cached(url.pathname);
        if (match) return match;
      }
      try {
        return await fetch(request);
      } catch {
        return (await cached(url.pathname)) ?? Response.error();
      }
    })(),
  );
});
