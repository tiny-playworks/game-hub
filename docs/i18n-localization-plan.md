# 中英文本地化计划

## 当前事实

- 项目已经有 `LocaleContext`，入口在 `src/contexts/LocaleContext.tsx`。
- `LocaleContext` 暴露 `locale`、`setLocale(next)`、`t(key)`。
- 当前 locale 会通过 `src/lib/i18n.ts` 中的 `LOCALE_STORAGE_KEY = 'game-hub-locale'` 持久化到 `localStorage`。
- 当前没有独立的 `zh.ts` / `en.ts` 文件，翻译字典集中放在 `src/lib/i18n.ts` 的 `messages.zh` 和 `messages.en` 中。
- `t(key)` 只处理普通 key；带变量的文案需要使用 `formatMessage(locale, key, vars)`。
- 现有 `messages` 已覆盖首页、档案、成就、游戏名称/描述、日麻部分弹窗等内容，但页面和规则逻辑里仍有大量硬编码中文。

## 目标

实现站内一键切换中文 / 英文，并保证刷新后保留用户选择。

最终效果：

- 用户能在统一位置切换语言。
- 切换后首页、分类、档案、成就、小游戏、棋类、扑克、日麻主要界面同步更新。
- 新增文案必须同时提供中英文。
- 页面中不再新增裸中文或裸英文 UI 文案。

## 总体方案

### 1. 增加语言切换入口

新增一个共享组件：

- `src/components/common/LanguageSwitcher.tsx`

组件职责：

- 调用 `useLocale()` 读取 `locale`。
- 点击或下拉选择时调用 `setLocale('zh' | 'en')`。
- 文案显示为 `中文 / English` 或 `中 / EN`。
- 不直接处理业务翻译，只负责切换状态。

推荐放置位置：

- 第一阶段：放在首页玩家卡片或档案页设置区，保证用户能找到。
- 第二阶段：需要全站随时切换时，再放进页面公共 header 或轻量浮动设置入口。

原因：当前项目没有真正的全局导航栏，很多游戏页面自己写 header。先放统一设置区最小改动，后续再决定是否把每个游戏 header 都接入。

### 2. 梳理翻译字典结构

短期继续使用当前结构：

- `src/lib/i18n.ts`

原因：

- 现有代码已经基于该文件工作。
- 迁移成本低。
- 本轮目标是完成中英文切换，不先做无收益的大拆分。

中期可选重构：

```text
src/lib/i18n/
  index.ts
  zh.ts
  en.ts
```

触发条件：

- `src/lib/i18n.ts` 继续膨胀，维护困难。
- 需要按模块拆分游戏、日麻、成长系统翻译。
- 需要自动校验 `zh/en` key 完全一致。

### 3. 提取硬编码文案

按页面优先级逐步替换硬编码中文 / 英文。

扫描命令：

```bash
rg -n "[\\p{Han}]" src --glob "*.{ts,tsx}" --glob "!src/lib/i18n.ts"
```

当前轻量扫描显示，非 `i18n.ts` 文件中仍有大量中文命中，优先集中在：

- `src/lib/mahjongRiichi.ts`
- `src/lib/riichiRsAdapter.ts`
- `src/pages/tetris/index.tsx`
- `src/data/games.ts`
- `src/pages/mahjong/japanese/**`
- 各个 `Game*.tsx` 小游戏页面

处理原则：

- UI 文案全部进入 `messages.zh/en`。
- 游戏规则内部如果是面向用户展示的名称、提示、原因，也要进入字典。
- 纯注释、测试名、内部枚举、牌理算法内部说明可以暂不处理。
- 不要为了消除扫描命中，把非 UI 业务常量强行复杂化。

## Key 命名规范

使用点分层级，按功能归属命名。

示例：

```ts
'settings.language.label': '语言'
'settings.language.zh': '中文'
'settings.language.en': 'English'

'game.snake.score': '分数'
'game.snake.best': '最佳'
'game.snake.finalScore': '最终分数'

'tetris.mobile.start': '开始'
'tetris.mobile.pause': '暂停'
'tetris.mobile.resume': '继续'
```

规则：

- 已有 key 不重复造新 key。
- 通用按钮放 `common.*`。
- 游戏通用但语义不同的文案，优先放各游戏命名空间，避免翻译不自然。
- 带变量文案使用 `{name}`、`{count}` 这种格式，并通过 `formatMessage` 调用。

## 实施阶段

### Phase 1：切换入口

- 新增 `LanguageSwitcher`。
- 在首页或档案页接入。
- 给 `settings.language.*` 增加中英文 key。
- 验证刷新后语言选择保持。

### Phase 2：首页与基础导航

- 确认 `Home`、`Category`、`Profile`、`Achievements` 无主要硬编码 UI 文案。
- `src/data/games.ts` 不再直接展示硬编码 name/description，展示层统一使用 `game.*.name` 和 `game.*.description`。
- 补齐分类、难度、按钮、空状态文案。

### Phase 3：小游戏页面

优先处理最近改动较多、硬编码明显的页面：

- `GameGuessNumber.tsx`
- `GameTictactoe.tsx`
- `GameMemory.tsx`
- `Game2048.tsx`
- `GameSnake.tsx`
- `GameBreakout.tsx`
- `GameShooter.tsx`
- `GameTank.tsx`
- `src/pages/tetris/index.tsx`
- `src/pages/rubiks/index.tsx`

每个页面处理方式：

- 所有可见中文 / 英文按钮、标题、提示、状态文本提到 `i18n.ts`。
- Canvas 内绘制的文字也要从 `t()` 或预先计算的翻译字符串传入。
- 测试里依赖中文文案的断言同步调整，优先断言 key 对应当前 locale 的结果。

### Phase 4：棋类、扑克、日麻

这部分规则文案更多，按功能分批：

- 棋类：围棋、五子棋、象棋、国际象棋。
- 扑克：斗地主、升级。
- 日麻：规则面板、行动按钮、弹窗、结算摘要、流局原因。

日麻中已有部分 `t()` 和 `formatMessage()`，重点是补齐遗漏，不要重写已有流程。

### Phase 5：字典质量和自动校验

增加轻量校验：

- `zh` 和 `en` key 必须完全一致。
- `getMessage` fallback 保持 `en -> zh -> key` 或当前 `locale -> zh -> key` 策略。
- 可新增测试覆盖：
  - `getStoredLocale` 默认中文。
  - `setStoredLocale('en')` 后能读回英文。
  - `messages.zh` 和 `messages.en` key 集合一致。

## 验收标准

- 用户能在 UI 中切换中文 / 英文。
- 切换后刷新页面仍保持选择。
- 首页、分类、档案、成就、小游戏主流程没有明显硬编码中文残留。
- `pnpm run check` 通过。
- `pnpm run test` 通过。
- `pnpm run build` 通过。
- 手动抽查中文和英文两种 locale，各至少打开：
  - 首页
  - 分类页
  - 档案页
  - 一个 DOM 小游戏
  - 一个 Canvas 小游戏
  - 日麻主界面

## 注意事项

- 不要先大规模拆 `i18n.ts`，除非实际维护已经受阻。
- 不要只加英文 key，不替换页面硬编码。
- 不要让 `t()` 接变量；需要变量时用 `formatMessage()`。
- 不要把测试、注释、内部算法常量当成第一批必须清理对象。
- 游戏内 Canvas 文案也属于 UI 文案，不能漏掉。
- 如果切换入口放在游戏页 header，要统一样式，避免每个页面各写一套语言按钮。
