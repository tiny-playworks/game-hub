# 项目仓库 Wiki 文档

## 📋 项目概述

**Game Hub（游戏合集）** 是一个纯前端 SPA，基于 React + Rsbuild 的小游戏与麻将合集，无后端、无数据库、无外部服务依赖。

### 🎯 核心功能
- **首页与分类**：4 个分类（小游戏、棋类、扑克、麻将），按分类进入游戏列表，支持难度与标签展示。
- **已上线游戏（13 款）**  
  - **小游戏（9 款）**：猜数字、井字棋、记忆翻牌、2048、贪吃蛇、打砖块、飞机大战、坦克大战、俄罗斯方块  
  - **棋类（1 款）**：五子棋（双人轮流、五子连珠即胜）  
  - **麻将（3 款）**：四川麻将（血战到底、定缺）、中国通用麻将（国标番种）、日本立直麻将（役种、符点）
- **占位/开发中（7 款）**：围棋、中国象棋、国际象棋、斗地主、升级等，在列表中展示「开发中」。
- 响应式布局，支持多设备。

## 🔧 技术架构

### 核心技术栈
- **构建工具**: Rsbuild v2
- **前端框架**: React 19 + TypeScript (strict mode)
- **样式方案**: Tailwind CSS v4 + PostCSS
- **UI组件库**: shadcn/ui
- **代码质量**: Biome (lint + format)
- **测试框架**: Rstest + Testing Library

### 项目结构
```
src/
├── components/ui/      # shadcn/ui 组件（button、card、input）
├── data/               # 游戏与分类配置（games.ts、categories.ts）
├── hooks/              # 麻将对局状态（useMahjongGame、useSichuanMahjongGame）
├── contexts/           # React 上下文（LocaleContext：i18n）
├── lib/                # 核心逻辑（mahjong、mahjongRiichi、mahjongSichuan、gomoku、i18n、utils）
├── pages/              # 页面与 12 个游戏页 + Home、Category
├── App.tsx             # 路由入口
└── App.css             # 主题变量与 Tailwind @theme

tests/
├── index.test.tsx          # 首页渲染与分类链接
├── data-games.test.ts     # games 数据与 getGamesByCategory / getGameByPath
├── lib-utils.test.ts      # cn() 工具
├── pages-games.test.tsx   # 13 个游戏页冒烟（每游戏至少 1 用例）
├── mahjong-rules.test.ts  # 国标番种、川麻七对/龙七对/定缺/杠牌、日麻赤宝牌/符/平和
├── sichuan-mahjong.test.ts # 川麻牌堆、发牌、定缺、番数
└── gomoku.test.ts         # 五子棋胜负判定（横/竖/斜五连、四连无胜）
```

## 🎮 游戏模块

### 麻将游戏系统

#### 中文麻将 (GameMahjongChinese)
- 实现标准国标麻将规则
- 支持吃、碰、杠、胡等基本操作
- 完整的计分系统

#### 四川麻将 (GameMahjongSichuan)
- 血战到底、刮风下雨
- 定缺、108 张（万/条/筒），无字牌
- 七对、龙七对、番型计分

#### 日式立直麻将 (GameMahjongJapanese)
- 实现日本立直麻将规则
- 支持立直宣告机制
- 完整的役种判定系统
- 宝牌和里宝牌机制

### 核心算法库

#### mahjong.ts - 中文麻将核心逻辑
- 胡牌判定算法
- 牌型组合验证
- 计分规则实现

#### mahjongRiichi.ts - 日式麻将核心逻辑
- 立直规则实现
- 役种判定系统
- 宝牌计算逻辑

#### mahjongSichuan.ts - 四川麻将核心逻辑
- 108 张牌堆、定缺、七对/龙七对胡牌判定
- 番型与杠牌计分

## 🚀 最近改进记录

### 2024年最新改进 (February 2024)

#### 1. 核心算法优化
- ✅ **优先级处理修复**: 修正了杠>碰>吃的操作优先级顺序
- ✅ **胡牌判定增强**: 改进了基础牌型验证算法，增加了过轮检测
- ✅ **杠牌机制完善**: 实现了完整的补牌逻辑和计分规则

#### 2. 日式麻将功能增强
- ✅ **役种系统扩展**: 添加了多个重要役种
  - 三色同顺 (三色同顺)
  - 三色同刻 (三色同刻) 
  - 三杠子 (三杠子)
  - 四暗刻 (四暗刻)
  - 四连刻 (四连刻)
  - 一气通贯 (一气通贯)
- ✅ **立直机制实现**: 完整的立直宣告和相关逻辑
- ✅ **AI决策优化**: 增强了AI的策略性和智能程度

#### 3. 用户体验改进
- ✅ **界面现代化**: 全新的视觉设计和交互体验
- ✅ **新手引导系统**: 添加了详细的游戏教程和指引
- ✅ **状态提示优化**: 更直观的操作反馈和状态显示
- ✅ **响应式设计**: 适配不同屏幕尺寸的显示效果

#### 4. 代码质量提升
- ✅ **代码清理**: 删除了废弃的 `canFormFourMelds` 和 `isSequence` 函数
- ✅ **性能优化**: 替换了效率更高的算法实现
- ✅ **类型安全**: 完善了TypeScript类型定义
- ✅ **可维护性**: 改善了代码结构和注释

### 技术细节更新

#### 算法改进
```typescript
// 旧的递归算法（已删除）
function canFormFourMelds(arr: number[]): boolean {
  // 效率较低的暴力递归实现
}

// 新的优化算法
function canFormFourMeldsOptimized(arr: number[]): boolean {
  // 基于回溯的高效实现
  return backtrack(0, 0);
}
```

#### 功能增强
- 添加了振听状态检测
- 实现了更精确的手牌安全性评估
- 完善了听牌状态分析
- 增强了AI的风险管理能力

## 🧪 测试覆盖

- **规模**：7 个测试文件，共 54 个用例，全部通过。
- **类型**  
  - **数据与工具**：`games` 列表与 `getGamesByCategory` / `getGameByPath`；`cn()` 合并与 tailwind-merge 行为。  
  - **入口与导航**：首页渲染「游戏合集」与分类链接（小游戏、麻将等）。  
  - **游戏页冒烟**：13 个已上线游戏各至少 1 个用例（渲染标题/按钮/关键文案）。  
  - **五子棋规则**：`tests/gomoku.test.ts` 覆盖空盘、横/竖/斜五连胜、四连无胜。  
  - **麻将规则**：国标番种（屁胡/对对胡/清一色等）、川麻七对/龙七对/定缺/杠牌计分、日麻赤宝牌/符数/平和判定。
- **运行**：`pnpm run test`；监听模式 `pnpm run test:watch`。  
- **CI**：每次 push/PR 自动执行 typecheck → biome check → test → build。

## 📐 项目现状与评估

### 技术栈与工程化
| 方面 | 状态 | 说明 |
|------|------|------|
| 构建 | ✅ | Rsbuild v2（beta），路径别名 `@/` → `src/`，historyFallback |
| 前端 | ✅ | React 19 + TypeScript strict，44+ 文件类型检查通过 |
| 样式 | ✅ | Tailwind v4 + PostCSS，shadcn/ui，主题在 App.css |
| 质量 | ✅ | Biome（lint + format，单引号、organizeImports） |
| 测试 | ✅ | Rstest + Testing Library，54 用例覆盖数据/工具/首页/13 游戏页/麻将规则/五子棋规则 |
| CI | ✅ | GitHub Actions：Node 20、pnpm、typecheck、biome、test、build |

### 构建与体积
- 生产构建通过，产物约 460 KB（gzip 约 137 KB），含 React、React Router、业务与游戏页。

### 架构与可维护性
- 路由、数据、页面、hooks、lib 分层清晰；三种麻将规则对应独立 lib 与技能文档（`.cursor/skills`），便于扩展与 AI 辅助。
- 无单独 `lint` 脚本，日常质量检查统一用 `pnpm run check`（tsc + biome）。

### 已知限制与注意
- Rsbuild 当前为 2.0.0-beta.x，大版本升级时需关注破坏性变更。
- 棋类/扑克等占位游戏尚未实现，仅列表展示「开发中」。

## 📊 开发工作流

### 常用命令
```bash
# 开发环境
pnpm run dev          # 启动开发服务器
pnpm run build        # 生产构建
pnpm run preview      # 本地预览生产版本

# 代码质量（提交前建议执行）
pnpm run check        # 类型检查 (tsc) + Biome 检查，一键跑完
pnpm run format       # 仅格式化代码（check 已含 --write 时可略过）

# 测试
pnpm run test         # 运行测试
pnpm run test:watch   # 监听模式测试
```

### 开发规范
- 遵循Biome代码规范
- 使用TypeScript严格模式
- 组件采用函数式编程
- 路径别名使用 `@/` 前缀

## 🔧 配置说明

### 构建配置
- **Rsbuild配置**: `rsbuild.config.ts`（含 `html.tags` 注入 manifest 链接）
- **TypeScript配置**: `tsconfig.json`
- **样式配置**: `postcss.config.mjs`
- **代码检查**: `biome.json`
- **PWA**: `public/manifest.json`、`public/sw.js`，构建时复制到 dist；入口注册 SW

### 路径别名
```
@/ -> src/
@example: import { Button } from '@/components/ui/button'
```

## 🎯 未来规划

### 功能扩展
- [ ] 添加更多麻将变种规则
- [ ] 实现在线多人对战功能
- [ ] 增加游戏统计数据和成就系统
- [ ] 添加语音和动画效果

### 技术优化
- [x] **PWA**：已集成 `manifest.json`（名称、start_url、display: standalone）与 Service Worker（离线回退到缓存首页）
- [ ] 性能监控和优化
- [ ] 服务端渲染支持
- [x] **国际化（i18n）**：中/英切换，Locale 存 localStorage；首页与分类页文案已抽离（`src/lib/i18n.ts`、`LocaleContext`），头部提供「中 | En」切换

## 📚 参考资源

- [Rsbuild官方文档](https://rsbuild.rs)
- [React 19文档](https://react.dev)
- [TypeScript手册](https://www.typescriptlang.org)
- [Tailwind CSS文档](https://tailwindcss.com)
- [shadcn/ui组件库](https://ui.shadcn.com)

---
*最后更新: 2026年2月*
*版本: v1.0.0*