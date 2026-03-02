# 日麻模块重构记录与待办

> 目的：记录当前结构、风险点与下一步任务，便于后续持续重构而不丢上下文。  
> 范围：`src/pages/mahjong/japanese/`

## 1. 当前结构（已完成）

- **页面层**
  - `index.tsx`：页面编排与 UI 组装（规则页/对局页渲染、组件拼装）。
  - `components/*`：纯展示组件（Header、Modal、Seat、StatusPanel 等）。
- **状态层**
  - `store/riichiGameStore.ts`：Zustand store，已接入 `devtools`，并使用 `createWithEqualityFn + shallow`。
- **逻辑编排层**
  - `useRiichiGame.ts`：主编排 hook（构建 `riichiContext`，接线 store / derived / actions / flows）。
  - `useRiichiDerived.ts`：派生状态与判定（可胡/可碰杠、听牌提示、计时展示、结算预览等）。
- **动作层**
  - `actions/useRiichiRoundActions.ts`（接收 `RiichiRoundContext`，见 `shared/riichiRoundContext.ts`）
  - `actions/useRiichiClaimActions.ts`（接收 `RiichiRuntimeContext`）
  - `actions/useRiichiWinSpecialActions.ts`（ctx + extra）
- **流程层**
  - `flows/useRiichiTurnClockFlow.ts`（ctx + extra）
  - `flows/useRiichiDrawAiFlow.ts`（ctx + opts.flowDeps）
  - `flows/useRiichiClaimFlow.ts`（ctx + extra）
- **共享层（shared/）**
  - `claimTransitions.ts`：要牌「过」的纯函数 `applyClaimPassToState`。
  - `timeoutTransitions.ts`：超时出牌 `buildStateAfterTimeoutDiscard`、`appendTimeoutEvent`。
  - `abortiveDrawChecks.ts`：途中流局检查 `applyAbortiveDrawChecks`（含杠后四开杠统一入口）。
  - `flowDeps.ts`：可注入 `rng`/`schedule`（测试用）。
  - `riichiRuntimeContext.ts`：gameplay 统一上下文类型。
  - `riichiRoundContext.ts`：round/history/match 统一上下文类型。
- **纯逻辑模块**
  - `gameLogic/winResult.ts`：里宝牌补番、基础点数计算等纯函数。
  - `helpers.ts`：通用辅助逻辑。

## 2. 当前主要问题（待优化）

1. ~~重复分支~~（P5 已收敛：claim pass、超时出牌、流局检查已抽到 shared）。
2. ~~参数膨胀~~（P7 已收敛：gameplay 相关 hook 统一走 `RiichiRuntimeContext`）。
3. ~~**useRiichiRoundActions** 多参数~~（已抽 `RiichiRoundContext`，见 shared/riichiRoundContext.ts）
4. ~~**ClaimFlow 杠后四开杠** 单独分支~~（已统一：stateForAbortive + applyAbortiveDrawChecks）
5. AI/计时 **flow 内仍较复杂**（ClaimFlow/DrawAiFlow 体量 380~420 行），后续可按「AI 决策 / 状态转移」再拆，非必须。

## 3. 待做清单（优先级从高到低）

## P5 - 去重与纯函数化（推荐优先做）

- [x] 抽出 claim 阶段通用转移函数（`shared/claimTransitions.ts`）
  - 已实现：`applyClaimPassToState(g, passResult, opts?)`，供 ClaimFlow / TurnClockFlow / ClaimActions 使用
- [x] 抽出超时出牌通用函数（`shared/timeoutTransitions.ts`）
  - 已实现：`buildStateAfterTimeoutDiscard(...)`、`appendTimeoutEvent(...)`
- [x] 抽出“四家立直 / 四风连打 / 四开杠”检查组合函数（`shared/abortiveDrawChecks.ts`）
  - 已实现：`applyAbortiveDrawChecks(state)`，顺序：四家立直 → 四风连打 → 四开杠

**完成标准**
- `flows/useRiichiClaimFlow.ts`、`flows/useRiichiDrawAiFlow.ts` 重复块减少；
- 不改变现有行为；
- `pnpm run check && pnpm run test` 全通过。

## P6 - 可测试性增强

- [x] 将随机与延时从流程中可注入化（默认仍用 `Math.random` / `setTimeout`）
  - 已实现：`shared/flowDeps.ts` 的 `RiichiFlowDeps`（`rng`、`schedule`），`getRng`/`getScheduler`；`useRiichiClaimFlow`、`useRiichiDrawAiFlow` 支持可选 `flowDeps` 参数
- [x] 给关键路径补单测（建议先补纯函数层）
  - 已实现：`tests/riichi-japanese-shared.test.ts` 覆盖 `applyClaimPassToState`（next/ryuukyoku/draw、opts）、`buildStateAfterTimeoutDiscard`、`appendTimeoutEvent`、`applyAbortiveDrawChecks`（顺序与无命中）

**完成标准**
- 新增测试覆盖关键状态转移路径；
- 随机/时间相关测试可稳定复现。

## P7 - 参数收敛与上下文对象化

- [x] 为 actions/flows 引入统一上下文类型（如 `RiichiRuntimeContext`）
  - 已实现：`shared/riichiRuntimeContext.ts` 定义 `RiichiRuntimeContext`（game, setGame, addLog, addLogRef, turnClockRef, sounds, setWinResult, consumeSeatTimeBank, getElapsedSecondsForSeat, getWaitingTilesRiichi, buildYakuCtx, clockNowMs, setClockNowMs, setDeclinedRonToken, markSeatRonDeclined）
- [x] 收敛重复参数（`game`, `setGame`, `addLogRef`, `turnClockRef`, `sounds` 等）
  - 已实现：`useRiichiGame` 构建 `riichiContext` 并传入；`useRiichiClaimActions(ctx)`、`useRiichiTurnClockFlow(ctx, extra)`、`useRiichiDrawAiFlow(ctx)`、`useRiichiClaimFlow(ctx, extra)`、`useRiichiWinSpecialActions(ctx, extra)` 均改为接收上下文；`useRiichiRoundActions` 仍保留原参数（round/history/match 相关，与 gameplay 上下文分离）

**完成标准**
- actions/flows 的参数接口更短、更稳定；
- 变更单一字段时改动面更小。

## 4. 回归检查清单（每次重构必跑）

- [ ] `pnpm run check`
- [ ] `pnpm run test`
- [ ] 手动验证：
  - [ ] 超时自动出牌与时库扣减
  - [ ] 要牌阶段自动过与 AI 要牌动作
  - [ ] 流局后连庄与下一局切换
  - [ ] 立直后约束（不能吃/碰/明杠/补杠）

## 5. 约定

- 重构以“**行为不变**”为第一目标，优先做结构清理。
- 单次 PR 建议只做一个优先级阶段（例如只做 P5）。
- 新增共享函数优先纯函数 + 小接口 + 可测试。

---

## 6. 全面评估（P5/P6/P7 完成后）

### 6.1 架构总览

| 层级 | 职责 | 状态 |
|------|------|------|
| 页面 | index + components，纯 UI 与编排 | 稳定 |
| 状态 | Zustand store（game/history/winResult/clock 等） | 稳定 |
| 编排 | useRiichiGame 构建 ctx，串联 derived / actions / flows | 已收敛 |
| 派生 | useRiichiDerived（可胡/可碰杠/听牌/计时/结算预览） | 稳定 |
| 动作 | ClaimActions / RoundActions / WinSpecialActions | Claim/Win 已接 ctx |
| 流程 | TurnClock / DrawAi / Claim 三个 flow | 已接 ctx，rng/schedule 可注入 |
| 共享 | claimTransitions、timeoutTransitions、abortiveDrawChecks、flowDeps、riichiRuntimeContext | 纯函数 + 类型，可测 |

- **数据流**：store → useRiichiGame → ctx → actions/flows；derived 从 store + ref 读，供 UI 与 flow 判定。
- **算分**：和了点数由 `@/lib/riichiRsAdapter`（riichi-rs-bundlers WASM）提供，`gameLogic/winResult.ts` 做里宝牌补番与封装。

### 6.2 测试与质量

- **单测**：日麻相关共 **10 个测试文件**（含 **riichi-flow-integration**），覆盖 lib 层、**shared 纯函数** 以及 **flow 集成**（useRiichiClaimFlow 要牌自动过：next/draw/ryuukyoku 三条路径）。
- **可测试性**：ClaimFlow / DrawAiFlow 支持可选 `flowDeps`；flow 集成测用最小 ctx 渲染 harness，断言 setGame 得到的状态。
- **校验**：`pnpm run check`（tsc + biome）、`pnpm run test` 全通过即视为当前 DoD。

### 6.3 依赖与边界

- **模块内**：页面仅依赖 useRiichiGame 的返回值；不直接依赖 shared/ 或 actions/flows 内部实现。
- **跨模块**：依赖 `@/lib`（mahjongRiichi、riichiClaimFlow、riichiAbortiveDraw、riichiClock、riichiFuriten、riichiSettlement、riichiGameEnd、riichiAi、riichiRsAdapter）、`@/hooks/useRiichiSounds`。
- **边界**：日麻规则与状态全部在 `japanese/` + `lib/`；无后端，无持久化。

### 6.4 风险与注意点

1. ~~**RoundActions 未接 ctx**~~（已接 RiichiRoundContext）
2. **Flow 体积**：useRiichiClaimFlow / useRiichiDrawAiFlow 单文件约 380~420 行，逻辑集中；若再扩展 AI 或分支，可考虑按「人类/AI/超时」或「状态转移 vs 副作用」拆分。
3. ~~**四开杠与岭上**~~（ClaimFlow 杠后四开杠已统一走 applyAbortiveDrawChecks，先建 stateForAbortive 再检查）
4. **回归**：功能改动后建议跑文档第 4 节「回归检查清单」（check + test + 手动：超时出牌、要牌自动过、流局连庄、立直约束）。

### 6.5 后续可选项（非必须）

- ~~为 **useRiichiRoundActions** 引入 RiichiRoundContext~~（已完成：`shared/riichiRoundContext.ts`，useRiichiGame 构建并传入）
- ~~**ClaimFlow 杠后四开杠** 与 applyAbortiveDrawChecks 统一~~（已完成：先建 stateForAbortive 再 applyAbortiveDrawChecks）
- ~~对 **flow 的集成测试**~~（已完成：`tests/riichi-flow-integration.test.tsx` 覆盖 useRiichiClaimFlow 要牌自动过三条路径 next/draw/ryuukyoku，用最小 ctx + 首次捕获规避 Strict Mode 多次 updater）。
- 按需做 **包体/性能** 分析（`pnpm run build:analyze`），确认 WASM 与 chunk 分割合理。
