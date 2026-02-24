# Game Hub · 游戏合集

基于 React + Rsbuild 的小游戏与麻将合集 Web 应用。

## 功能

- **麻将**：中国通用麻将、日本立直麻将、四川麻将（血战到底、定缺）
- **小游戏**：2048、贪吃蛇、俄罗斯方块、打砖块、井字棋、记忆翻牌、坦克大战、飞机大战等
- 响应式布局，支持多设备

## 技术栈

- **构建**: Rsbuild v2
- **前端**: React 19 + TypeScript (strict)
- **样式**: Tailwind CSS v4
- **UI**: shadcn/ui
- **代码质量**: Biome (lint + format)、TypeScript (tsc)
- **测试**: Rstest + Testing Library

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发

```bash
pnpm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

### 构建与预览

```bash
pnpm run build    # 生产构建
pnpm run preview  # 本地预览构建结果
```

### 代码质量与测试

```bash
pnpm run check    # 类型检查 + Biome 检查
pnpm run test     # 运行测试
pnpm run format   # 格式化代码
```

## 项目文档

详细说明见 [REPO_WIKI.md](./REPO_WIKI.md)。

## 推送到 GitHub

1. 在 GitHub 新建仓库（如 `game-hub`）。
2. 将 `package.json` 中的 `YOUR_USERNAME` 替换为你的 GitHub 用户名。
3. 执行：

```bash
git remote add origin https://github.com/YOUR_USERNAME/game-hub.git
git branch -M main
git push -u origin main
```

## 参考

- [Rsbuild](https://rsbuild.rs)
- [React](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
