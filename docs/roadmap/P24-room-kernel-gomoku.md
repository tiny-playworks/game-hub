# P24 通用房间内核 + 五子棋对战

> 依赖：P22 完成 NAS 基线；P12/P13 房间、租约、重连、恢复的已验收实现作为参考。可与 P23 并行。先读 [README](./README.md)。
> 目标：抽出与游戏无关的家庭房间内核，用规则最简单的五子棋跑通“家人对战”整条链路。
> 状态：2026-10-16 第四轮规划确认，未开始。

## 涉及文件（实施前先核对）

- [server/src/rooms/RoomManager.ts](../../server/src/rooms/RoomManager.ts) — 现有日麻房间（与 `RiichiMatchState` 强耦合）；**本阶段只读参考，不修改**。
- [server/src/rooms/controlLease.ts](../../server/src/rooms/controlLease.ts)、[server/src/rooms/recovery.ts](../../server/src/rooms/recovery.ts)、[server/src/rooms/socket.ts](../../server/src/rooms/socket.ts) — 租约、恢复、WS 认证；可抽取为共享工具，但日麻行为须保持不变。
- [shared/contracts/room.ts](../../shared/contracts/room.ts) — 现有房间协议，保持兼容。
- [src/lib/gomoku.ts](../../src/lib/gomoku.ts)、[src/lib/gomokuAi.ts](../../src/lib/gomokuAi.ts) — 无依赖纯函数引擎，服务端直接复用。
- [src/pages/GameGomoku.tsx](../../src/pages/GameGomoku.tsx)、[src/components/game/IntersectionBoard.tsx](../../src/components/game/IntersectionBoard.tsx) — 单人页面与棋盘组件。
- [src/pages/FamilyLobby.tsx](../../src/pages/FamilyLobby.tsx)、[src/lib/household/roomClient.ts](../../src/lib/household/roomClient.ts)、[src/components/household/ConnectionNotice.tsx](../../src/components/household/ConnectionNotice.tsx) — 大厅、客户端连接与提示。

计划新增：`shared/contracts/gameRoom.ts`、`server/src/gameRooms/`（内核、适配器注册、持久化）、`server/src/gameRooms/adapters/gomoku.ts`、`src/pages/FamilyGameRoom.tsx`。

## 24.1 内核与适配器边界

内核负责：房间生命周期（`waiting | playing | paused | finished`）、席位（human / ai / empty）、房主设置与准备、控制租约与多设备接管、断线检测、命令幂等与 `expectedRevision`、持久化与重启恢复、超时调度、结算落盘与家庭动态写入。

适配器只实现游戏相关接口（命名实施时定）：

- `init(seed, settings, seats)`、`currentActors(state)`、`validate(state, seat, action)`、`apply(state, seat, action)`
- `projectView(state, viewer)` — 本人视角；完全信息游戏可直接返回全量
- `aiAction(state, seat, level)`、`defaultTimeoutAction?(state, seat)`
- `result(state)` — 终局时返回各席胜/负/和与指标
- 静态声明：`gameId`、席位数、最少真人数、`timeoutPolicy: 'pause-on-disconnect' | 'autoplay-after-grace'`、是否支持观战

协议：新 `shared/contracts/gameRoom.ts`，沿用总纲 4.4 的命令信封 `{ protocol, commandId, roomId, expectedRevision, type, payload }` 与 `room / match / ack / error` 事件。REST 用新前缀（如 `/api/v1/game-rooms`），WebSocket 复用 `/ws` 连接与认证，以消息类型区分；**现有日麻房间消息与行为不得改变**。

## 24.2 五子棋对战规则

- 2 席；房主可将对手席设为 AI（沿用单人档位）用于体验，但 1 真人 + AI 不发奖、不进对线表。
- 规则沿用现有 `gomoku.ts`；房主选择先手（猜先 / 房主执黑 / 对方执黑）。
- `timeoutPolicy = 'pause-on-disconnect'`：默认不限时；一方掉线即暂停，等待重连，不由 AI 代走。
- 解锁规则：暂停满 **10 分钟**后，任一在线方可发起“结束对局（不计胜负、不发奖）”；暂停超过 **24 小时**由服务端自动作废；在线方随时可**认输**。
- 提和、悔棋请求、局时与观战在 P25 加入内核，届时五子棋同样获得。

## 24.3 结算、对线表与并发限制

- 新来源 `matchSource = 'family-arcade'`（更新总纲 4.1 与真实/Mock 结算链），不冒用 `arcade` 或 `family`。
- 至少 2 名真人完赛且本人未主动退出（认输视为完赛告负）才发雀币：沿用街机单局奖励公式，与家庭日麻**共享每人每日 200** 上限；服务端唯一键 `(memberId, matchId, source)` 防重。
- 真人对战**不计入**个人 vs AI 的连胜、个人最佳、街机成就与 P23 排行榜。
- 家人对线表：按游戏记录每对成员之间的胜 / 负 / 和，不做等级分；在大厅和个人页可查看。作废与“结束对局”不计入。
- 不开放离线上报入口。
- 全局一人一局：服务端在入座/开局时检查该成员是否已有进行中的日麻房间、AI 段位局或其他对战房间，有则拒绝并提示去向。

## 24.4 入口与界面

- 现有家庭大厅增加游戏筛选（日麻 / 五子棋，后续象棋、斗地主），合并两类房间列表；建房时选游戏。
- 五子棋单人页增加“邀家人对战”快捷入口，直达建房并预选五子棋。
- 对战页复用 `IntersectionBoard`，显示双方头像、执子、轮到谁、连接状态、暂停/结束对局/认输操作；结束后显示结果、对线表更新与“再来一局”（保留座位，交换先手）。

## 验收

1. 两台设备两名成员完成五子棋对战整局：胜负、雀币（含与家庭日麻共享上限）、对线表、家庭动态正确且只结算一次。
2. 掉线即暂停；10 分钟后“结束对局”与 24 小时自动作废不计胜负不发奖；认输正确结算。
3. 重复 commandId、过期 revision、非本人回合、非租约设备的命令均被拒且返回最新视角；双设备接管后旧设备只读。
4. NAS 服务重启（含 SIGKILL）后进行中/暂停中的对局恢复，不重复结算。
5. 全局一人一局：已在日麻房间或段位局中的成员无法入座对战房间，反之亦然。
6. 现有日麻家庭桌与家庭杯回归通过（P12/P13/P20 关键用例），协议与行为无变化。
7. 中英文、浅/深色、桌面/手机截图核对大厅筛选、对战页、结果页；NAS 现场记录另做。

## 不做

- 不迁移日麻房间（见 P27）、不做实时动作类小游戏联机、不做公网匹配。

## 交接与停止条件

- 先读日麻房间真实调用链再设计内核；如需抽取共享工具，先补日麻回归再改。
- 新协议、表结构版本化，并同步总纲 4.1 / 4.7。不擅自提交、推送或部署；新增/运行测试依当前用户授权。
