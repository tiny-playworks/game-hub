# P13 重连、托管与服务恢复

> 依赖：P12正常联机全流程通过。先读 [README](./README.md)。
> 目标：掉线可重连，AI临时接手，服务重启不丢牌局或重复结算。
> 状态：本机验收完成；真实 NAS 待现场验证。

## 涉及文件（先读）

- [src/pages/mahjong/japanese/engine/match.ts](../../src/pages/mahjong/japanese/engine/match.ts) — 事件重放与turn版本。
- [src/pages/mahjong/japanese/engine/ai.ts](../../src/pages/mahjong/japanese/engine/ai.ts) — 临时AI动作。
- [src/pages/mahjong/japanese/useHumanRemainingSeconds.ts](../../src/pages/mahjong/japanese/useHumanRemainingSeconds.ts) — 服务器截止时间显示的迁移入口。
- [src/lib/riichiClock.ts](../../src/lib/riichiClock.ts) — 计时与默认操作。

## 已新增文件

- `server/src/rooms/recovery.ts` — 事件/截止时间持久化与重启恢复（`active_rooms` 与 `room_commands`）。
- `server/src/rooms/controlLease.ts` — 控制设备切换与 60s 掉线宽限期判断。
- `src/components/household/ConnectionNotice.tsx` — 连接/托管/重新接手状态横幅。
- `tests/household-room-recovery.test.ts` — 覆盖 5 大重连、托管、抢控与崩溃恢复核心场景。

## 接口与数据边界

- 跨阶段的模式、成员、快照、凭据、API、房间、奖励和托管规则以 [README 第4节](./README.md#4-跨阶段统一契约唯一来源) 为准，不在此定义不同版本。
- 保留旧 schema、既有业务状态和原入口；新增结构带版本及 normalize。前置阶段计划新增文件须先核对实际实现。

## 13.1 掉线规则

执行总纲4.5；服务器根据连接心跳判离线，60秒后AI接手，宽限内正常超时默认操作。断线前已提交但未收到ack的命令重传保持同一commandId。

## 13.2 重连与接管

返回玩家最新快照与revision，清空过期本地按钮/动画。本人下个决策点接管；同档案新设备明确申请接管，旧设备只读；他人不能接管。

## 13.3 持久化恢复

每次接受动作先记录事件/版本/截止时间后广播；服务重启重放并恢复未完桌。重复恢复与结算依赖SQLite唯一约束。全真人离线暂停，重连后重新建立合理倒计时，不把离线时间变无限连续摸切。

## 13.4 房主与清理

进行中房主离开不解散；等待室房主离开可移交最早入座真人，全部离开30分钟后清理空房。活动牌局不会按空房清理删除。

## 验收：本机（已完成）

1. **场景 1 掉线 60s 宽限期**: 断线 60s 宽限期内保持真人状态（`isAutoplay: false`），单步超时由服务器执行默认摸切/过牌保底，防止牌局卡死。
2. **场景 2 超过 60s 触发托管与重连解除**: 掉线超过 60s 后 `scheduleNextTurn` 自动标记 `isAutoplay = true` 并由服务端 AI 迅速推进；重连后发出操作指令自动解除托管。
3. **场景 3 多设备控制权租约隔离**: 租约持有者才能提交对局指令；非租约设备操作被拒绝（`409 CONTROL_LEASE_LOST`）；通过 `takeover_control` 指令明确抢占控制权，旧设备 WebSocket 收到 `lease_lost` 并将视角操作选项清空为只读观战。
4. **场景 4 崩溃重启恢复与幂等发奖**: 牌局状态与指令流水持久化至 SQLite（`active_rooms`, `room_commands`）；新建 `RoomManager` 实例自动恢复未完牌局；终局自动结算且清理活动房间，防重发奖。
5. **场景 5 全真人离线自动暂停**: 牌局内所有真人离线时自动设置 `isPaused = true` 并冻结倒计时；任意真人重连自动唤醒并恢复出牌。

全部 79 个测试套件，551 个测试用例全部通过（`tests/household-room-recovery.test.ts` 5/5 通过），`pnpm typecheck` 与 `pnpm build` 零警告零错误。

## 验收：真实 NAS（当前待现场验证）

1. NAS容器实际重启/家庭Wi-Fi抖动/手机切后台与锁屏恢复。

## 不做

- 不以浏览器定时器决定超时，不做公网高可用、多节点分布式房间。

## 交接与停止条件

- 只实施 P13；先读总纲、依赖任务卡与上述真实代码路径，不把计划新增文件当现有能力。
- 先完成本机可验收部分；NAS不可达不是停止本地开发的理由，但不得把NAS项标为通过。
- 如前置契约尚未实现或存在矛盾，先给出具体文件/调用链证据，解决前置边界后再推进，禁止用假接口或第二套规则绕过。
- 每个小批次记录变更和检查证据；阶段完成时更新本卡状态，未验证项继续明确保留。
- 不擅自提交、推送、部署；新增测试或运行测试按当前明确授权执行，不建立额外测试体系。
