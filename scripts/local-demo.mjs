import { spawn } from 'node:child_process';
import { createServer, request as proxyRequest } from 'node:http';
import { createConnection } from 'node:net';
import { createReadStream } from 'node:fs';
import {
  mkdir,
  open,
  readFile,
  writeFile,
  unlink,
  stat,
} from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA = join(ROOT, 'server/data/demo');
const MARKER = join(DATA, '.demo-only');
const LOCK = join(DATA, '.running');
const DB = join(DATA, 'household.sqlite');
const PORT = 18792;
const API_PORT = 18793;
const args = process.argv.slice(2);
if (args.some((arg) => !['--reset', '--no-build'].includes(arg)))
  throw new Error('Usage: pnpm demo [--no-build] | pnpm demo:reset');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 24 || (major === 24 && minor < 15))
  throw new Error('本机家庭演示需要 Node 24.15 或更高版本。');
await mkdir(DATA, { recursive: true });
try {
  if ((await readFile(MARKER, 'utf8')) !== 'game-hub-local-demo-v1')
    throw new Error('Unknown demo directory');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  try {
    await stat(DB);
    throw new Error('Refusing to adopt an existing unmarked database', { cause: error });
  } catch (existing) {
    if (existing.code !== 'ENOENT') throw existing;
  }
  await writeFile(MARKER, 'game-hub-local-demo-v1', { flag: 'wx' });
}
try {
  const pid = Number(await readFile(LOCK, 'utf8'));
  if (!Number.isSafeInteger(pid) || pid < 1)
    throw new Error('Invalid demo lock; inspect server/data/demo/.running');
  try {
    process.kill(pid, 0);
    throw new Error('演示环境正在运行，请先在该终端按 Ctrl+C 关闭。');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
  await unlink(LOCK);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const lock = await open(LOCK, 'wx');
await lock.writeFile(String(process.pid));
await lock.close();
const children = new Set();
const sockets = new Set();
let server;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  server?.close();
  for (const socket of sockets) socket.destroy();
  const exits = [...children].map(
    (child) =>
      new Promise((resolveExit) => {
        if (child.exitCode !== null) resolveExit();
        else child.once('exit', resolveExit);
      }),
  );
  for (const child of children) child.kill('SIGTERM');
  const timer = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 4000);
  await Promise.all(exits);
  clearTimeout(timer);
  await unlink(LOCK).catch(() => {});
  process.exitCode = code;
}
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
const env = {
  ...process.env,
  GAME_HUB_DEMO: '1',
  GAME_HUB_DB_PATH: DB,
  GAME_HUB_HOST: '127.0.0.1',
  GAME_HUB_PORT: String(API_PORT),
  GAME_HUB_REVISION: 'local-demo',
};
function child(command, argv, cwd = ROOT) {
  const item = spawn(command, argv, { cwd, env, stdio: 'inherit' });
  children.add(item);
  item.once('error', () => children.delete(item));
  item.once('exit', () => children.delete(item));
  return item;
}
async function run(command, argv, cwd) {
  if (stopping) throw new Error('Cancelled');
  await new Promise((resolveRun, reject) => {
    const item = child(command, argv, cwd);
    item.once('error', reject);
    item.once('exit', (code) =>
      code === 0
        ? resolveRun()
        : reject(new Error(`${command} exited ${code}`)),
    );
  });
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};
try {
  if (args.includes('--reset')) {
    for (const file of [DB, `${DB}-wal`, `${DB}-shm`])
      await unlink(file).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    console.log(
      '只重置了 server/data/demo 中的演示库。运行 pnpm demo 会重新创建示例数据。',
    );
    await stop();
  } else {
    if (!args.includes('--no-build')) {
      await run('pnpm', ['build']);
      await run('pnpm', ['build'], join(ROOT, 'server'));
    }
    await run(process.execPath, ['server/dist/demo.mjs']);
    const api = child(process.execPath, ['server/dist/index.mjs']);
    api.once('error', () => void stop(1));
    api.once('exit', () => {
      if (!stopping) void stop(1);
    });
    // Wait for this child to be healthy; do not accidentally use an unrelated service.
    let healthy = false;
    for (
      let attempt = 0;
      attempt < 100 && api.exitCode === null && !stopping;
      attempt++
    ) {
      try {
        const value = await (
          await fetch(`http://127.0.0.1:${API_PORT}/healthz`, {
            signal: AbortSignal.timeout(500),
          })
        ).json();
        if (value.demo === true && value.revision === 'local-demo') {
          healthy = true;
          break;
        }
      } catch {
        /* still starting */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!healthy || stopping) throw new Error('Demo API did not start');
    server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') {
        const proxy = proxyRequest(
          {
            hostname: '127.0.0.1',
            port: API_PORT,
            method: req.method,
            path: req.url,
            headers: req.headers,
          },
          (upstream) => {
            res.writeHead(upstream.statusCode, upstream.headers);
            upstream.pipe(res);
          },
        );
        proxy.on('error', () => {
          if (!res.headersSent) res.writeHead(502);
          res.end();
        });
        req.pipe(proxy);
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      try {
        const site = join(ROOT, 'dist');
        let file = resolve(site, `.${decodeURIComponent(url.pathname)}`);
        if (file !== site && !file.startsWith(site + sep)) {
          res.writeHead(403);
          res.end();
          return;
        }
        if (!extname(file)) file = join(site, 'index.html');
        const info = await stat(file);
        if (!info.isFile()) throw new Error('Not a file');
        res.writeHead(200, {
          'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
          'Content-Length': info.size,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        if (req.method === 'HEAD') res.end();
        else
          createReadStream(file)
            .on('error', () => res.destroy())
            .pipe(res);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
    });
    server.on('upgrade', (req, socket, head) => {
      if (new URL(req.url, `http://127.0.0.1:${PORT}`).pathname !== '/ws') {
        socket.destroy();
        return;
      }
      const upstream = createConnection(API_PORT, '127.0.0.1', () => {
        upstream.write(
          `${req.method} ${req.url} HTTP/1.1\r\n${req.rawHeaders.reduce((lines, item, i, all) => (i % 2 ? lines : `${lines}${item}: ${all[i + 1]}\r\n`), '')}\r\n`,
        );
        if (head.length) upstream.write(head);
        socket.pipe(upstream).pipe(socket);
      });
      upstream.on('error', () => socket.destroy());
      socket.on('error', () => upstream.destroy());
      socket.on('close', () => upstream.destroy());
    });
    await new Promise((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(PORT, '127.0.0.1', resolveListen);
    });
    console.log(
      `\n本机家庭演示：http://127.0.0.1:${PORT}/family\n四名演示成员的 PIN 均为 1234。甲乙的五子棋接管后可一步结束；棋友和牌友有等待中的象棋／斗地主桌。\n只使用 ${DB}，Ctrl+C 关闭。`,
    );
  }
} catch (error) {
  console.error(error.message);
  await stop(1);
}
