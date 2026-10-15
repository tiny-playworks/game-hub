// Serves a packaged static build on this computer only. No household API is started.
const { execFile } = require('node:child_process');
const { createReadStream, existsSync } = require('node:fs');
const { stat } = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const HOST = process.env.GAME_HUB_HOST || '127.0.0.1';
const PORT = parseInt(process.env.GAME_HUB_PORT || process.env.PORT || '18789', 10);

function resolveSiteDir() {
  if (process.env.GAME_HUB_SITE_DIR) {
    return path.resolve(process.env.GAME_HUB_SITE_DIR);
  }
  const localSite = path.resolve(__dirname, 'site');
  if (existsSync(localSite)) return localSite;
  const projectDist = path.resolve(__dirname, '..', 'dist');
  if (existsSync(projectDist)) return projectDist;
  return localSite;
}

const SITE_DIR = resolveSiteDir();
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.m4a': 'audio/mp4',
  '.map': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function reply(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

async function serveFile(req, res, filePath) {
  try {
    const details = await stat(filePath);
    if (!details.isFile()) return false;
    res.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': details.size,
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      createReadStream(filePath).pipe(res);
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
    throw error;
  }
}

function openBrowser(url) {
  if (process.env.GAME_HUB_NO_BROWSER === '1') return;
  if (process.platform === 'win32') {
    execFile('cmd.exe', ['/d', '/c', 'start', '""', url], { windowsHide: true }, (error) => {
      if (error) console.log(`未能自动打开浏览器，请手动访问 ${url}`);
    });
  } else if (process.platform === 'darwin') {
    execFile('open', [url], (error) => {
      if (error) console.log(`未能自动打开浏览器，请手动访问 ${url}`);
    });
  } else if (process.platform === 'linux') {
    execFile('xdg-open', [url], (error) => {
      if (error) console.log(`未能自动打开浏览器，请手动访问 ${url}`);
    });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      reply(res, 405, 'Method not allowed');
      return;
    }

    const pathname = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
    if (pathname === '/healthz') {
      reply(res, 200, JSON.stringify({ status: 'offline' }), 'application/json; charset=utf-8');
      return;
    }
    if (pathname.startsWith('/api/') || pathname === '/ws') {
      reply(res, 404, JSON.stringify({ code: 'SOLO_PACKAGE', message: 'Single-player package' }), 'application/json; charset=utf-8');
      return;
    }

    const requested = path.resolve(SITE_DIR, pathname.replace(/^\/+/, ''));
    if (requested !== SITE_DIR && !requested.startsWith(`${SITE_DIR}${path.sep}`)) {
      reply(res, 403, 'Forbidden');
      return;
    }

    if (await serveFile(req, res, requested === SITE_DIR ? path.join(SITE_DIR, 'index.html') : requested)) return;
    if (!path.extname(pathname) && (await serveFile(req, res, path.join(SITE_DIR, 'index.html')))) return;
    reply(res, 404, 'Not found');
  } catch (error) {
    console.error(error);
    if (!res.headersSent) reply(res, 500, 'Internal server error');
    else res.destroy();
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用。请先关闭已经打开的 Game Hub 窗口或设置环境变量 PORT 更换端口。`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/`;
  console.log(`=========================================`);
  console.log(`  Game Hub 单机版已启动: ${url}`);
  console.log(`  请保持此窗口打开；关闭窗口即停止游戏服务。`);
  console.log(`=========================================`);
  openBrowser(url);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
