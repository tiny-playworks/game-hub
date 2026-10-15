import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const options = args.filter((value) => value !== '--skip-build');
if (options.length > 1)
  throw new Error('Usage: prepare-nas-release.mjs [releaseId] [--skip-build]');
const stamp = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})
  .format(new Date())
  .replace(/\D/g, '');
const releaseId = options[0] ?? stamp;
if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(releaseId))
  throw new Error('Invalid releaseId');
if (!skipBuild) {
  const build = spawnSync(
    process.execPath,
    [path.join(root, 'node_modules/rstack/bin/rs.js'), 'build'],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const destination = path.join(root, 'output/nas', releaseId);
const staging = `${destination}.partial`;
await mkdir(path.dirname(destination), { recursive: true });
for (const directory of [destination, staging]) {
  try {
    await stat(directory);
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  throw new Error(`Release path already exists: ${directory}`);
}
await cp(path.join(root, 'dist'), staging, { recursive: true });
await writeFile(
  path.join(staging, 'release.json'),
  `${JSON.stringify(
    {
      releaseId,
      preparedAt: new Date().toISOString(),
      revision: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim() || 'unknown',
      dirty: Boolean(spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout?.trim()),
    },
    null,
    2,
  )}\n`,
);

async function files(directory, prefix = '') {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + item.name;
    if (item.isDirectory())
      result.push(
        ...(await files(path.join(directory, item.name), `${relative}/`)),
      );
    else if (item.isFile()) result.push(relative);
    else throw new Error(`Unsupported release entry: ${relative}`);
  }
  return result.sort();
}
const entries = await files(staging);
for (const extension of ['.js', '.css', '.wasm']) {
  if (!entries.some((file) => file.endsWith(extension)))
    throw new Error(`Release missing ${extension}`);
}
const html = await readFile(path.join(staging, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  const resource = match[1];
  if (/^(?:https?:|data:|#)/.test(resource)) continue;
  const relative = resource.replace(/^\//, '').split(/[?#]/)[0];
  if (!entries.includes(relative))
    throw new Error(`HTML resource missing: ${resource}`);
}
const manifest = [];
for (const entry of entries) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(entry) || entry.includes('..'))
    throw new Error(`Unsafe file name: ${entry}`);
  const hash = createHash('sha256')
    .update(await readFile(path.join(staging, entry)))
    .digest('hex');
  manifest.push(`${hash}  ${entry}`);
}
await writeFile(
  path.join(staging, 'release.sha256'),
  `${manifest.join('\n')}\n`,
);
await rename(staging, destination);
console.log(
  `Prepared ${releaseId}: ${destination}\n${entries.length} files; no NAS connection or deployment performed.`,
);
