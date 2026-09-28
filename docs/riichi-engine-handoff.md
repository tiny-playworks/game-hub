# 日麻引擎重构交接（阶段 0 完成 / 阶段 1 进行中）

对应计划：`.cursor/plans/日麻评估与优化计划_9ccd25c1.plan.md`（只读，不要改）。

## 当前状态

- **能用的**：纯函数引擎 `src/pages/mahjong/japanese/engine/`，以及对应测试 `tests/riichi-engine-sim.test.ts`、`tests/riichi-test-helpers.test.ts`，全部通过。
- **不能编译的**：UI 还没有接到新引擎上。`pnpm run typecheck` 会在以下 4 个文件报错：
  - `index.tsx`
  - `components/Modals.tsx`
  - `components/TableContextPanel.tsx`
  - `src/pages/Home.tsx`（引用了已删除的 `store/riichiGameStore`）
- **旧测试**：部分旧测试依赖已删除的模块或旧签名，需要移植，清单见下文。

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

### 已写好但尚未接入 UI

- `store/riichiMatchStore.ts`：`dispatch`、效果监听、进度去重、自动保存。
- `store/persistence.ts`：存档和上局牌谱。
- `useRiichiAutomation.ts`：唯一的调度器；AI 延迟行动；自动和了、不鸣、自动摸切；超时处理；所有回调都用 `turn` 校验是否过期。
- `playerProfile.riichiSettings`。
- `src/components/ui/dialog.tsx`（shadcn）。
- `helpers.ts`：新增 `formatLogEntry`，把日志条目渲染为文本。

## 下一步（阶段 1 收尾）

1. **补 3 个小 hook**
   - `useHumanRemainingSeconds`：读 `decisionClock`，每 250ms 刷新；只在计时组件里订阅。
   - `useRiichiEffectSounds`：用 `subscribeRiichiEffects` 把 sound 效果映射到 `useRiichiSounds`。
   - 自家视图模型：`getSeatTurnOptions` / `getSeatClaimOptions` / 振听原因 / 听牌提示。听牌提示可以参照 git 历史里旧 `useRiichiDerived.ts` 中的 `tenpaiHint`，改用 `engine/evaluate.ts` 的 `evaluateSeatWin({ preview: true })`。
2. **重写 `index.tsx` 的接线**
   - 状态从 `useRiichiStore` 读取，操作改为 `dispatch(withElapsed(event))`。
   - 立直改成两步：先点「立直」按钮，再点一张 `riichiDiscards` 中的牌。
   - 过牌：`{ type: 'claim', seat: 0, response: { type: 'pass' } }`。
   - 下一局：`{ type: 'nextRound' }`。
3. **`Modals.tsx`**
   - 和了结果改为 `round.result`：`wins[]` 可以有多个（双响）。
   - 流局改为 `result.type === 'draw'`，原因是代码，另有 `nagashiSeats`。
4. **`TableContextPanel.tsx`**：用 `getDecisionSeat` 替换原来的逻辑。
5. **`Home.tsx`**：改为读 `useRiichiStore`。
6. **补 i18n key（中英两套都要）**
   - `riichi.log.*`：`roundStart`、`discard`、`riichi`、`chi`、`pon`、`minkan`、`ankan`、`kakan`、`tsumo`、`tsumoYakuman`、`ron`、`ronYakuman`、`ryuukyoku`、`nagashi`、`timeoutDiscard`、`timeoutPass`、`scoreLine`、`matchEnd`、`undo`。
   - `riichi.drawReason.{exhaustive,kyuushu,suufon,suucha,suukaikan,sanchahou}`，以及同名的 `riichi.drawDesc.*`。
   - `riichi.matchEndReason.{tobi,east4_end,south4_end,agari_yame,extension_end,default}`。
   - `riichi.unit.points`（例如 `{points} 点`）。
7. **移植旧测试到引擎**
   - 失效的旧测试：`riichi-win-result`、`riichi-phase1-baseline`、`riichi-menzhen-waiting`、`riichi-next-round`、`riichi-ai`、`mahjong-rules`（保留赤五相关用例）、`riichi-game-end`（东 4 无人到 30000 时现在进入南入）、`riichi-furiten`、`riichi-abortive-draw`。
   - 需要新增的规则用例：抢杠、海底 / 河底、立直后暗杠、双响、食替、一发自摸、四家立直先判荣和。
8. **验收**：`pnpm run check` 和 `pnpm run test` 全部通过后，把阶段 1 标记为完成。

## 后续阶段要点

- **阶段 3**：AI 已按新方案实现，还需要补测试，并调参。模拟统计（30 个半庄）：和了率约 78%，荒牌约 20%。
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
