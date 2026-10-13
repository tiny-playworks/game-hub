import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('.', import.meta.url));

await build({
  entryPoints: {
    index: `${root}/src/index.ts`,
    member: `${root}/src/cli/member.ts`,
    'riichi-gate': `${root}/src/riichi/gate.ts`,
  },
  outdir: `${root}/dist`,
  outExtension: { '.js': '.mjs' },
  platform: 'node',
  target: 'node24',
  format: 'esm',
  bundle: true,
  packages: 'external',
  tsconfig: `${root}/tsconfig.json`,
  logLevel: 'info',
});
