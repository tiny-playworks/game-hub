# P3 段位战 + 4 档 AI

> 依赖：P1、P2。先读 [README](./README.md)。
> 目标：给日麻一个长期目标。大厅可开段位战，按名次和终局点数得失 pt，升降段；高段位对手由更强的 AI + 高段位角色担任。
> 建议拆 2 次执行：3.1–3.3（AI strong/expert）→ 3.4–3.7（段位系统与 UI）。AI 是本路线图工程难度最高的部分。

## 执行进度（2026-10-11）

- [x] 第一批 3.1–3.3：四档难度、逐座位配置、strong/expert 策略，自由对局设置与存档/牌谱兼容。
- [x] 第二批 3.4–3.7：段位积分、对手匹配、段位战流程、结算与战绩。
- 第一批验证：51 项相关回归通过；桌面浏览器验证强者设置持久化、专家开局、刷新续玩与 AI 自动出牌。`pnpm check`、`pnpm build` 通过；仓库已有 lint 警告保留。
- 第二批验证：补齐 `ranked.*` 完整中英国际化文案；修复 `RankedLobbyCard` 语义标签 a11y 校验；对手池严格按 3.6 表格实现，支持角色不足时初心复选与座次随机洗牌；新增 `tests/ranked.test.ts`（18 个单测覆盖 pt 公式、升降级边界、连续升降段、对手匹配池、弃赛惩罚、结算幂等、解锁与存档导出导入）；全量回归 60 个测试文件 445 项测试全通；`pnpm typecheck` 与 `rsbuild build` 正常通过，6 项验收标准全部闭环。
- 实现约定：未听牌打点采用公开信息启发式估计，听牌使用规则引擎预览；末局按非直击收入保守估计顺位。降低无效小和优先级体现在鸣牌/立直/保留打点路线，已有合法和了仍接受，避免额外振听风险。耗时约束通过固定种子样本测量，不以时间截断决策，保持可复现。
- 本阶段验收 1–6 全部闭环通过。尚未验证移动端与长期 AI 强度对比。

## 涉及文件（先读）

- [engine/ai.ts](../../src/pages/mahjong/japanese/engine/ai.ts)（`threatOf`、`dangerFor`、`decideAiTurn`、`decideAiClaim`）
- [engine/rules.ts](../../src/pages/mahjong/japanese/engine/rules.ts)（`RiichiAiLevel`、`isRiichiRuleConfig`）
- [lib/riichiShanten.ts](../../src/lib/riichiShanten.ts)、[lib/riichiWaitingTiles.ts](../../src/lib/riichiWaitingTiles.ts)、[lib/riichiGameEnd.ts](../../src/lib/riichiGameEnd.ts)
- [store/riichiMatchStore.ts](../../src/pages/mahjong/japanese/store/riichiMatchStore.ts)、[store/persistence.ts](../../src/pages/mahjong/japanese/store/persistence.ts)
- [riichiProgress.ts](../../src/lib/riichiProgress.ts)、P1 的 `gameEvents.ts` / `wallet.ts`
- [Home.tsx](../../src/pages/Home.tsx)（P1 大厅的段位卡占位）、[Profile.tsx](../../src/pages/Profile.tsx)

---

## 3.1 AI 档位扩展

`RiichiAiLevel` 扩为 `'beginner' | 'standard' | 'strong' | 'expert'`，`isRiichiRuleConfig` 同步放宽。每个座位可有不同档位（`RiichiMatchState` 增加 `seatAiLevels`，缺省回落到 `rules.aiLevel`）。

## 3.2 strong 档

在 standard 基础上增加：

- **牌效**：打牌选择以「向听数 → 有效进张数（ukeire，扣除可见牌）→ 打点潜力」排序。
- **押退判断**：对每个立直/高威胁副露者，比较「自己向听数 + 预估打点」与「对手威胁」，决定全押 / 回避 / 弃和。基本规则：
  - 一向听以上且打点 < 满贯 → 遇立直弃和；
  - 听牌且好型（≥ 2 种等待）→ 押；愚形低打点 → 视巡目弃和。
- **安全度排序**（弃和时）：现物 > 字牌已见 3 张 > 筋 + 已见 > 壁 > 单筋 > 字牌已见 2 张 > 中张无筋。
- **默听**：听牌已有役且打点 ≥ 满贯（或好型且已有足够打点）时默听。
- 与 P2 风格参数叠加：风格调整阈值，档位决定算法完整度。

## 3.3 expert 档

在 strong 基础上增加：

- **顺位意识**（南场/东风后半，参考 `riichiGameEnd` 的结束条件）：领先时降低放铳风险、愿意鸣小牌速和；末位时追求能翻盘的打点；All Last 计算「和了是否改变名次」，不改变名次的和了降低优先级。
- **读牌**：识别染手（某色舍牌极少 + 副露同色）→ 该色危险度提升；宝牌及其周边危险度提升；对手早巡打出的牌周边视为相对安全。
- **立直时机**：后巡差听牌 → 默听或不立；先制立直优先。
- 性能约束：单次决策桌面端 < 50ms；保持纯函数、同 seed 可复现。

## 3.4 段位表

5 段 × 3 级。`start` 为升入该级时的初始 pt，`max` 为升级阈值。

| 段位        | 1 级 start/max | 2 级 start/max | 3 级 start/max |
| ----------- | -------------- | -------------- | -------------- |
| 初心 novice | 0 / 20         | 0 / 80         | 0 / 200        |
| 雀士 adept  | 300 / 600      | 400 / 800      | 500 / 1000     |
| 雀杰 expert | 600 / 1200     | 700 / 1400     | 1000 / 2000    |
| 雀豪 master | 1400 / 2800    | 1600 / 3200    | 1800 / 3600    |
| 雀圣 saint  | 2000 / 4000    | 3000 / 6000    | 4500 / ∞       |

- 升级：pt ≥ max → 进入下一级，pt 置为下一级 start。
- 降级：pt < 0 → 退回上一级，pt 置为上一级 start。**初心不降级**；跨段降级（如雀士 1 → 初心 3）允许。
- 新玩家从初心 1 级 0pt 开始。

## 3.5 pt 计算

```
pt = 名次基础分[段位][名次] + clamp(round((终局点数 - 25000) / 1000), -30, +30)
半庄战：pt × 1.5（四舍五入）
被击飞（点数 < 0）：额外 -10
```

| 段位 | 1 位 | 2 位 | 3 位 | 4 位 |
| ---- | ---- | ---- | ---- | ---- |
| 初心 | +30  | +15  | +5   | 0    |
| 雀士 | +40  | +20  | 0    | -20  |
| 雀杰 | +50  | +20  | 0    | -40  |
| 雀豪 | +60  | +25  | 0    | -60  |
| 雀圣 | +70  | +30  | 0    | -90  |

- 纯函数放 `src/lib/ranked.ts`：`computePtDelta(...)`、`applyPtDelta(state, delta)` 返回新状态 + 升降级信息。

## 3.6 对手匹配与 AI 档位映射

| 玩家段位 | 对手角色池（按 rankBand）   | AI 档位                          |
| -------- | --------------------------- | -------------------------------- |
| 初心     | 初心为主，初心 3 级混入雀士 | beginner（初心 3 级混 standard） |
| 雀士     | 雀士为主，混 1 名初心或雀杰 | standard                         |
| 雀杰     | 雀杰为主，混雀士/雀豪       | standard + strong 混合           |
| 雀豪     | 雀豪、雀杰                  | strong                           |
| 雀圣     | 全池高段位，`yoru` 必定出场 | expert                           |

- 主角色不作为对手；角色不足时允许同段位重复抽到不同人即可（8 人足够每桌 3 个不同角色）。
- 达到某段位带时触发 P2 的 `rank-band` 解锁，弹出「新角色解锁」提示。

## 3.7 段位战流程与 UI

**入口**：大厅段位卡（P1 占位）变为真实内容：段位徽章（5 段各一套配色/图形，CSS/SVG 即可）、级数、pt 进度条、「开始段位战」按钮 + 东风/半庄切换。

**匹配演出**：点击后 1.5s 动画依次翻出 3 名对手角色卡（头像 + 名字 + 段位带 + 风格标签）→ 进入对局。

**段位战规则限制**：

- 规则固定为默认规则（`DEFAULT_RIICHI_RULES`），不可自定义。
- 禁用悔棋、训练面板提示、AI 建议；自由对局保持原样。
- 中途退出或开新局 = 视为第 4 名结算（确认对话框提示）。存档续玩仍有效。

**结算页**（替换段位战的终局弹窗）：

1. 四家名次 + 终局点数（角色立绘：1 位 happy，4 位 frustrated）；
2. pt 变化：进度条动画 + 数字滚动；
3. 升级：金色段位徽章翻转 + 「晋级 雀士 2 级」；降级：灰色下沉提示；
4. 本局雀币（P1 规则 + 段位战额外 +20%）与好感变化；
5. 按钮：再来一局 / 复盘（P4 实装，本阶段可隐藏）/ 返回大厅。

**战绩**：Profile 新增段位面板：当前段位、历史最高、最近 20 场（名次、pt 变化、对手）、名次分布、平均顺位、一位率、被飞率。

**存储**：`game-hub-ranked-v1`

```ts
interface RankedState {
  band: RankBand;
  level: 1 | 2 | 3;
  pt: number;
  peak: { band: RankBand; level: 1 | 2 | 3 };
  history: {
    at: number;
    matchLength: 'east' | 'south';
    placement: 1 | 2 | 3 | 4;
    finalScore: number;
    ptDelta: number;
    opponents: string[];
  }[]; // 最近 50
  activeMatchId: string | null; // 进行中的段位战，用于中途退出判负
}
```

段位战结束通过 `emitGameEvent({ gameId: 'mahjong-japanese', type: 'finish', meta: { ranked: true, placement, matchLength } })` 通知其他系统。

---

## 验收

1. 新存档大厅显示「初心 1 级 0/20」，开始段位战可选东风/半庄，有匹配翻卡演出。
2. 段位战中悔棋与训练提示不可用；自由对局仍可用。
3. 一局东风战结束后结算页 pt 符合公式；连续拿 1 位能升级并有晋级演出；在雀士段位连续 4 位能降级。
4. 中途退出段位战再回到大厅，按第 4 名结算。
5. 在设置中临时把自由对局 AI 设为 strong/expert：明显看到 AI 遇立直会弃和、打现物/筋；expert 在 All Last 领先时打法保守。
6. Profile 段位面板与最近战绩正确；导出/导入存档后段位保留。

## 不做

- 不做和牌演出升级与复盘内容（P4），结算页复盘按钮可先隐藏。
- 不做段位赛季重置、排行榜。
- 不做三麻或其他规则变体。
