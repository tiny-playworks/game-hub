# Game Hub · 设计规范（Stitch 交接稿）

> **用途**：交给 Google Stitch 做 UI 探索、视觉升级与关键页面重设计。  
> **仓库**：`game-hub`（纯前端 SPA）  
> **线上预览**：https://game-hub-sage-nine.vercel.app  
> **技术约束**：React 19 + Tailwind v4 + shadcn/ui；设计需可落地为 Web 组件，非原生 App。

---

## 1. 产品一句话

**Game Hub** 是一个「进来就能玩」的轻量游戏大厅：以**日本立直麻将**为核心主线，辅以 15 款小游戏 / 棋类 / 扑克；强调**本地身份感、成长反馈、继续游玩**，而非账号登录或重度社交。

### 1.1 设计要传达的感受

| 关键词 | 含义 |
| --- | --- |
| **大厅感** | 像进一间安静、精致的牌馆 + 游戏角，不是应用商店列表 |
| **可信赖** | 规则完整、状态清晰，尤其日麻——不花哨到影响读牌 |
| **轻成长** | 签到、任务、成就、称号、雀士角色——有反馈但不逼氪 |
| **即开即玩** | 首页主 CTA 永远是「回到牌桌 / 开一局」 |
| **双语友好** | 中文为主、英文完整；布局需容纳中英文案长度差 |

### 1.2 目标用户

- 想随手打几局日麻、或打发碎片时间的休闲玩家
- 已熟悉雀魂 / 天凤规则、希望浏览器即玩的用户
- 次要：想试小游戏、棋类、扑克的合集访客

### 1.3 不在本轮设计范围

- 真实账号 / 登录 / 云同步
- 在线多人、排位、观战
- 川麻、国标等其他麻将变种
- 独立原生 App 壳（当前仅 Web + PWA）

---

## 2. 信息架构

```
首页 Home（大厅）
├── 玩家卡 / 继续游玩（日麻）
├── 每日任务 / 成长动态 / 雀士预览
├── 日麻主牌桌 Hero
└── 游戏货架（小游戏 / 棋类 / 扑克入口）

分类页 Category（/category/:id）
└── 该分类下游戏列表卡片

档案页 Profile（/profile）
└── 昵称、头像、称号、音量、语言、签到、角色、统计

成就页 Achievements（/achievements）
└── 成就列表 + 成长点摘要

游戏页 Game（/game/:id）
├── 日麻：规则 → 对局（独立主题系统）
└── 其他：各玩法自包含 header + 游戏区
```

**路由无全局顶栏**：各页面自行实现 header；语言切换目前出现在首页快捷区、档案页、分类页。

---

## 3. 设计原则（给 Stitch 的硬约束）

1. **日麻优先**：首页视觉重心、主 CTA、继续游玩链路都围绕日麻；其他游戏是「货架」。
2. **玻璃态 + 克制用色**：大厅用浅色玻璃卡片 + 翠绿点缀；避免大面积高饱和渐变（小游戏 Canvas 区除外）。
3. **圆角统一偏大**：卡片 `24–32px`，按钮 `full` 或 `lg`；当前品牌感来自大圆角而非锐角。
4. **动效有意义**：入场 `fade + slide-up`、卡片 `hover lift`、日麻 `摸牌 / 弹窗 / 决策高亮`；避免无意义循环闪烁。
5. **移动端一手可达**：日麻、俄罗斯方块、贪吃蛇等有虚拟摇杆或底部操作区；关键按钮最小触控区 **44×44px**。
6. **暗色模式成对设计**：大厅、档案、成就需 light / dark 两套；日麻用独立 `data-riichi-theme` 三套牌桌色。
7. **文案可扩展**：按钮、标签预留英文更长时的折行或缩小字号，禁止固定宽度裁切。
8. **组件可映射 shadcn**：Primary / Outline / Ghost Button、Card、Input、Dialog 优先；自定义样式用 token 扩展。

---

## 4. 视觉语言

### 4.1 色彩体系

#### A. 大厅 / Meta 层（首页、档案、成就）

| Token | Light | Dark | 用途 |
| --- | --- | --- | --- |
| **Ambient 背景** | `#f8fafc` + 翠绿/青绿径向光晕 | `slate-900` 系 + 低对比光晕 | 页面底色 `.bg-home-ambient` |
| **品牌强调** | `emerald-600` / `emerald-700` | `emerald-400` / `emerald-500` | 主 CTA、徽章、hover 描边 |
| **正文** | `slate-900` | `slate-100` | 标题、正文 |
| **次要文字** | `slate-500` / `slate-600` | `slate-400` | 说明、meta |
| **玻璃卡片** | 白 60%→25% 渐变 + 白边 | slate 半透明 + 细白边 | `.home-glass-panel` |
| **称号徽章** | `emerald-100` 底 + `emerald-800` 字 | `emerald-900/30` 底 | 玩家称号 pill |

#### B. shadcn 语义色（分类页、通用页）

基于 `src/App.css` 的 OKLCH 变量：`background`、`foreground`、`card`、`primary`、`muted`、`border`、`destructive`。  
**圆角基准**：`--radius: 0.625rem`（10px），但大厅卡片实际使用 **26–32px**，可视为品牌覆盖。

#### C. 日麻牌桌主题（独立，不跟大厅 light/dark）

通过 `data-riichi-theme` 切换，每套含：`bg`、`table`、`border`、`accent`、`btn-primary`、`tile-back`。

| 主题 ID | 气质 | 桌面色 | 强调色 |
| --- | --- | --- | --- |
| `green`（默认） | 经典雀庄绿毡 | `#2f5846` | 金黄 `#ffd166` |
| `blue` | 冷色现代 | `#254768` | 天蓝 `#7bd2ff` |
| `warm` | 暖木酒屋 | `#4a3326` | 琥珀 `#f0c58a` |

牌面：白底 + 红/绿/字牌色类；手牌有厚度阴影（`--riichi-tile-back-color`）。

#### D. 小游戏 / Canvas

各游戏可保留自身配色（2048 色块、打砖块霓虹等），但 **header 区** 建议与全站 Outline 返回按钮风格一致。

### 4.2 字体

| 场景 | 字体栈 |
| --- | --- |
| 中文 UI | `Noto Sans SC`, `PingFang SC`, `Hiragino Sans GB`, `Microsoft YaHei` |
| 大厅标题（可选） | `Avenir Next` 混排 |
| 数字 / 分数 | `tabular-nums` 等宽数字 |
| 英文 | 系统 sans 即可 |

- 首页大标题：`text-2xl font-bold`
- 卡片标题：`text-sm font-semibold`
- 微标签：`text-xs tracking-[0.24em] uppercase`（如 `GAME HUB`、分类标签）

### 4.3 间距与栅格

| 断点 | 容器 | 列 |
| --- | --- | --- |
| Mobile `<768px` | `px-4`，`max-w-6xl` 居中 | 单列堆叠 |
| Tablet `md` | 同上 | 2 列网格 |
| Desktop `xl` | 同上 | 3 列（任务区） |

- 区块间距：`gap-8`（main）、卡片内 `p-5`
- Header 高度：约 `56–72px`，带 `backdrop-blur`

### 4.4 阴影与质感

- **玻璃卡片**：外阴影轻、`inset 0 1px` 高光、 `backdrop-blur: 16px`
- **Hover lift**：`translateY(-4px)` + 翠绿外发光 `rgba(16,185,129,0.2)`
- **Premium 面板**（分类页顶部）：`.premium-panel-soft` 浅色实体卡；`.premium-surface` 深色金棕渐变（用于强调区块，慎用）

### 4.5 动效

| 名称 | 场景 | 时长 |
| --- | --- | --- |
| `fade-in slide-in-from-bottom-4` | 首页卡片错峰入场 | 700ms，delay 50–300ms |
| `home-hover-lift` | 卡片悬停 | 300ms spring |
| `riichi-tile-drawn` | 摸牌 | 250ms |
| `riichi-modal-in` | 和了 / 流局弹窗 | 220ms |
| `riichi-active-pulse` | 当前决策高亮 | 1.2s loop |
| Toast | 成就解锁、成长点 +N | 滑入 + 自动消失 |

`prefers-reduced-motion` 下日麻动画已做降级，新设计需保持。

### 4.6 图标

- 库：**lucide-react**（线性、24px 基准、`size-3.5` / `size-4` 常用）
- 分类：小游戏 `Compass`、棋类 `ScrollText`、扑克 `Sparkles`
- 语言：`Languages` + 中/EN 胶囊切换

---

## 5. 组件规范

### 5.1 必备组件清单

| 组件 | 变体 / 说明 | 出现位置 |
| --- | --- | --- |
| **LanguageSwitcher** | 胶囊 `中 \| EN`，选中白底阴影 | 首页、档案、分类 |
| **MainPlayerCard** | 头像 + 昵称 + 称号 + 3 列统计 | 首页 |
| **ContinuePlaySection** | 主按钮翠绿 + 规则/新手链 | 首页 |
| **QuickAccessPanel** | 签到、成就、档案、语言；有 `compact` | 首页 header |
| **PlayerAvatar** | 预设色块字 / 上传图 | 玩家卡、档案 |
| **CharacterPortraitSlot** | 立绘占位渐变框 | 首页雀士、档案 |
| **Button** | default / outline / ghost；`active:scale-95` | 全站 |
| **Card** | shadcn 基础 + 自定义大圆角覆盖 | 成就、档案 |
| **VirtualController** | 十字方向 + A/B，light/dark tone | 移动端小游戏 |
| **AchievementUnlockToast** | 全屏角标 toast | 全局 |
| **GrowthPointToast** | `+N` 成长点 | 全局 |
| **RiichiTile** | `hand / river / meld / indicator`，本地统一 PNG 图集（0–36 + 牌背） | 日麻 |
| **Game modals** | 和了、流局、立直、吃碰杠选择 | 日麻 |

### 5.2 按钮层级

1. **Primary**：翠绿实心——「回到牌桌」「开一局」「保存」
2. **Secondary / Outline**：白半透明底——「查看规则」「档案」
3. **Ghost**：文字链——「新手引导」
4. **Destructive**：重来、认输（少用）

### 5.3 空状态

- 虚线边框 + `slate-50` 底 + 一句说明 + 可选 CTA
- 例：成长动态为空、无最近游玩

---

## 6. 关键页面说明（Stitch 出稿优先级）

### P0 — 首页大厅 `Home`

**目标**：一眼知道「我是谁」「能否继续日麻」「今天还有什么可做」。

**布局（自上而下）**：

```
┌─────────────────────────────────────────────┐
│ GAME HUB          [签到][成就][档案][中|EN] │  ← 半透明 header
│ 日麻游戏大厅 / 副标题                          │
├─────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────────────┐  │
│ │ 玩家卡        │  │ 继续游玩（主 CTA）     │  │  ← md 2 列；移动继续游玩在上
│ │ 头像 昵称 称号│  │ 翠绿按钮 + 规则/引导  │  │
│ │ 成长/成就/角色│  │                      │  │
│ └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────┤
│ ┌ 每日任务 ┐ ┌ 成长动态 ┐ ┌ 雀士同行 ┐      │  ← xl 3 列
├─────────────────────────────────────────────┤
│ ┌ 日麻 Hero ─────────────────────────────┐  │  ← 深色 premium 或品牌绿
│ │ 主牌桌视觉 + 直接开打 / 规则 / 成就      │  │
│ └────────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│ 游戏货架：小游戏 | 棋类 | 扑克  （3 入口卡）   │
└─────────────────────────────────────────────┘
```

**待优化方向（欢迎 Stitch 发挥）**：

- 日麻 Hero 与玩家卡之间的**视觉层级**可再拉开（Hero 更像「主舞台」）
- 游戏货架目前偏列表感，可做**封面缩略图 + 难度标签**
- 雀士区预留**立绘大图位**（当前为渐变占位）
- 统一 header 语言切换与快捷入口的**密度**（移动端勿挤）

### P0 — 日麻对局 `GameMahjongJapanese`

**视图状态**：`rules` → `game`（规则宽版弹窗；训练侧栏默认收起）

**桌面布局概念**：

```
┌ Header：返回 | 局况/立直棒 | 宝牌 | 菜单 ─────────────────────┐
├──────────────┬────────────────────────────────┬───────────┤
│ 约 276px     │       约 960px 方形四人牌桌      │ 56/360px  │
│ 固定场况台    │ 座位卡 / 完整手牌背 / 6×6 牌河   │ 训练侧栏   │
│ 点数/余牌/进度│ 自家单行手牌；动作区按需悬浮       │ 默认收起   │
└──────────────┴────────────────────────────────┴───────────┘
```

**桌面端约束**：日麻只按 1920×1080 及以上电脑环境设计。牌桌维持桌面结构；窗口不足时允许页面滚动，不提供手机竖屏舞台、移动端断点或安全区变体。其他小游戏的移动端实现不受此约束影响。

**设计重点**：

- 牌桌可读性 > 装饰；河牌、副露、手牌间距清晰
- 牌河 24 张后进入紧凑显示，完整容纳最多 6×6，不覆盖中央计分区
- 牌面只使用同一张整套生成图集，禁止混用逐张生成、网络字体或风格不一致的临时素材
- 可 Claim 时操作栏醒目但不挡牌
- 弹窗：和了（役种列表）、流局（原因）、结算（点数推移）
- 三套主题色板见 §4.1C，需出 **Component variant** 而非整页三套稿

### P1 — 档案页 `Profile`

长页滚动，区块：

1. 顶栏：返回 + 语言
2. 玩家身份：头像（预设 12 色 / 上传）、昵称输入、称号选择
3. 偏好：日麻主题、音量 BGM/SFX/语音、语言
4. 签到日历 + 周/月里程碑
5. 雀士列表（锁定态 / 解锁态 / 好感阶段）
6. 统计：各游戏局数
7. 成长流水

风格可与首页玻璃态统一；表单控件用 shadcn Input + 卡片分组。

### P1 — 分类页 `Category`

- 顶：分类名 + 描述 + 语言
- 顶部 `premium-panel-soft` 介绍条
- 游戏列表：图标/名/描述/难度/开始按钮
- 难度 1–5 用统一 pill（`difficulty.1` … `difficulty.5`）

### P2 — 成就页 `Achievements`

- 顶部 3 列统计：成就点 / 任务点 / 已解锁数
- 成就卡片：图标、名称、描述、进度条、已解锁勾选
- 风格偏简洁 shadcn，可与大厅「玻璃态」做一次统一升级

### P2 — 小游戏通用壳

多数页面结构：

```
[ ← 首页 ]  游戏名                    [ 重开 ]
─────────────────────────────────────
            游戏区域（Canvas / DOM）
─────────────────────────────────────
[ 虚拟手柄 ]（仅 mobile，部分游戏）
```

出 1 套 **Game Shell** 模板即可覆盖 9 款小游戏。

### P3 — 俄罗斯方块 / 3D 魔方

- 方块：偏复古街机，侧边栏分数/下一个/升级（已有逻辑）
- 魔方：Three.js 画布 + 手势提示 + 计时/步数 overlay

---

## 7. 雀士角色（Phase 5–6 预研）

当前为**数据结构 + UI 占位**，Stitch 可提前定义视觉规范：

| 字段 | 设计含义 |
| --- | --- |
| `portraitKey` | 半身立绘，比例约 3:4，圆角 24px |
| `accent` | 角色专属渐变（如澪：amber→rose） |
| `themeToken` | 将来可映射日麻 UI 点缀色 |
| 好感阶段 | 4 档，档案与首页展示阶段名 |

角色名示例：**澪** —「先把手牌理顺，再谈胜负。」  
风格方向：日系雀士、克制、偏插画非写实；与大厅翠绿基调可并存（角色卡用深色渐变底）。

---

## 8. 国际化（i18n）

- 语言：`zh`（默认）/ `en`
- 存储：`localStorage` `game-hub-locale`
- 文案集中在 `src/lib/i18n.ts`（约 700+ key × 2 语言）
- **设计注意**：
  - 英文按钮常比中文长 30–50%
  - 日麻座位：Self / Right / Across / Left
  - 数字、日期格式随 locale 变，UI 勿写死宽度
  - 语言切换器保持可见，不必藏进二级菜单

---

## 9. 响应式与 PWA

- **小游戏最小支持宽度**：320px；各小游戏原有移动端策略保持不变
- **日麻例外**：只支持 1920×1080 及以上桌面设计；小窗口保留桌面结构并滚动，不设置移动断点或安全区
- **PWA**：可安装到主屏幕；图标/名称见 `public/manifest.json`
- **横屏**：仅作为小游戏的可选支持项；日麻不提供手机横屏变体

---

## 10. 交付物期望（Stitch 输出）

请按优先级提供：

1. **设计 Token 页**：色板、字阶、圆角、阴影、间距（Figma 变量或 Stitch 等价物）
2. **首页大厅** — Mobile + Desktop，Light + Dark
3. **日麻对局** — Desktop + Mobile 各 1 帧；含和了弹窗 1 态
4. **档案页** — Mobile 长滚动
5. **分类页** — 游戏列表卡片组件
6. **组件库**：Button、Card、LanguageSwitcher、PlayerCard、Toast、Mahjong Tile、Action Bar
7. **（可选）雀士立绘占位规范** — 1 个完整角色卡 + 1 个列表项

导出时请标注：

- 哪些颜色对应 CSS 变量名（便于开发映射）
- 哪些区域是玻璃态 / 实体卡 / Canvas 自由区
- 动效意图（入场、hover、对局反馈）

---

## 11. 现状 vs 目标（差距说明）

| 维度 | 现状 | 目标 |
| --- | --- | --- |
| 首页 | 玻璃态翠绿，信息完整但偏「仪表盘」 | 更强「主牌桌舞台感」+ 货架游戏感 |
| 全局导航 | 无统一顶栏，各页 header 不一 | 可选轻量全局壳或统一 header 模式 |
| 成就页 | 标准 shadcn 白卡 | 与大厅视觉语言统一 |
| 游戏封面 | 多为文字列表 | 图标/截图/难度视觉化 |
| 雀士 | 渐变占位 | 立绘位 + 解锁态设计 |
| 日麻 | 三套主题完整，偏功能 | 弹窗/结算可更「仪式感」 |
| 音频 | 无大厅 BGM | 后续迭代，设计可预留音量入口（档案已有） |

---

## 12. 参考文件（开发映射）

| 类型 | 路径 |
| --- | --- |
| 主题变量 | `src/App.css` |
| 大厅页 | `src/pages/Home.tsx` |
| 玩家卡 | `src/components/home/MainPlayerCard.tsx` |
| 语言切换 | `src/components/common/LanguageSwitcher.tsx` |
| 日麻入口 | `src/pages/mahjong/japanese/` |
| 日麻主题常量 | `src/pages/mahjong/japanese/constants.ts` |
| 文案 key | `src/lib/i18n.ts` |
| 产品路线图 | `docs/player-meta-roadmap.md` |
| i18n 计划 | `docs/i18n-localization-plan.md` |

---

## 13. Stitch 提示词摘要（可直接粘贴）

```
Design a bilingual (ZH/EN) web game lobby called "Game Hub".

Core: Japanese Riichi Mahjong as the hero experience, plus 15 mini-games.
Mood: calm game parlor, glassmorphism cards, emerald accents, large 26-32px corners.
Home: player card, continue mahjong CTA, daily tasks, character teaser, game shelf.
Mahjong table: 4-player layout, 3 color themes (green felt default), readable tiles.
Mobile-first, 44px touch targets, dark mode for lobby pages.
Use shadcn-like components; lucide icons; Noto Sans SC + system sans.
Avoid: login, multiplayer, clutter on the mahjong table.
Deliver: tokens, home (light/dark), mahjong desktop/mobile, profile, category list.
```

---

*文档版本：2026-06-17 · 与 main 分支 i18n 大推进同期*
