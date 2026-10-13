Original prompt: 可以 提交然后 p6吧

## 2026-10-11

- P5 已提交并推送到 `origin/codex/p3`：`e5e43a0`。P4 为 `8760cb4`。
- 当前目标：完整实施 `docs/roadmap/P6-arcade.md`，保持 16 个现有副玩法，不新增游戏。
- 已阅读路线图、GameShell、GameResultOverlay、统计、奖励与任务入口。先统一按难度的存档和结算，再迁移棋类/扑克、十个小游戏，最后逐项浏览器验收。
- 验收环境：本地开发地址 `http://127.0.0.1:5173`；Windows Edge 与内置 Playwright。隔离浏览器存档验证，不改用户实际浏览器数据。
- 注意：`pnpm check` 会自动格式化无关文件；记录本阶段已修改路径，检查后仅还原无关格式化改动。现有基线为 71 条 warning、1 条 info。

- 已完成：16 个副玩法统一外壳、按难度记录与奖励，每日 2 日麻 + 1 街机、每周 1 街机、64 个副玩法 + 4 个日麻成就及分组、大厅/分类个人最佳徽章。
- 已运行技能自带 Playwright 客户端（仅适配本机 Edge 与 Playwright 运行时），2048 两轮键盘操作、文本状态与截图检查正常。
- 回归测试发现：原三子轮换井字棋存在先手必胜局面。困难档使用标准九格 minimax 和满盘和棋规则，以保证不败；普通/随机档保留三子轮换。页面规则明确显示。
- 已完成：全套 16 个副玩法统一 GameShell 外壳、暂停/继续与难度设置、个人最佳与结算遮罩移动端响应式适配已验证。490 项自动化回归与交互测试全部通过，构建通过。

## 2026-10-13 P8 收尾

- 状态：P8 本机验收完成（任务卡与 README 已更新）；NAS/家庭设备仍为待现场验证，未标记通过。
- 代码层：`pnpm typecheck`、`pnpm build` 均通过。
- 浏览器验收（dev server :3000，Playwright + Chromium，隔离存档，截图与报告在 `output/verify/p8/`）：主要页面 × 桌面 1440×900/手机 390×844 无溢出无报错；日麻四尺寸实际开局后无手牌裁切/无操作遮挡/无横向滚动（1440×900 入场动画瞬态超界为 0 稳态）；深色与英文切换通过；16 个副玩法全部通过且 GameShell 顶栏在位；商店装备 ↔ 牌桌 `data-tile-back` 状态一致。
- 遗留：NAS 现场验收；锁定牌背（金箔等）解锁后的实战显示复核。两者均需真实解锁流程/现场设备，不可在本地标记通过。

## 2026-10-13 P9 牌桌交互与视听品质收尾

- 状态：P9 本机验收完成（`docs/roadmap/P9-table-experience.md` 与 `docs/roadmap/README.md` 已同步更新）；NAS 真实移动真机项目明确保留为待现场验证。
- 代码层与实现：
  1. 统一选牌交互：新建 `useTileInteraction.ts`，首点/首触手牌浮起选中（+8px 金色阴影、`aria-pressed="true"`、`.riichi-tile--selected`），再点或点击出牌栏确认打出。键盘 ArrowLeft/Right 循环合法选牌，Enter 确认出牌，Esc 退出选择/立直/鸣牌。
  2. 触控滚动保护与触控区保底：滑动位移 > 10px 判定为滚动自动放弃选牌/出牌；轻触后 650ms 内防抖拦截移动端合成 click 事件防误打。选牌操作栏确认/取消按钮具备 `min-height: 44px` 触控保底；顶部快速静音按钮具备 `min-w-11 min-h-11` (44px)。日式暗杠两端暗扣（`TileBack`）、中间两张翻开。
  3. 静音与偏好持久化：顶部一键静音按钮与对局设置面板 SFX/Voice 滑动条双向联动，立即切断 Web Audio 与 TTS 朗读，状态存入 localStorage；演出模式（full/simple/off）支持简化与关闭；`table-feedback.css` 与 `presentation.css` 提供 `@media (prefers-reduced-motion: reduce)` 适配。
  4. 恢复存档与段位隔离：恢复存档时不重复播放特效与音效；AI 段位对局下危险度提示强行关闭并隐藏设置项。新手操作指引（`NoviceControlsGuide`）一次性卡片，点击确认后存储并在后续对局静默。
- 测试与构建验证：
  - `pnpm typecheck`：通过（0 error）。
  - `pnpm test`：全仓 65 个测试套件，499 项测试全部通过（含新建的 `riichi-p9-interaction.test.tsx` 6 项测试与 `riichi-p9-e2e.test.tsx` 2 项端到端测试）。
  - `pnpm build`：成功产出静态资源。
- 遗留：实际手机音频首次手势解锁、低性能设备现场检查（须依赖真实 NAS 部署与现场真机，已明确保留为待现场验证）。

## 2026-10-13 P10 家庭成员与 NAS 服务（本机实施）

- 状态：P10 本机服务、契约、API Client、Context 状态机、UI 入口及数据隔离已全部实施并通过验收；真实 NAS 部署与局域网反代明确保留为待现场验证。
- 代码层与实现：
  1. 共享契约与 API：`shared/contracts/member.ts` 与 `shared/contracts/api.ts` 规范化 `HouseholdMode`、`MemberSummary`、`MemberSnapshot` (schema 1, revision) 与 API 错误。
  2. 客户端封装与存储隔离：`src/lib/household/api.ts` 封装同域通信；`snapshotStorage.ts` 实现 `MemoryStorage` 与快照字段双向映射；`src/lib/storage.ts` 支持可插拔 `activeDriver`，实现成员登录与本地游客 localStorage 零冲突绝对隔离。
  3. 会话与上下文管理：`src/contexts/HouseholdContext.tsx` 管理 `deviceId`、服务心跳探测、双模式切换、登录/登出/刷新、权威购买与旧存档一次性迁移。
  4. 界面与交互入口：`src/components/household/MemberSelector.tsx` 在主导航栏集成家庭成员选择与 4 位 PIN 数字小键盘（支持软键盘与物理键盘、防刷锁定）；`src/pages/Shop.tsx` 在线模式下路由至服务端权威购买事务；`src/components/profile/DataManagementCard.tsx` 集成旧游客存档安全迁移至成员云端（带自动备份与单次防重）。
  5. 国际化支持：`src/lib/i18n.ts` 补充完整的中英文 `household.*` 界面文案与统一错误映射。
- 测试与验证：
  - `server/src/riichi/gate.ts`：Node 24/22 环境无头跑通整局日麻（90 events 顺利和牌），10.1 运行门禁通过。
  - 新增测试用例：`tests/household-storage.test.ts`、`tests/household-api.test.ts`、`tests/household-server.test.ts`、`tests/household-interaction.test.tsx`。
  - `pnpm typecheck`：通过（0 error）。
  - `pnpm test`：全仓 69 个测试套件，514 项测试 100% 全部通过。
  - `pnpm build`：Rsbuild 0.43s 生产打包成功。
- 遗留：真实 NAS 环境（ARM/x86 Docker 容器运行、SQLite 卷持久化权限、局域网 HTTPS/反代现场联调，待现场验证）。

