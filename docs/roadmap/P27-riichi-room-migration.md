# P27 日麻房间迁移至通用内核（可选）

> 依赖：P24–P26 全部完成**真实 NAS 现场验收**，内核无未决阻断。先读 [README](./README.md)。
> 目标：消除日麻房间与街机房间两套房间实现，降低后续维护成本。
> 状态：2026-10-16 第四轮规划确认；**是否实施在 P26 NAS 验收后由用户决定**。

## 开工门槛

- P24–P26 NAS 现场验收全部通过，且至少一段时间家庭实际使用没有内核层缺陷。
- 用户明确确认开工；如果两套实现维护成本可接受，本卡可以不做。

## 涉及文件（实施前先核对）

- [server/src/rooms/RoomManager.ts](../../server/src/rooms/RoomManager.ts)、[server/src/rooms/projectView.ts](../../server/src/rooms/projectView.ts)、[server/src/rooms/recovery.ts](../../server/src/rooms/recovery.ts)、[server/src/rooms/socket.ts](../../server/src/rooms/socket.ts) — 现有日麻房间与家庭杯。
- [server/src/riichi/runtime.ts](../../server/src/riichi/runtime.ts) — 服务端日麻运行时，适配器须复用，禁止复制规则。
- [shared/contracts/room.ts](../../shared/contracts/room.ts) — 现有日麻房间协议。
- [server/src/db.ts](../../server/src/db.ts) — `active_rooms` / `room_commands` / `family_results` / `family_cups` 等表。

## 27.1 范围

- 日麻作为内核适配器：私有视角投影、鸣牌响应窗口、托管与超时默认操作、终局牌谱归档与家庭奖励。
- 家庭杯（P20）作为内核之上的多场系列能力，未来也可用于象棋/斗地主系列赛（本卡不开放）。
- 客户端协议保持兼容或一次性切换并同步前后端；正在进行的旧房间在发布时须可恢复或明确结束，不得丢局、不得重复结算。
- 迁移后删除旧 `RoomManager` 路径，保留数据表兼容读取或做版本化迁移。

## 验收

1. P12/P13/P20 的全部本机用例与 NAS 现场证据项在新实现上复验通过（双成员整场、WS 私有视角、托管、SIGKILL/WAL 恢复、防重、杯赛）。
2. 发布时存在的进行中日麻房间可恢复；家庭战绩、杯赛榜、牌谱与奖励无变化。
3. P24–P26 街机对战回归通过。

## 不做

- 不改日麻规则、AI 或奖励口径；不借迁移顺带加新功能。

## 交接与停止条件

- 门槛未满足不得开工。迁移须有可回退的上一版发布。不擅自提交、推送或部署。
