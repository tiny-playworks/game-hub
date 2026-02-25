# AGENTS.md

Game Hub（游戏合集）：基于 Rsbuild + React 的纯前端 SPA，**16 款已上线游戏** + **2 款占位**（斗地主、升级）。

## Commands

- `pnpm run dev` - 启动开发服务器
- `pnpm run build` - 生产构建
- `pnpm run preview` - 本地预览构建结果
- `pnpm run check` - 类型检查 (tsc) + Biome 检查（无单独 lint 脚本）
- `pnpm run test` - 运行测试（7 文件、58 用例）

## Docs

- Rsbuild: https://rsbuild.rs/llms.txt
- Rspack: https://rspack.rs/llms.txt
- Rstest: https://rstest.rs/llms.txt

## Tools

- **Rstest**: `pnpm run test` / `pnpm run test:watch`
- **Biome**: 使用 `pnpm run check`（含 tsc + biome）；`pnpm run format` 仅格式化

## Cursor Cloud

- 纯前端 SPA，无后端、无数据库。
- 开发：`pnpm run dev --no-open`，端口 3000，HMR。
- `pnpm run check` 会依次执行 tsc 与 biome check。
- Node ≥ 18；`pnpm install` 中 core-js 构建告警可忽略。

## 计划与优先级

完整开发计划与优先级见 [REPO_WIKI.md#开发计划与优先级](./REPO_WIKI.md#5-开发计划与优先级)。当前下一优先级：P1 再上 1 款占位游戏（斗地主或升级）。包体分析：`pnpm run build:analyze`（Rsdoctor）。
