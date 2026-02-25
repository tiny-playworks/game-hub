# Game Hub · 游戏合集

基于 React + Rsbuild 的小游戏与麻将合集 Web 应用（纯前端 SPA）。

## 功能

- **小游戏**：猜数字、井字棋、记忆翻牌、2048、贪吃蛇、打砖块、飞机大战、坦克大战、俄罗斯方块
- **棋类**：五子棋、中国象棋、国际象棋、围棋（9×9）
- **麻将**：四川麻将、中国通用麻将、日本立直麻将
- **其他**：中/英切换、成就页（14 项）、PWA、响应式布局

## 技术栈

- **构建**: Rsbuild v2
- **前端**: React 19 + TypeScript (strict)
- **样式**: Tailwind CSS v4
- **UI**: shadcn/ui
- **质量**: Biome、TypeScript
- **测试**: Rstest + Testing Library

## 快速开始

```bash
pnpm install
pnpm run dev      # 开发，默认 http://localhost:3000
pnpm run build    # 生产构建
pnpm run build:analyze  # 构建并打开包体分析（Rsdoctor）
pnpm run preview  # 预览构建结果
pnpm run check    # 类型检查 + Biome（提交前建议执行）
pnpm run test     # 测试（7 文件、58 用例）
pnpm run format   # 格式化
```

## 文档与计划

- **详细说明与评估**：[REPO_WIKI.md](./REPO_WIKI.md)（项目结构、测试覆盖、现状评估）
- **开发计划与优先级**：见 [REPO_WIKI.md#开发计划与优先级](./REPO_WIKI.md#5-开发计划与优先级)

## 参考

- [Rsbuild](https://rsbuild.rs) · [React](https://react.dev) · [Tailwind CSS](https://tailwindcss.com) · [shadcn/ui](https://ui.shadcn.com)
