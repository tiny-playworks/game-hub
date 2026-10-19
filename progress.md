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
- 2026-10-14 复核更正：`riichi-p9-e2e.test.tsx` 仅覆盖开局后的选牌、静音、引导与模拟触控防滚，未完成鸣牌、立直、和牌、下一局的整场验证。当前状态以任务卡为准；本机基础交互可用，完整操作链与真机音频待验。
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

## 2026-10-13 P10 家庭成员与 NAS 服务（本机实施；见 2026-10-14 状态更正）

- 状态更正：上述模块已实现，但日麻奖励/段位仍可能只落在客户端临时快照，P10 本机权威结算尚未完成；真实 NAS 部署与局域网反代也待现场验证。
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
- 遗留：日麻服务端权威结算与可信结果校验、真实 NAS 环境（Docker 容器运行、SQLite 卷持久化权限、局域网反代现场联调）。

## 2026-10-14 P8–P10 本机补充

- P8：没有改动视觉资产；原任务卡保留 NAS/家庭设备与已解锁牌背实战检查。
- P9：静音时主动停止正在播放的语音、TTS 和合成音效；移动端首次手势解锁后复用 AudioContext。浏览器确认按钮状态切换，真实设备的可听效果仍待现场验证。
- P10：成员身份变化会清空日麻内存对局；本机两成员从 A 开局切到 B，B 钱包为 0 且日麻显示新局设置。模拟 401 后，页面显示重新登录提示并退出成员状态；桌面和手机宽度截图已核对。服务端改用 vanilla store，独立依赖与 CI Node 24 已同步；仅安装生产依赖的临时目录中服务成功启动，`/healthz` 返回 `{"status":"ok"}`。前后端类型检查、构建、lint 通过。本轮未新增或运行自动化测试，也未构建 Docker 镜像、连接 NAS、提交或推送。

## 2026-10-14 P11 跨设备续玩与离线同步（已交付分支 codex/p11-save-sync）

- 代码与契约层：
  1. `shared/contracts/sync.ts` 定义离线凭据、批量同步请求/响应与多设备续局契约。
  2. `server/src/db.ts` 扩展 `offline_receipts`（防重审计表）与 `resume_saves`（跨设备续局表）。
  3. `server/src/services/progression.ts` 实现离线凭据重放校验与防作弊发奖。
  4. `server/src/routes/sync.ts` 实现 `POST /api/v1/sync` 批量归并与 `/api/v1/saves` 续局管理。
  5. `src/lib/household/offlineDb.ts` 与 `src/lib/household/sync.ts` 实现客户端 IndexedDB 成员隔离队列与网络监听。
  6. `src/components/household/SyncStatus.tsx` 与 `ResumeSavePicker.tsx` 完成全局同步状态机与选档弹窗。
- 测试与验证：全仓 76 个测试套件，538 项测试全部通过，分支已提交推送到 `origin/codex/p11-save-sync`。

## 2026-10-14 P12 家庭真人牌桌（当前分支 codex/p12-family-multiplayer）

- 目标：局域网内家人在同一牌桌实时对局，空位 AI 自动补齐，严格进行暗手牌隐私隔离投影，2+ 真人完赛自动发放家庭雀币。
- 代码与契约层：
  1. `shared/contracts/room.ts`：定义房间生命周期、席位（human/ai/empty）、命令协议与私有视角快照 `PlayerViewSnapshot`。
  2. `server/src/rooms/RoomManager.ts`：串行管理房间生命周期、入座/离座/AI配置、就绪开局、指令幂等防重与终局发放家庭雀币结算。
  3. `server/src/rooms/projectView.ts`：私有视角安全投影过滤（暗手牌隐私隔离、他人手牌置空并保留手牌张数 `tileCount`、隐藏活牌山）。
  4. `server/src/rooms/socket.ts`：基于 Fastify HTTP 实例的 Cookie 认证 WebSocket，向各真人席位分发各自对应的私有视角。
  5. `src/lib/household/roomClient.ts`：客户端 WebSocket / HTTP 混合降级 hook 与动作调度器。
  6. `src/pages/mahjong/japanese/usePlayerSeatView.ts`：绝对座次到本人相对视角（自家/下家/对家/上家）投影映射。
  7. `src/pages/FamilyLobby.tsx` 与 `src/pages/FamilyRoom.tsx`：家庭大厅房间列表、规则设置、等待室准备、真人牌桌实战与局结算弹窗。
  8. `rstack.config.ts` 与 `deploy/nas/nginx.household.conf`：配置 `/ws` 的 WebSocket 代理与 Upgrade 请求转发。
- 测试与验证：
  - 新增测试套件：`tests/household-room-server.test.ts`（5 项集成测试）与 `tests/household-seat-view.test.ts`（3 项算法测试）。
  - 全仓类型检查：`pnpm typecheck`（`src/`、`tests/`、`server/`）通过（0 error）。
  - 全仓测试执行：`pnpm test` 全仓 78 个测试套件，546 项测试 100% 全部通过。
  - 生产打包构建：`pnpm build` 成功通过（0.41s）。
- 遗留：真实 NAS 局域网真机现场联调（已明确保留为待现场验证）。

## 2026-10-14 P13 重连、托管与服务恢复（当前分支 codex/p13-reconnect-autoplay）

- 目标：掉线可重连，AI 临时接手，多设备控制租约隔离，服务重启不丢牌局与防重复结算。
- 代码与契约层：
  1. `shared/contracts/room.ts`：扩展 `HumanSeat`（`leaseDeviceId`, `connected`, `disconnectedAt`, `isAutoplay`）、`PlayerSeatPrivateState`（`hasControlLease`）、`RoomSummary` 与 `PlayerViewSnapshot`（`isPaused`），新增 `takeover_control`, `toggle_autoplay`, `resume_game` 指令与 `lease_lost` 消息类型。
  2. `server/src/db.ts`：新增 `active_rooms` 与 `room_commands` 状态表与指令防重流水表。
  3. `server/src/rooms/recovery.ts`：实现牌桌与指令流水的持久化、重启恢复加载与终局清理。
  4. `server/src/rooms/controlLease.ts`：实现多设备控制权租约管理（`takeoverSeatControl`）、60s 离线宽限期判断（`shouldTriggerAutoplay`）与掉线时间戳标记。
  5. `server/src/rooms/RoomManager.ts`：整合崩溃自动恢复（构造函数加载 `loadActiveRooms`）、60s 宽限期与 AI 自动摸打托管、多设备抢控拦截与定向通知、全真人离线自动暂停（`isPaused = true`）与真人重连自动唤醒。
  6. `server/src/rooms/socket.ts` 与 `server/src/rooms/projectView.ts`：向非租约设备下发只读视角（`hasControlLease: false`, `turnOptions: null`），抢控时发送 `lease_lost`。
  7. `src/components/household/ConnectionNotice.tsx` 与 `src/lib/household/roomClient.ts`：实现网络状态、托管提示、抢控提示与全离线暂停唤醒条，支持一键接管控制权。
- 测试与验证：
  - 新增测试套件：`tests/household-room-recovery.test.ts`，覆盖 5 大核心场景（60s 宽限期默认摸切、超 60s AI 托管与重连解除、多设备抢控租约与只读隔离、崩溃重启恢复与幂等发奖、全真人离线自动暂停与重连唤醒）。
  - 全仓类型检查：`pnpm typecheck`（`src/`、`tests/`、`server/`）通过（0 error）。
  - 全仓测试执行：`pnpm test` 全仓 79 个测试套件，551 项测试 100% 全部通过。
  - 生产打包构建：`pnpm build` 成功通过（0.43s）。
- 遗留：真实 NAS 容器实际重启、家庭 Wi-Fi 抖动与移动端锁屏后台恢复（已明确保留为待现场验证）。

## 2026-10-14 P14 AI 与竞技可信度（当前分支 codex/p14-ai-ranked-quality）

- 目标：对手档位与角色打法可解释，客户端与服务端 AI 决策完全统一，严守零作弊底线与毫秒级决策性能。
- 代码与工具层：
  1. `scripts/compare-riichi-ai.ts`：实现本地固定种子对局仿真基准工具，收集四档 AI 顺位、得点、放铳率、和牌率与单步决策毫秒级耗时。
  2. `src/pages/mahjong/japanese/engine/ai.ts` 与 `aiStrategy.ts`：纯函数设计，保持向听效率优先、攻守评估（全押/弃和/折中打现物与筋牌）、终局点差（All Last 逆转与保位）及角色倾向微调。
  3. 客户端与服务端一致性：浏览器端与 Node 服务端（`server/src/riichi/runtime.ts`）完全复用同一纯函数规则与 AI 决策内核，杜绝多套逻辑。
- 测试与验证：
  - 新增测试套件：`tests/riichi-p14-quality.test.ts`，覆盖 5 大测试项：
    * 测试项 1: 固定场景同档绝对确定性与跨档位防守差异（面对立直弃和打现物 1m）。
    * 测试项 2: 绝不窥探他家暗手牌或牌山（扰动他家暗手牌后自家决策 100% 相同）。
    * 测试项 3: 角色打法风格在相同局面下的可解释差异（rin 偏副露，mio 偏防守门清）。
    * 测试项 4: 终局点差与排位意识（尾巡领先保位与落后做大牌逆转）。
    * 测试项 5: 固定种子对比基准与毫秒级决策性能（单步耗时稳定在 0.5ms ~ 2ms，远超 20ms 要求）。
  - 全仓类型检查：`pnpm typecheck`（`src/`、`tests/`、`server/`）通过（0 error）。
  - 全仓测试执行：`pnpm test` 全仓 80 个测试套件，556 项测试 100% 全部通过。
  - 生产打包构建：`pnpm build` 成功通过（0.40s）。
- 遗留：真实 NAS 上完整半庄多桌并发下的 CPU 耗时与吞吐量现场核对（已明确保留为待现场验证）。




## 2026-10-15 NAS 收尾验收与正式发布

- 程序基线 dev/fe79089，正式静态 nas-closeout-20261015d，8089 前后端健康并比对版本；165 资源 SHA-256、深链、MIME/缓存及旧资源保留通过。
- 补齐成员离线/自由局续接/街机队列和跨设备续玩、家庭持久防重/租约连接计数/恢复/独立家庭奖励、非行动席私有动作投影，以及大厅巡礼标题布局。
- 前端/测试/服务端类型、规范检查通过；83 套件 574/574 项测试及生产构建通过。
- 真实 NAS 隔离环境双成员完整家庭局（359 事件，120/90 雀币）、68 秒断线托管、SIGKILL/WAL 恢复与防重；单人桌无奖。并发自由半庄/段位、四档 AI、牌谱权限/训练、P16 挑战、P17/P18 页面闭环通过。
- 正式两名成员的原 PIN 登录通过，快照散列与 revision 发布前后相同；一致性备份、旧静态/API 保留。NAS QA 手动回滚及健康失败回退通过，邻接媒体服务未改动。
- 真实 NAS 上的多设备证据来自独立客户端/deviceId；实体手机音频/触控/后台及 Wi-Fi 体验仍可补充，P17 等玩家反馈后再决定 P19。没有构建 EXE，没有开始 P19–P21。
- 完整证据与回退见 docs/roadmap/NAS-ACCEPTANCE-2026-10-15.md；两份交接和 P7–P18 状态已同步。

## 2026-10-19 P22 非 NAS 项与第 10 名角色（椿 / Tsubaki）完成 + P23 家庭排行榜与动态全栈交付

- **P22 本地迁移演练工具**：
  1. `server/src/cli/migrate-check.ts`：只读复制指定 SQLite 数据库并在临时目录演练迁移，核对成员快照散列、revision、全部 10 关 `journey_attempts` CHECK 约束、`family_cups*` 与 P23 榜单/动态表。
  2. `tests/p22-migration-rehearsal.test.ts`：覆盖从旧版 3 关 schema 平滑升级至最新 schema 且成员快照零改动。
- **P22.3 第 10 名角色（椿 / `tsubaki`）与巡礼第 10 关收束关（`tsubaki-finale`）全量接入**：
  1. 资产：`src/assets/characters/tsubaki/` 下 `avatar.webp` (256×256) 与 `normal.webp` / `happy.webp` / `frustrated.webp` (1024×1536) 已挂载至 `src/assets/characters/index.ts` 与 `CharacterStoryPlayer.tsx`。
  2. 名册与解锁：`CHARACTER_DEFS` 末尾追加 `tsubaki`（保持前 9 名角色顺序与外观 ID 不变，自动派生好感 3 阶和牌特效 `win-tsubaki` 与 4 阶头像框 `frame-tsubaki`）；解锁规则新增 `{ type: 'journey-stage', target: 'tsubaki-finale' }`，通关第 10 关收束关后自动解锁并可选为主角色。
  3. 巡礼第 10 关：`shared/contracts/journey.ts`、`src/lib/riichiJourney.ts`、`server/src/db.ts`、`src/pages/Journey.tsx` 与 `src/lib/journeyMessages.ts` 扩展 `tsubaki-finale`（山茶雀庄 · 终局茶席，目标：不放铳且净得 ≥ +2000 点，或听牌不失分收官）。
  4. 逆风翻盘 AI：`src/pages/mahjong/japanese/engine/aiStrategy.ts` 与 `ai.ts` 支持 `comebackBias`（仅依据公开点差：落后时降低弃和压力并提高立直/打点进攻性，大幅领先时优先稳健收手保位）。
  5. 双语文案：`src/lib/tsubakiMessages.ts` 提供完整中英双语角色档案、标签、外观名、9 类牌桌语音、闲聊与 4 阶段好感故事。
- **P23 家庭排行榜与动态（服务端 + 前端界面全量交付）**：
  1. 服务端：`shared/contracts/leaderboard.ts`、`server/src/services/leaderboard.ts`、`server/src/services/arcadeLimits.ts`、`server/src/routes/leaderboard.ts`、`server/src/cli/leaderboard.ts` 及 `tests/p23-leaderboard.test.ts`（12 项测试全部通过）。
  2. 前端界面：`src/pages/Leaderboard.tsx`（按分类/游戏/难度切换、历史/本周标签、成员成绩榜与 100 条家庭动态流、游客/离线模式安全提示）、`src/components/game/FamilyStandingPill.tsx`（GameShell 与分类页实时显示家庭 #N / 本周 #N 与距上一名分差）、`src/components/game/GameResultOverlay.tsx`（结算遮罩显示家庭名次、周名次、距上一名分差与刷新家庭纪录金标提示）、`src/components/home/FamilyFeedLobbyPanel.tsx`（大厅家庭动态卡片）、`src/components/profile/WeeklyChampionsCard.tsx`（个人资料页周冠军徽记与荣誉头衔展示）及 `tests/p23-leaderboard-ui.test.tsx`（5 项 UI 测试全部通过）。
- **验证**：`pnpm typecheck`、`pnpm lint`、`pnpm test`（87 个测试文件、614 项测试全部通过）、`pnpm build` 与 `cd server && pnpm build` 全部通过。

