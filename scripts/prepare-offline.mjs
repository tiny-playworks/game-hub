import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? walk(join(dir, entry.name))
          : [join(dir, entry.name)],
      ),
    )
  ).flat();
}
const paths = (await walk(root))
  .filter(
    (path) =>
      !/\.(map|gz|br)$/.test(path) &&
      !/offline-(manifest\.json|worker\.js)$/.test(path),
  )
  .sort();
const hash = createHash('sha256');
let bytes = 0;
for (const path of paths) {
  const data = await readFile(path);
  hash.update(relative(root, path));
  hash.update(data);
  bytes += data.length;
}
const manifest = {
  schema: 1,
  version: hash.digest('hex').slice(0, 12),
  bytes,
  assets: paths.map((path) => `/${relative(root, path).split('\\').join('/')}`),
};
const worker = await readFile(
  new URL('./offline-worker.js', import.meta.url),
  'utf8',
);
await writeFile(join(root, 'offline-manifest.json'), JSON.stringify(manifest));
await writeFile(
  join(root, 'offline-worker.js'),
  `const OFFLINE_BUILD = ${JSON.stringify(manifest)};\n${worker}`,
);
console.log(
  `Offline assets: ${manifest.assets.length}, ${(bytes / 1048576).toFixed(1)} MiB, version ${manifest.version}`,
);
