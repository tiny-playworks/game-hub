#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(ROOT, 'output', 'gpt-raw');
const REGISTRY_PATH = path.join(ROOT, 'src', 'assets', 'gptAssets.ts');

const FFMPEG_CANDIDATES = [
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  'ffmpeg',
];
const CWEBP_CANDIDATES = [
  '/opt/homebrew/bin/cwebp',
  '/usr/local/bin/cwebp',
  'cwebp',
];

function resolveBinary(candidates) {
  for (const bin of candidates) {
    try {
      execFileSync(bin, ['-version'], { stdio: 'ignore' });
      return bin;
    } catch {
      // try next
    }
  }
  return null;
}

function encodeWebp(ffmpeg, cwebp, inputPath, outputPath, filter) {
  if (cwebp) {
    // Some FFmpeg distributions omit libwebp. Use the dedicated encoder after
    // FFmpeg performs the shared crop/resize, without a lossy intermediate.
    const png = execFileSync(
      ffmpeg,
      [
        '-v', 'error', '-i', inputPath, '-vf', filter, '-frames:v', '1',
        '-f', 'image2pipe', '-c:v', 'png', 'pipe:1',
      ],
      { maxBuffer: 32 * 1024 * 1024 },
    );
    const tempDir = fs.mkdtempSync(path.join(RAW_DIR, '.webp-'));
    const tempPng = path.join(tempDir, 'resized.png');
    try {
      fs.writeFileSync(tempPng, png);
      execFileSync(
        cwebp,
        [
          '-quiet', '-q', '82', '-m', '6', '-metadata', 'none', tempPng,
          '-o', outputPath,
        ],
        { stdio: 'ignore' },
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    return;
  }

  execFileSync(
    ffmpeg,
    [
      '-y', '-i', inputPath, '-vf', filter, '-c:v', 'libwebp', '-quality', '86',
      outputPath,
    ],
    { stdio: 'ignore' },
  );
}

const SINGLE_SPECS = [
  {
    key: 'tsubaki',
    category: 'story',
    rawNames: ['tsubaki-story'],
    outRel: 'src/assets/stories/tsubaki.webp',
    width: 1280,
    height: 720,
  },
  {
    key: 'home',
    category: 'banner',
    rawNames: ['banner-home'],
    outRel: 'src/assets/venue/banners/banner-home.webp',
    width: 1600,
    height: 500,
  },
  {
    key: 'journey',
    category: 'banner',
    rawNames: ['banner-journey'],
    outRel: 'src/assets/venue/banners/banner-journey.webp',
    width: 1600,
    height: 500,
  },
  {
    key: 'family',
    category: 'banner',
    rawNames: ['banner-family'],
    outRel: 'src/assets/venue/banners/banner-family.webp',
    width: 1600,
    height: 500,
  },
  {
    key: 'leaderboard',
    category: 'banner',
    rawNames: ['banner-leaderboard'],
    outRel: 'src/assets/venue/banners/banner-leaderboard.webp',
    width: 1600,
    height: 500,
  },
];

const ARCADE_GRIDS = [
  {
    rawBase: 'arcade-grid-1',
    quadrants: ['guess-number', 'tictactoe', 'memory', '2048'],
  },
  {
    rawBase: 'arcade-grid-2',
    quadrants: ['snake', 'breakout', 'shooter', 'tank'],
  },
  {
    rawBase: 'arcade-grid-3',
    quadrants: ['tetris', 'rubiks', 'gomoku', 'go'],
  },
  {
    rawBase: 'arcade-grid-4',
    quadrants: ['chess', 'xiangqi', 'doudizhu', 'shengji'],
  },
];

const TEXTURE_GRID = {
  rawBase: 'textures-grid',
  quadrants: ['washi-paper', 'kaya-wood', 'urushi-lacquer', 'card-baize'],
};

const ALL_ARCADE_IDS = ARCADE_GRIDS.flatMap((g) => g.quadrants);
const ALL_TEXTURE_IDS = TEXTURE_GRID.quadrants;

function findRawFile(baseNames) {
  if (!fs.existsSync(RAW_DIR)) return null;
  const entries = fs.readdirSync(RAW_DIR);
  const exts = ['.png', '.webp', '.jpg', '.jpeg'];
  for (const base of baseNames) {
    for (const ext of exts) {
      const match = entries.find(
        (name) => name.toLowerCase() === `${base.toLowerCase()}${ext}`,
      );
      if (match) return path.join(RAW_DIR, match);
    }
  }
  return null;
}

function convertSingle(ffmpeg, cwebp, inputPath, outputPath, width, height) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  encodeWebp(ffmpeg, cwebp, inputPath, outputPath, filter);
}

function convertQuadrant(
  ffmpeg,
  cwebp,
  inputPath,
  outputPath,
  quadrantIndex,
  size = 512,
) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  // Trim 2% around each quadrant border to avoid GPT grid divider lines
  const col = quadrantIndex % 2;
  const row = Math.floor(quadrantIndex / 2);
  const xExpr = col === 0 ? 'iw*0.02' : 'iw*0.52';
  const yExpr = row === 0 ? 'ih*0.02' : 'ih*0.52';
  const filter = `crop=iw*0.46:ih*0.46:${xExpr}:${yExpr},scale=${size}:${size}`;
  encodeWebp(ffmpeg, cwebp, inputPath, outputPath, filter);
}

function syncRegistry() {
  const imports = [];
  const stories = [];
  const banners = [];
  const textures = [];
  const covers = [];
  let idx = 0;

  for (const spec of SINGLE_SPECS) {
    const abs = path.join(ROOT, spec.outRel);
    if (fs.existsSync(abs)) {
      const varName = `asset_${idx++}`;
      const relImport = `./${path.relative(path.join(ROOT, 'src/assets'), abs).replace(/\\/g, '/')}`;
      imports.push(`import ${varName} from '${relImport}';`);
      if (spec.category === 'story') {
        stories.push(`  '${spec.key}': ${varName},`);
      } else if (spec.category === 'banner') {
        banners.push(`  '${spec.key}': ${varName},`);
      }
    }
  }

  for (const texId of ALL_TEXTURE_IDS) {
    const outRel = `src/assets/venue/textures/${texId}.webp`;
    const abs = path.join(ROOT, outRel);
    if (fs.existsSync(abs)) {
      const varName = `asset_${idx++}`;
      const relImport = `./venue/textures/${texId}.webp`;
      imports.push(`import ${varName} from '${relImport}';`);
      textures.push(`  '${texId}': ${varName},`);
    }
  }

  for (const gameId of ALL_ARCADE_IDS) {
    const outRel = `src/assets/arcade/covers/${gameId}.webp`;
    const abs = path.join(ROOT, outRel);
    if (fs.existsSync(abs)) {
      const varName = `asset_${idx++}`;
      const relImport = `./arcade/covers/${gameId}.webp`;
      imports.push(`import ${varName} from '${relImport}';`);
      covers.push(`  '${gameId}': ${varName},`);
    }
  }

  const content = [
    '/**',
    ' * Auto-maintained by `pnpm assets:gpt` (scripts/process-gpt-assets.mjs).',
    ' * When GPT-generated WebP assets are placed into `output/gpt-raw/` and processed,',
    ' * this registry automatically binds their static bundle URLs.',
    ' */',
    ...(imports.length ? ['', ...imports] : []),
    '',
    'export const GPT_STORY_ASSETS: Partial<Record<string, string>> = {',
    ...stories,
    '};',
    '',
    'export const GPT_BANNER_ASSETS: Partial<',
    "  Record<'home' | 'journey' | 'family' | 'leaderboard', string>",
    '> = {',
    ...banners,
    '};',
    '',
    'export const GPT_TEXTURE_ASSETS: Partial<',
    "  Record<'washi-paper' | 'kaya-wood' | 'urushi-lacquer' | 'card-baize', string>",
    '> = {',
    ...textures,
    '};',
    '',
    'export const GPT_ARCADE_COVERS: Partial<Record<string, string>> = {',
    ...covers,
    '};',
    '',
  ].join('\n');

  fs.writeFileSync(REGISTRY_PATH, content, 'utf8');
}

function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const statusOnly = process.argv.includes('--status');
  const ffmpeg = resolveBinary(FFMPEG_CANDIDATES);
  const cwebp = resolveBinary(CWEBP_CANDIDATES);

  if (!statusOnly && ffmpeg) {
    // 1. Single specs
    for (const spec of SINGLE_SPECS) {
      const raw = findRawFile(spec.rawNames);
      if (raw) {
        convertSingle(
          ffmpeg,
          cwebp,
          raw,
          path.join(ROOT, spec.outRel),
          spec.width,
          spec.height,
        );
        console.log(`[OK] Processed ${spec.outRel} from ${path.basename(raw)}`);
      }
    }

    // 2. Arcade 2x2 grids & individual cover-<gameId> overrides
    for (const grid of ARCADE_GRIDS) {
      const rawGrid = findRawFile([grid.rawBase]);
      if (rawGrid) {
        grid.quadrants.forEach((gameId, i) => {
          const outRel = `src/assets/arcade/covers/${gameId}.webp`;
          convertQuadrant(ffmpeg, cwebp, rawGrid, path.join(ROOT, outRel), i, 512);
          console.log(
            `[OK] Sliced ${outRel} (Q${i + 1} of ${path.basename(rawGrid)})`,
          );
        });
      }
    }
    for (const gameId of ALL_ARCADE_IDS) {
      const rawSingle = findRawFile([`cover-${gameId}`, gameId]);
      if (rawSingle) {
        const outRel = `src/assets/arcade/covers/${gameId}.webp`;
        convertSingle(ffmpeg, cwebp, rawSingle, path.join(ROOT, outRel), 512, 512);
        console.log(
          `[OK] Processed ${outRel} from ${path.basename(rawSingle)}`,
        );
      }
    }

    // 3. Textures 2x2 grid & individual texture-<id> overrides
    const rawTexGrid = findRawFile([TEXTURE_GRID.rawBase]);
    if (rawTexGrid) {
      TEXTURE_GRID.quadrants.forEach((texId, i) => {
        const outRel = `src/assets/venue/textures/${texId}.webp`;
        convertQuadrant(ffmpeg, cwebp, rawTexGrid, path.join(ROOT, outRel), i, 512);
        console.log(
          `[OK] Sliced ${outRel} (Q${i + 1} of ${path.basename(rawTexGrid)})`,
        );
      });
    }
    for (const texId of ALL_TEXTURE_IDS) {
      const rawSingle = findRawFile([`texture-${texId}`, texId]);
      if (rawSingle) {
        const outRel = `src/assets/venue/textures/${texId}.webp`;
        convertSingle(ffmpeg, cwebp, rawSingle, path.join(ROOT, outRel), 512, 512);
        console.log(
          `[OK] Processed ${outRel} from ${path.basename(rawSingle)}`,
        );
      }
    }

    syncRegistry();
  }

  console.log('\n=== GPT Asset Pipeline Status ===');
  console.log(`Raw drop folder: ${RAW_DIR}`);
  for (const spec of SINGLE_SPECS) {
    const ready = fs.existsSync(path.join(ROOT, spec.outRel));
    console.log(
      `  [${ready ? 'READY' : 'PENDING'}] ${spec.outRel}  (raw: ${spec.rawNames[0]}.png)`,
    );
  }
  const readyCovers = ALL_ARCADE_IDS.filter((id) =>
    fs.existsSync(path.join(ROOT, `src/assets/arcade/covers/${id}.webp`)),
  );
  console.log(
    `  [${readyCovers.length}/16 READY] Arcade Covers (raw: arcade-grid-1..4.png or cover-<id>.png)`,
  );
  const readyTextures = ALL_TEXTURE_IDS.filter((id) =>
    fs.existsSync(path.join(ROOT, `src/assets/venue/textures/${id}.webp`)),
  );
  console.log(
    `  [${readyTextures.length}/4 READY] Salon Textures (raw: textures-grid.png or texture-<id>.png)`,
  );
}

main();
