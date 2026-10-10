# P1 地基：雀庄主题 + 大厅首页 + 事件总线 / 雀币 / 存档导出

> 依赖：无。先读 [README](./README.md)。
> 目标：整站从「工具站黑白灰」变成「日式雀庄」，首页变成游戏大厅；搭好后续所有系统共用的事件总线与雀币钱包；提供存档导出导入。

## 涉及文件（先读）

- [App.css](../../src/App.css) — shadcn 主题变量，目前色度全为 0
- [App.tsx](../../src/App.tsx) — 路由、`recordGameStart`
- [Home.tsx](../../src/pages/Home.tsx) 与 `src/components/home/*`
- [GameShell.tsx](../../src/components/game/GameShell.tsx)、[GameResultOverlay.tsx](../../src/components/game/GameResultOverlay.tsx)
- [GrowthPointToast.tsx](../../src/components/GrowthPointToast.tsx)、[AchievementUnlockToast.tsx](../../src/components/AchievementUnlockToast.tsx)
- [riichiProgress.ts](../../src/lib/riichiProgress.ts)、[playerStats.ts](../../src/lib/playerStats.ts)、[dailyTasks.ts](../../src/lib/dailyTasks.ts)、[weeklyTasks.ts](../../src/lib/weeklyTasks.ts)、[checkin.ts](../../src/lib/checkin.ts)
- [Profile.tsx](../../src/pages/Profile.tsx)
- [Category.tsx](../../src/pages/Category.tsx)

---

## 1.1 雀庄视觉主题（设计 token）

改写 `App.css` 的 `:root` 与 `.dark` 变量，保持 shadcn 变量名不变，让现有组件自动换肤。

参考色板（OKLCH，可微调但保持色相关系）：

| Token | 亮色（白天雀庄） | 暗色（夜间雀庄） | 用途 |
|-------|----------------|----------------|------|
| `--background` | 米白纸 `oklch(0.97 0.015 85)` | 墨绿黑 `oklch(0.18 0.02 160)` | 页面底 |
| `--card` | 象牙 `oklch(0.99 0.01 85)` | `oklch(0.23 0.025 160)` | 卡片 |
| `--primary` | 毡绿 `oklch(0.45 0.09 160)` | `oklch(0.62 0.11 160)` | 主按钮 |
| `--accent` | 金 `oklch(0.80 0.12 85)` | `oklch(0.75 0.12 85)` | 高亮、雀币、段位 |
| `--secondary` | 暖木 `oklch(0.62 0.07 60)` | `oklch(0.45 0.06 60)` | 次要、边框装饰 |
| `--destructive` | 朱红 `oklch(0.58 0.18 30)` | 同 | 危险、立直棒红点 |

新增自定义 token（加在 `@theme inline`）：`--color-felt`、`--color-wood`、`--color-gold`、`--color-paper`。

其他要求：
- 字体：标题用 `Noto Serif SC`，正文 `Noto Sans SC`（Google Fonts，`font-display: swap`）。
- 纸质感：用内联 SVG noise 做 `.paper-texture` 工具类，作为卡片背景叠层（透明度 ≤ 6%）。
- 毡面：`.felt-surface` 工具类（毡绿 + 细微 noise + 内阴影），用于大厅主视觉区和牌桌外框。
- 动效 token：`--ease-out-back`、`--duration-fast: 150ms`、`--duration-base: 250ms`；按钮 hover 微抬起 + 阴影。
- 尊重 `prefers-reduced-motion`。

## 1.2 大厅首页（重做 Home）

桌面（≥1280px）三栏布局：

```
┌───────────────────────── 顶栏 ─────────────────────────┐
│ 头像+昵称+称号      [雀币 1,280]  [签到]  [设置/语言/主题] │
├──────────────┬──────────────────────┬─────────────────┤
│              │  段位卡（P3 前显示     │  每日任务 3 条    │
│  主角色大立绘 │  「段位战 即将开放」）  │  每周任务进度     │
│  + 一句台词   │  [ 开始段位战 ]（禁用） │  最近成长动态     │
│  （P2 前用    │  [ 自由对局 ]          │                 │
│  渐变占位）   │  [ 继续对局 ]（有存档时）│                 │
├──────────────┴──────────────────────┴─────────────────┤
│ 街机角：分类页签（小游戏 / 棋类 / 扑克）+ 横向卡片行        │
└───────────────────────────────────────────────────────┘
```

- 主角色区复用 [CharacterPortraitSlot](../../src/components/characters/CharacterPortraitSlot.tsx)，P2 接入真实立绘。
- 「自由对局」= 现有日麻入口；「继续对局」复用 `hasResumableMatch`。
- 街机角卡片：游戏名、难度星级、标签；P6 再加个人最佳徽章。
- 移动端：单列堆叠即可。
- 现有 `ContinuePlaySection` / `QuickAccessPanel` / `MainPlayerCard` 可复用或重组，不需要的删除。

## 1.3 GameShell / 结算弹层换肤

- `GameShell` 顶栏改为木纹细条 + 金色返回按钮；`game-shell-ambient` 背景用纸质感。
- `GameResultOverlay` 三种 tone 换成雀庄色（win 金、lose 朱、draw 木）。
- 日麻页面本身已有 `useRiichiTheme` 主题，P1 只保证它与新全局色不冲突，不重做牌桌。

## 1.4 统一事件总线

新建 `src/lib/gameEvents.ts`：

```ts
export type GameEventType = 'start' | 'finish' | 'win' | 'best';

export interface GameEvent {
  gameId: string;            // 与 src/data/games.ts 的 id 一致
  type: GameEventType;
  score?: number;            // 分数/步数/用时等，由各游戏自定义含义
  difficulty?: string;       // P6 使用
  meta?: Record<string, unknown>; // 日麻：placement、matchLength、ranked 等
}

export function emitGameEvent(event: GameEvent): GameEventResult;
export function subscribeGameEvents(listener: (e: GameEvent, r: GameEventResult) => void): () => void;
```

- `emitGameEvent` 内部按顺序同步调用：playerStats → 钱包结算 → 任务 → 成就检查，并返回 `{ coinsEarned, unlockedAchievements, taskRewards }`。
- 日麻接入：在 `riichiProgress.ts` 的「整场对局结束」时额外 `emitGameEvent({ gameId: 'mahjong-japanese', type: 'finish', meta: { placement, matchLength } })`；现有局内细粒度事件（立直、自摸等）保持原通道，不迁移。
- `App.tsx` 中现有 `recordGameStart` 改为通过 `emitGameEvent({type:'start'})` 触发。
- P1 不接入其他小游戏（P6 做），但接口要能直接用。

## 1.5 雀币钱包

新建 `src/lib/wallet.ts`，key `game-hub-wallet-v1`：

```ts
interface WalletState {
  coins: number;
  lifetimeEarned: number;
  ledger: { at: number; delta: number; reasonKey: string }[]; // 保留最近 50 条
  dailyArcadeEarned: { dateKey: string; amount: number };     // P6 副玩法日上限用
}
```

产出规则（P1 先实现日麻部分）：

| 来源 | 雀币 |
|------|------|
| 日麻东风战完赛 | 60 |
| 日麻半庄战完赛 | 100 |
| 名次加成 | 1 位 +60 / 2 位 +30 / 3 位 +10 / 4 位 0（半庄 ×1.5） |
| 每日任务领取 | 每条 +40 |
| 每周任务领取 | 每条 +150 |
| 签到 | 每日 +30，连签第 7 天 +200 |

- 顶栏显示雀币，获得时金币飞入 + 数字滚动（参考 `GrowthPointToast` 的事件模式，新增 `game-hub:coins-gained` 事件）。
- 成长点/称号体系保留不动，雀币是并行的「可花费」货币。

## 1.6 存档导出 / 导入

新建 `src/lib/saveTransfer.ts`：

- 导出：收集所有 `game-hub-` 前缀的 localStorage 项 → `{ app: 'game-hub', schema: 1, exportedAt, data: Record<string,string> }` → 下载为 `game-hub-save-YYYYMMDD.json`。
- 导入：选择文件 → 校验 `app` 与 `schema` → 确认对话框（提示会覆盖当前进度）→ 清空现有 `game-hub-*` 后写入 → `location.reload()`。
- 入口：Profile 页新增「数据管理」卡片（导出 / 导入 / 重置全部进度，重置需二次确认）。

---

## 验收

1. 打开首页即为三栏大厅，亮/暗两套雀庄配色都协调，无残留黑白灰默认样式。
2. 所有 17 个游戏入口仍可进入，GameShell 顶栏与结算弹层已换肤。
3. 打完一场日麻东风战：顶栏雀币按规则增加并有飞入动画；Profile 可看到雀币流水（最近若干条）。
4. 签到、领取每日任务都能得到雀币。
5. 导出存档 → 在 DevTools 清空 localStorage → 导入 → 成就、称号、角色、雀币、日麻存档全部恢复。
6. 老用户数据（无 wallet key）进入不报错，雀币从 0 开始。

## 不做

- 不画角色立绘（P2）；不做段位逻辑（P3），段位卡仅占位。
- 不改日麻牌桌布局与牌面。
- 不接入小游戏事件（P6）。
