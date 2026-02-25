# Game Hub 项目 Wiki

## 1. 项目概述

**Game Hub（游戏合集）** 是纯前端 SPA：基于 React + Rsbuild 的小游戏与麻将合集，无后端、无数据库。

### 1.1 功能概览

| 模块 | 说明 |
|------|------|
| 首页与分类 | 4 类入口：小游戏、棋类、扑克、麻将；支持中/英切换（i18n） |
| 已上线游戏 | **16 款**：9 小游戏 + 4 棋类（五子棋、中国象棋、国际象棋、围棋）+ 3 麻将 |
| 占位游戏 | **2 款**：斗地主、升级 |
| 成就 | 14 项（2048/贪吃蛇/俄罗斯方块/打砖块、棋类首胜等），本地解锁 |
| PWA | manifest + Service Worker，可安装、离线回退首页 |

### 1.2 游戏清单

- **小游戏（9）**：猜数字、井字棋、记忆翻牌、2048、贪吃蛇、打砖块、飞机大战、坦克大战、俄罗斯方块  
- **棋类（4）**：五子棋、中国象棋、国际象棋、围棋（9×9 入门）  
- **麻将（3）**：四川麻将、中国通用麻将、日本麻将  
- **占位（2）**：斗地主、升级  

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 选型 |
|------|------|
| 构建 | Rsbuild v2 |
| 前端 | React 19 + TypeScript (strict) |
| 样式 | Tailwind CSS v4 + PostCSS，shadcn/ui |
| 质量 | Biome（lint + format），tsc |
| 测试 | Rstest + Testing Library |

### 2.2 项目结构

```
src/
├── components/ui/   # shadcn 组件
├── contexts/        # LocaleContext（i18n）
├── data/            # games.ts, categories
├── hooks/           # useMahjongGame, useSichuanMahjongGame
├── lib/             # 规则与工具：achievements, gomoku, xiangqi, chess, mahjong*, i18n, utils
├── pages/           # Home, Category, Achievements, Game*（15 个游戏页）
├── App.tsx          # 路由 + LocaleProvider + Suspense 懒加载
└── App.css          # 主题与 Tailwind @theme

tests/               # 7 文件，58 用例
```

### 2.3 配置与命令

- **路径别名**：`@/` → `src/`
- **常用命令**：`pnpm run dev` / `build` / `preview`；`pnpm run check`（tsc + biome）；`pnpm run test`
- **包体分析**：`pnpm run build:analyze`（依赖 `@rsdoctor/rspack-plugin`，构建后打开 Rsdoctor 分析页；Windows 可用 `cross-env RSDOCTOR=true rsbuild build`）
- **PWA**：`public/manifest.json`、`public/sw.js`；入口注册 SW；Rsbuild `html.tags` 注入

---

## 3. 测试与质量

- **规模**：7 个测试文件，**58 个用例**，全部通过。  
- **覆盖**：数据与工具、首页与分类、成就页、15 个游戏页冒烟、五子棋胜负、麻将规则（国标/川麻/日麻）。  
- **运行**：`pnpm run test`；`pnpm run test:watch` 监听。  
- **CI**：typecheck → biome → test → build。

---

## 4. 项目评估

### 4.1 完成度

| 维度 | 状态 | 说明 |
|------|------|------|
| 核心玩法 | ✅ 高 | 15 款可玩，规则闭环（含三种麻将、三棋） |
| 国际化 | ✅ 完成 | 中/英；首页、分类、成就、游戏内通用文案 |
| 成就与统计 | ✅ 完成 | 14 项成就，2048/贪吃蛇/俄罗斯方块/打砖块、棋类首胜等 |
| 性能与体验 | ✅ 良好 | 路由懒加载、PWA、响应式 |
| 占位补齐 | ⏳ 进行中 | 4 款占位，可择一迭代 |

### 4.2 技术债务与限制

- Rsbuild 2.x beta，大版本升级需关注破坏性变更。  
- 无后端：成就与最高分仅存 localStorage，换设备不同步。  
- 日本麻将对局与规则页并存，对局体验可继续打磨。  

### 4.3 可维护性

- 路由、数据、页面、hooks、lib 分层清晰。  
- 麻将/棋类规则有独立 lib 与 `.cursor/skills`，便于扩展与 AI 辅助。  
- 无单独 `lint` 脚本，统一用 `pnpm run check`。

---

## 5. 开发计划与优先级

### 5.1 已完成（归档）

| 项 | 说明 |
|----|------|
| 游戏内 i18n | 各游戏页返回/重开/开始等随语言切换 |
| 国际象棋 | `/game/chess`，规则与将杀/和棋 |
| 更多成就 | 2048-1024，五子棋/中国象棋/国际象棋首胜 |
| 路由懒加载 | React.lazy + Suspense，首屏仅加载 Home |
| 日本麻将对局完善 | 流局（荒牌）判定与弹窗、本场+1 连庄；描述更新为对局已可玩 |
| 围棋入门 | 9×9 棋盘，落子/提子/打劫/pass，双方 pass 终局，子空合计数目 |
| 包体分析 | `build:analyze` 脚本（Rsdoctor），按需分析 chunk 与首屏体积 |
| 更多成就 | 俄罗斯方块消行 10/50/100、打砖块首次通关 |

### 5.2 新优先级（未做项重排）

| 优先级 | 项 | 说明 | 预估 |
|--------|----|------|------|
| **P1** | 再上 1 款占位游戏 | 围棋 9×9 入门已上线（落子/提子/打劫/pass/数目） | ✅ |
| **P2** | 日本麻将对局完善 | 流局（荒牌）判定与弹窗、描述更新为对局已可玩 | ✅ |
| **P3** | 包体与首屏分析 | `pnpm run build:analyze` 使用 Rsdoctor 分析包体 | ✅ |
| **P4** | 更多成就 / 统计 | 俄罗斯方块消行 10/50/100、打砖块首次通关 | ✅ |
| **P5** | 麻将变种 / 语音与动画 | 按需在具体游戏上加 | 按需 |
| **P6** | 在线多人 / SSR | 需后端与架构，单独排期 | 大 |

### 5.3 功能扩展清单（勾选状态）

- [x] 游戏统计与成就（14 项，本地解锁）
- [x] PWA（manifest + SW）
- [x] 国际化（中/英，游戏内通用文案）
- [x] 路由懒加载
- [ ] 更多麻将变种规则
- [ ] 语音和动画效果
- [ ] 性能监控与优化
- [ ] 服务端渲染
- [ ] 实现在线多人对战

---

## 6. 参考资源

- [Rsbuild](https://rsbuild.rs) · [React](https://react.dev) · [Tailwind CSS](https://tailwindcss.com) · [shadcn/ui](https://ui.shadcn.com)

---
*最后更新：2026 年 2 月*
