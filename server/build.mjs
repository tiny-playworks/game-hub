import { build } from 'esbuild';

await build({
  entryPoints: {
    index: 'src/index.ts',
    member: 'src/cli/member.ts',
    'riichi-gate': 'src/riichi/gate.ts',
  },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  platform: 'node',
  target: 'node24',
  format: 'esm',
  bundle: true,
  packages: 'external',
  tsconfig: 'tsconfig.json',
  logLevel: 'info',
});
