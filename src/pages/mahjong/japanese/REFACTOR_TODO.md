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
  - `useRiichiGame.ts`：主编排 hook（接线 store / derived / actions / flows）。
  - `useRiichiDerived.ts`：派生状态与判定（可胡/可碰杠、听牌提示、计时展示、结算预览等）。
- **动作层**
  - `actions/useRiichiRoundActions.ts`
  - `actions/useRiichiClaimActions.ts`
  - `actions/useRiichiWinSpecialActions.ts`
- **流程层**
  - `flows/useRiichiTurnClockFlow.ts`
  - `flows/useRiichiDrawAiFlow.ts`
  - `flows/useRiichiClaimFlow.ts`
- **纯逻辑模块**
  - `gameLogic/winResult.ts`：里宝牌补番、基础点数计算等纯函数。
  - `helpers.ts`：通用辅助逻辑。

## 2. 当前主要问题（待优化）

1. `flows` 与 `actions` 中仍有**重复分支**（特别是 claim pass / 摸打转移 / 流局分支）。
2. 个别 hook 参数较多，**上下文对象缺失**，后续改字段会连锁改很多签名。
3. AI 与计时逻辑耦合在 flow 中，**可测试性一般**（随机/延时路径较多）。
4. 缺少重构导向文档里的“完成定义”（DoD）与回归清单。

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
