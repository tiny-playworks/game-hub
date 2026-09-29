# 日麻引擎重构交接（阶段 0、1 完成）

对应计划：`.cursor/plans/日麻评估与优化计划_9ccd25c1.plan.md`（只读，不要改）。

## 当前状态

- **阶段 1 已完成**：日麻页面、结算弹窗、场况侧栏和首页均已接入纯函数引擎；旧 effect/定时器流程不再使用。
- **验收证据**：`pnpm run check`、`pnpm run test`（54 个文件、378 条用例）、`pnpm run build` 均通过。桌面浏览器已验证“开局 → 出牌 → AI 响应 → 荒牌结算 → 下一局”，并截图核对；双响弹窗有专门组件测试。
- **计划状态**：原计划文件要求只读，未修改；本交接将阶段 1 标为完成。阶段 2 的逐条规则测试仍未全部完成，阶段 4 至 7 仍待推进。

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
| `riichiRsAdapter` | 增加 `doubleRiichi` / `firstTake`（天和、地和）/ `lastTile`（海底、河底）/ `allowDoubleYakuman`；删除 `calcWithRiichiRs` |
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

## 下一步

- 阶段 2：按照原计划，把其余规则与已修的 12 个 bug 逐条补足专项回归用例，检查边界场景。已新增的抢杠、海底/河底、立直后暗杠、双响、食替、一发自摸、四家立直先判荣和等用例可复用。
- 阶段 3：AI 已有确定性决策专项测试，仍需按实战结果调参与完成难度档位验收。

## 后续阶段要点

- **阶段 3**：AI 已按新方案实现并有专项测试，还需调参与难度档位验收。先前模拟统计（30 个半庄）：和了率约 78%，荒牌约 20%。
- **阶段 4**
  - 引擎已缓存 `turnOptions` 和结构分析。
  - 还需要：WASM 动态导入。
  - 资源压缩：牌图集用 `cwebp`；音频用 `ffmpeg` 转 ogg / mp3。两个工具本机都已安装。
- **阶段 5**
  - 立直横置使用 `riichiDiscardIndex`。
  - 鸣牌方向使用 `meld.fromPlayer` / `calledTile`。
  - 危险度使用 `engine/ai.ts` 的 `threatOf` / `opponentViewOf` 加上 `evaluateTileDanger`。
- **阶段 6**
  - 用 Radix Dialog 做对话框时，Portal 要挂到带 `data-riichi-theme` 的舞台元素内，否则 CSS 变量会失效。
  - 去掉 `rsbuild.config.ts` 里的 `user-scalable=no`。
- **阶段 7**：存档和牌谱文件格式已就绪（`toReplayFile` / `replayMatch` / `persistence.ts`），还缺 UI：大厅的「继续对局」入口和牌谱查看器。
