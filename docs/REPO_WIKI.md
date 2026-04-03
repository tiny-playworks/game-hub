# Game Hub 项目 Wiki

## 1. 项目概述

**Game Hub（游戏合集）** 是纯前端 SPA：基于 React + Rsbuild 的小游戏与麻将合集，无后端、无数据库。

### 1.1 功能概览


| 模块    | 说明                                                      |
| ----- | ------------------------------------------------------- |
| 首页与分类 | 4 类入口：小游戏、棋类、扑克、麻将；支持中/英切换（i18n）                        |
| 已上线游戏 | **16 款**：9 小游戏 + 4 棋类（五子棋、中国象棋、国际象棋、围棋）+ 1 麻将（日麻）+ 2 扑克 |
| 占位游戏  | **0 款**（斗地主、升级已上线）                                      |
| 成就    | 14 项（2048/贪吃蛇/俄罗斯方块/打砖块、棋类首胜等），本地解锁                     |
| PWA   | manifest + Service Worker，可安装、离线回退首页                    |


### 1.2 游戏清单

- **小游戏（9）**：猜数字、井字棋、记忆翻牌、2048、贪吃蛇、打砖块、飞机大战、坦克大战、俄罗斯方块  
- **棋类（4）**：五子棋、中国象棋、国际象棋、围棋（9×9 入门）  
- **麻将（1）**：日本立直麻将（和了算分由 riichi-rs-bundlers 提供）  
- **扑克（2）**：斗地主（简化版）、升级（入门）

---

## 2. 技术架构

### 2.1 技术栈


| 层级   | 选型                                                                         |
| ---- | -------------------------------------------------------------------------- |
| 构建   | Rsbuild v2（含 `experiments.asyncWebAssembly` 以支持 WASM）                      |
| 前端   | React 19 + TypeScript (strict)                                             |
| 样式   | Tailwind CSS v4 + PostCSS，shadcn/ui                                        |
| 质量   | Biome（lint + format），tsc                                                   |
| 测试   | Rstest + Testing Library                                                   |
| 日麻算分 | riichi-rs-bundlers（Rust → WASM），符・番・点数与役种；适配层 `src/lib/riichiRsAdapter.ts` |


### 2.2 项目结构

```
src/
├── components/ui/   # shadcn 组件
├── contexts/        # LocaleContext（i18n）
├── data/            # games.ts, categories
├── hooks/           # 各玩法 hooks（含日麻相关）
├── lib/             # 规则与工具：achievements, gomoku, xiangqi, chess, mahjong*, riichiRsAdapter, i18n, utils
├── pages/           # Home, Category, Achievements, Game*（已上线玩法页面）
├── App.tsx          # 路由 + LocaleProvider + Suspense 懒加载
└── App.css          # 主题与 Tailwind @theme

tests/               # 20 文件，123 用例
```

### 2.3 配置与命令

- **路径别名**：`@/` → `src/`
- **常用命令**：`pnpm run dev` / `build` / `preview`；`pnpm run check`（tsc + biome）；`pnpm run test`
- **包体分析**：`pnpm run build:analyze`（依赖 `@rsdoctor/rspack-plugin`，构建后打开 Rsdoctor 分析页；Windows 可用 `cross-env RSDOCTOR=true rsbuild build`）
- **PWA**：`public/manifest.json`、`public/sw.js`；入口注册 SW；Rsbuild `html.tags` 注入

---

## 3. 测试与质量

- **规模**：20 个测试文件，**123 个用例**，全部通过。  
- **覆盖**：数据与工具、首页与分类、成就页、已上线游戏页冒烟、五子棋胜负、日麻流程与算分适配。  
- **运行**：`pnpm run test`；`pnpm run test:watch` 监听。  
- **CI**：typecheck → biome → test → build。

---

## 4. 项目评估

### 4.1 完成度


| 维度    | 状态   | 说明                              |
| ----- | ---- | ------------------------------- |
| 核心玩法  | ✅ 高  | 16 款可玩，规则闭环（含日麻、四棋、两扑克）         |
| 国际化   | ✅ 完成 | 中/英；首页、分类、成就、游戏内通用文案            |
| 成就与统计 | ✅ 完成 | 14 项成就，2048/贪吃蛇/俄罗斯方块/打砖块、棋类首胜等 |
| 性能与体验 | ✅ 良好 | 路由懒加载、PWA、响应式、日麻算分 WASM         |
| 占位补齐  | ✅ 完成 | 斗地主、升级已上线                       |


### 4.2 技术债务与限制

- Rsbuild 2.x beta，大版本升级需关注破坏性变更。  
- 无后端：成就与最高分仅存 localStorage，换设备不同步。  
- 日本麻将和了算分已接入 riichi-rs-bundlers，流局、点数展示、音效与动画已支持；体验可继续打磨（如振听提示等）。

### 4.3 可维护性

- 路由、数据、页面、hooks、lib 分层清晰。  
- 日麻规则集中在 `mahjongRiichi` 等与 `.cursor/skills/mahjong-japanese-riichi`；棋类与其它小游戏各有 lib。**不增加其它麻将规则变种**为当前产品范围。  
- 无单独 `lint` 脚本，统一用 `pnpm run check`。

---

## 5. 开发计划与优先级

**需求排序与主线阶段**以 [PLAN.md](PLAN.md) 为入口，**详细阶段目标**以 [player-meta-roadmap.md](player-meta-roadmap.md) 为准；此处为详表与功能清单。

### 5.1 已完成（归档）


| 项         | 说明                                                                           |
| --------- | ---------------------------------------------------------------------------- |
| 游戏内 i18n  | 各游戏页返回/重开/开始等随语言切换                                                           |
| 国际象棋      | `/game/chess`，规则与将杀/和棋                                                       |
| 更多成就（棋类）  | 2048-1024，五子棋/中国象棋/国际象棋首胜                                                    |
| 路由懒加载     | React.lazy + Suspense，首屏仅加载 Home                                             |
| 日本麻将对局完善  | 流局（荒牌）判定与弹窗、本场+1 连庄                                                          |
| 日麻算分接入    | riichi-rs-bundlers（Rust/WASM），和了时符・番・点数与役种                                   |
| 日麻音效与动画   | 6 个 wav（立直/吃碰杠/自摸/荣和）+ TTS（打牌/摸牌/流局）；摸牌出现、弹窗入场、刚摸牌脉动（见 docs/sound-assets.md） |
| 斗地主・升级    | 斗地主简化版、升级入门上线，占位清零                                                           |
| 围棋入门      | 9×9，落子/提子/打劫/pass，子空合计数目                                                     |
| 包体分析      | `pnpm run build:analyze`（Rsdoctor）                                           |
| 更多成就（小游戏） | 俄罗斯方块消行 10/50/100、打砖块首次通关                                                    |


### 5.2 当前主线（需求排序见 [PLAN.md](PLAN.md)）

- **产品主线**：[player-meta-roadmap.md](player-meta-roadmap.md)（玩家档案 → 成长 → 音频 → 游戏感 → 角色预研 → 雀士 1.0）。
- **麻将范围**：仅 **日本立直麻将**；不排期其他麻将规则变种。
- **远期（不在本 Web 仓库当前迭代）**：**SSR、在线多人**等，若未来独立 App，多在后半阶段再考虑。

### 5.3 功能扩展清单（状态备忘）

- 游戏统计与成就（14 项，本地解锁）— 随成长系统 1.0 演进
- PWA（manifest + SW）
- 国际化（中/英，游戏内通用文案）
- 路由懒加载
- 语音和动画效果（日麻已接入基础层；完整方案见主线「音频系统 1.0」）
- 性能监控与优化（按需）
- 服务端渲染 / 在线多人对战 — **远期 App 向**，见 [PLAN.md](PLAN.md) 范围说明

---

## 6. 参考资源

- [Rsbuild](https://rsbuild.rs) · [React](https://react.dev) · [Tailwind CSS](https://tailwindcss.com) · [shadcn/ui](https://ui.shadcn.com)

---

*最后更新：2026 年 4 月*