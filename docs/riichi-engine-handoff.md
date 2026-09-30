# 日麻引擎重构交接（阶段 0 至 7 已接入）

对应计划：`.cursor/plans/日麻评估与优化计划_9ccd25c1.plan.md`（只读，不要改）。

## 当前状态

- 日麻页面、结算弹窗、场况侧栏和首页均已接入纯函数引擎；阶段 2 至 7 的规则回归、AI、性能、体验、无障碍及存档回放也已接入。
- 全量测试 58 个文件、419 条用例通过；`pnpm run check` 和 `pnpm run build` 通过，检查仍有非阻断警告。初级、标准各完成 15 个固定种子半庄，逐步验证牌数与点数守恒。
- 桌面浏览器已验证设置保存、键盘出牌、菜单/指南/牌谱暂停、焦点恢复、首页续局、牌谱导入导出及按局跳转。验收截图在 `output/playwright/`。
- 原计划只读，未修改；计划引用的 `docs/PLAN.md` 和 `docs/AGENTS.md` 不存在，未另建文档。

## 已完成

### 阶段 0

- 修复 aria-label 测试。
- 新增 `pnpm run test:coverage`（istanbul）。
- `src/lib/seededRandom.ts`（`mulberry32` / `mixSeed`）。
- `createRiichiDeck(random)` 支持注入随机源。
- 牌面记法解析器 `tests/helpers/riichiTiles.ts`，例如 `tiles('123m406p11z')`。

### 规则库改动（`src/lib`）

| 文件 | 改动 |
| --- | --- |
| `riichiRsAdapter` | 增加 `doubleRiichi` / `firstTake`（天和、地和、人和）/ `lastTile`（海底、河底）/ `allowDoubleYakuman`；删除 `calcWithRiichiRs` |
| `riichiRules` | 结构分析结果按手牌 key 缓存 |
| `riichiSettlement` | 新增 `settleWins`（双响、上家取り、包牌）和 `settleNagashiMangan`；不听罚符改为精确整数 |
| `riichiGameEnd` | 延长战（南入 / 西入）；和了止め只在庄家和了时触发；新增 `MatchEndRules` 和 `extension_end` |
| `riichiAbortiveDraw` | 流局原因改为代码：`kyuushu`、`suufon`、`suucha`、`suukaikan`、`sanchahou`；新增 `countKans` |
| `riichiFuriten` | 删除无效的 `sutehai` 字段；新增 `getFuritenReason` |
| `mahjongRiichi` | 删除旧的 TS 役种 / 符番代码；新增 `isYaochuu`、`compareTiles`、`isKanMeld` |
| `riichiShanten`（新增） | 向听数与进张计算 |
| `riichiAi` | 重写：危险度（现物、立直后现物、筋、壁、字牌已见枚数）与牌价值 |

### 引擎（`engine/`）

| 文件 | 内容 |
| --- | --- |
| `types.ts`（在上一级目录） | 新的 `RiichiGameState`：死壁（岭上 4、宝牌池 5、里宝池 5）、鸣牌窗口 `claim`（各家同时响应）、`turnOptions`、`riichiPending`、`firstTurn`、`kuikaeForbidden`、`paoSeat`、`riichiDiscardIndex`、`riichiSafeTiles`、`result: RoundResult` |
| `round.ts` | 摸打、鸣牌优先级（荣和 > 碰/杠 > 吃）、双响、三家和、立直棒在宣言牌通过后才支付、一发、见逃振听、食替、岭上和杠宝、抢杠（加杠；暗杠只限国士）、四开杠延迟判定、流局满贯、包牌 |
| `options.ts` | 唯一的合法性来源：立直宣言牌、立直后暗杠不改待牌、加杠可用手中第 4 张、开杠的牌山条件 |
| `match.ts` | `createMatch` / `applyEvent`（纯函数，非法事件返回 null）/ `undoLastHumanAction`（从开局快照重放）/ `replayMatch` / `toReplayFile` / `getNextRound`（流局换庄时本场 +1） |
| `ai.ts` | 确定性 AI：按向听数和进张选牌；攻、守、平衡三种姿态；立直判断；鸣牌前检查役 |
| `selectors.ts` | `getPendingSeats`、`getDecisionSeat`、`countAllTiles` |

### 阶段 1 UI 集成

- `store/riichiMatchStore.ts`：`dispatch`、效果监听、进度去重、自动保存；已接到页面。
- `store/persistence.ts`：存档和上局牌谱。
- `useRiichiAutomation.ts`：唯一的调度器；AI 延迟行动；自动和了、不鸣、自动摸切；超时处理；所有回调都用 `turn` 校验是否过期。页面已启用。
- `playerProfile.riichiSettings`。
- `src/components/ui/dialog.tsx`（shadcn）。
- `helpers.ts`：`formatLogEntry` 把引擎日志按当前语言渲染。另新增 `useHumanRemainingSeconds`、`useRiichiEffectSounds`、`useRiichiViewModel`。

## 阶段 1 验收

- UI 的合法操作取自 `getSeatTurnOptions` / `getSeatClaimOptions`，立直需先点按钮再选宣言牌；过牌、下一局、回退均经引擎入口。
- `round.result` 驱动和了、双响、流局及流局满贯展示；中英文日志、流局与终局原因 key 已补齐。
- 旧测试已迁至现行规则与引擎入口；新增 `riichi-engine-regressions`、`riichi-modals`、`riichi-i18n-contract` 专项用例。
- `pnpm run check`、`pnpm run test`、`pnpm run build` 均通过。浏览器验收使用 1920×1200 桌面视口，出牌、整局流局及下一局实际可用。`check` 保留 Biome 的非阻断警告。

## 阶段 2 至 7

- **规则回归**：12 个原有问题均有专项用例；补足天地人和、双立直、暗杠抢国士、杠后里宝、包牌、流局满贯、多赤五、不听罚符、西场终局及途中流局优先级边界。
- **AI**：确定性牌效策略加入宝牌、役牌、断幺与混一色倾向；立直比较可见待牌加权打点，考虑余巡、庄位和末局点差；宣言牌筋、早巡筋采用保守危险估计，初级也拒绝无役鸣牌。两档有行为差异专项测试及实战模拟。
- **性能**：时钟独立订阅，侧栏关闭时不计算听牌预览；WASM 动态预热，结构分析及完整算分输入有有界缓存。牌图改为约 327 KB WebP；原 AVIF 在浏览器中解码透明，已移除。六段语音约 138 KB AAC，首次使用时加载；摸打声本地合成，桌布仅保留 SVG。
- **体验**：设置保存到玩家档案；键盘选牌/出牌、动作快捷键、同牌高亮、危险提示；立直牌横置和点棒落桌，副露按来源横置被鸣牌，加杠第四张叠放；动效尊重减少动态设置。
- **无障碍与语言**：中英文文案、牌名及赤牌读屏标签；缺失翻译开发告警；允许页面缩放；指南、菜单、结算和牌谱使用 Dialog，恢复关闭前焦点，主题 Portal 内按钮点击区至少 44px。
- **存档回放**：种子、规则和事件重放恢复，旧快照存档只提取事件字段重建；规则/用时/非法动作拒绝导入。支持首页续局、逐步回放、按局跳转、JSON 导入导出。菜单、指南、牌谱暂停调度和读秒；回退重新立直及恢复对局不会重复计入成长进度。

移动端仍不在本轮验收范围；AI 棋力为启发式策略，模拟结束与守恒测试不代表竞技胜率评估。
