# P12 家庭真人牌桌

> 依赖：P10/P11；共用内核服务端可运行。先读 [README](./README.md)。
> 目标：家人能在一桌真实打牌，空位AI补齐，每人只看自己的牌。
> 状态：本机交付完成（已通过全部单元测试、集成测试与工程构建；真实 NAS 部署待现场验证）。

## 交付新增文件

- `shared/contracts/room.ts` — 房间/席位/命令/私有视角玩家快照契约。
- `server/src/routes/rooms.ts` — 房间列表、创建、入座、离座、AI 配置、就绪与出牌路由。
- `server/src/rooms/RoomManager.ts` — 局域网牌桌权威生命周期、命令幂等防重与终局发奖结算。
- `server/src/rooms/projectView.ts` — 私有视角安全投影过滤（暗手牌隐私隔离、他人手牌置空并保留张数、隐藏牌山）。
- `server/src/rooms/socket.ts` — Cookie 认证 WebSocket，私有视角过滤广播通道。
- `src/lib/household/roomClient.ts` — 前端 WebSocket/HTTP 混合降级与对局动作客户端 hook。
- `src/pages/FamilyLobby.tsx` — 家庭局域网真人牌桌大厅（房间列表、东风/半庄局制、AI 难度选择、创建房间）。
- `src/pages/FamilyRoom.tsx` — 真人牌桌等待室与对局界面（本人暗手牌投影、对手手牌背、牌河、鸣牌吃碰杠荣、15s倒计时、局结算弹窗）。
- `src/pages/mahjong/japanese/usePlayerSeatView.ts` — 绝对座次到本人相对方位（自家/下家/对家/上家）投影映射。
- `tests/household-room-server.test.ts` — 房间创建、多真人加入、AI自动补齐、私有视角暗牌隔离与2真人终局雀币发奖测试。
- `tests/household-seat-view.test.ts` — 席位视角映射与算法测试。

## 验收：本机（已验证）

1. [x] 2真人+2AI、1真人+3AI分别验证，1真人桌不发家庭金库奖励，2真人完赛各成员独立获得家庭雀币。
2. [x] 0/1/2/3 号不同 viewerSeat 相对视角转换映射已验证（自家永在下方，右侧下家，对面对家，左侧上家）。
3. [x] 实际 HTTP 与 WS 响应严格进行隐私遮蔽过滤：他人暗手牌置空，牌山隐藏，重复命令拒绝。
4. [x] 命令幂等性通过 `commandId` 校验拦截重放。
5. [x] 自动化测试 `tests/household-room-server.test.ts` 与 `tests/household-seat-view.test.ts` 全绿通过。

## 验收：真实 NAS（当前待现场验证）

1. [ ] 家中多台实际设备完成整场、NAS AI响应性能、连接数与本地反代WebSocket核对。

## 不做

- 不做公网匹配、观战、聊天、语音，不允许客户端持有完整牌局权威状态。

## 交接与停止条件

- 只实施 P12；先读总纲、依赖任务卡与上述真实代码路径，不把计划新增文件当现有能力。
- 先完成本机可验收部分；NAS不可达不是停止本地开发的理由，但不得把NAS项标为通过。
- 如前置契约尚未实现或存在矛盾，先给出具体文件/调用链证据，解决前置边界后再推进，禁止用假接口或第二套规则绕过。
- 每个小批次记录变更和检查证据；阶段完成时更新本卡状态，未验证项继续明确保留。
- 不擅自提交、推送、部署；新增测试或运行测试按当前明确授权执行，不建立额外测试体系。
