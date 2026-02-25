# AGENTS.md

Game Hub（游戏合集）项目：基于 Rsbuild + React 的小游戏与麻将 Web 应用。

## Commands

- `pnpm run dev` - 启动开发服务器
- `pnpm run build` - 生产构建
- `pnpm run preview` - 本地预览构建结果
- `pnpm run check` - 类型检查 (tsc) + Biome 检查
- `pnpm run test` - 运行测试

## Docs

- Rsbuild: https://rsbuild.rs/llms.txt
- Rspack: https://rspack.rs/llms.txt

- Rstest: https://rstest.rs/llms.txt

## Tools

### Rstest

- Run `pnpm run test` to run tests
- Run `pnpm run test:watch` to run tests in watch mode

### Biome

- Lint/check: use `pnpm run check` (runs tsc + biome check). There is no separate `lint` script.
- Format: `pnpm run format` to format your code

## Cursor Cloud specific instructions

- This is a pure frontend SPA — no backend, no database, no external services needed.
- Dev server: `pnpm run dev --no-open` starts on port 3000 with HMR. Use `--no-open` in headless/cloud environments.
- `pnpm run check` runs both `tsc --noEmit` and `biome check --write` in sequence.
- The `pnpm install` warning about `core-js` build scripts can be safely ignored (use `pnpm approve-builds` only interactively; the lockfile works fine without it).
- Node.js ≥ 18 required; project has no `.nvmrc` — system default Node works.
