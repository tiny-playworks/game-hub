import { withRsbuildConfig } from '@rstest/adapter-rsbuild';
import { defineConfig } from '@rstest/core';

// Docs: https://rstest.rs/config/
export default defineConfig({
  extends: withRsbuildConfig(),
  setupFiles: ['./tests/rstest.setup.ts'],
  coverage: {
    provider: 'istanbul',
    include: ['src/lib/**/*.ts', 'src/pages/mahjong/japanese/**/*.{ts,tsx}'],
    reporters: ['text-summary', 'html'],
  },
});
