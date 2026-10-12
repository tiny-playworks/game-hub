# P12 家庭真人牌桌

> 依赖：P10/P11；共用内核服务端可运行。先读 [README](./README.md)。
> 目标：家人能在一桌真实打牌，空位AI补齐，每人只看自己的牌。
> 状态：待实施。任务内容尚未代表实现或验收。

## 涉及文件（先读）

- [src/pages/mahjong/japanese/engine/match.ts](../../src/pages/mahjong/japanese/engine/match.ts) — 任意seat事件/合法校验。
- [src/pages/mahjong/japanese/engine/round.ts](../../src/pages/mahjong/japanese/engine/round.ts) — 鸣牌响应窗口。
- [src/pages/mahjong/japanese/engine/ai.ts](../../src/pages/mahjong/japanese/engine/ai.ts) — 任意seat AI。
- [src/pages/mahjong/japanese/useRiichiViewModel.ts](../../src/pages/mahjong/japanese/useRiichiViewModel.ts) — 当前自家固定0。
- [src/pages/mahjong/japanese/useRiichiAutomation.ts](../../src/pages/mahjong/japanese/useRiichiAutomation.ts) — 浏览器单机调度。
- [src/pages/mahjong/japanese/engine/characters.ts](../../src/pages/mahjong/japanese/engine/characters.ts) — 当前0真人/其余AI模型。
- [src/pages/mahjong/japanese/types.ts](../../src/pages/mahjong/japanese/types.ts) — 全知手牌/牌山状态。

## 拟新增文件（计划新增，当前不要求存在）

- `shared/contracts/room.ts` — 房间/席位/命令/玩家快照。
- `server/src/routes/rooms.ts` — 列表/创建。
- `server/src/rooms/RoomManager.ts` — 每桌串行生命周期。
- `server/src/rooms/projectView.ts` — 私有信息投影。
- `server/src/rooms/scheduler.ts` — 服务端AI/超时推进。
- `server/src/rooms/socket.ts` — 认证 WebSocket 与ack。
- `src/pages/FamilyLobby.tsx` — 房间列表/创建。
- `src/pages/FamilyRoom.tsx` — 等待室/准备/牌桌。
- `src/lib/household/roomClient.ts` — 命令/快照客户端。
- `src/pages/mahjong/japanese/usePlayerSeatView.ts` — 绝对座位到本人视角映射。

## 接口与数据边界

- 跨阶段的模式、成员、快照、凭据、API、房间、奖励和托管规则以 [README 第4节](./README.md#4-跨阶段统一契约唯一来源) 为准，不在此定义不同版本。
- 保留旧 schema、既有业务状态和原入口；新增结构带版本及 normalize。前置阶段计划新增文件须先核对实际实现。

## 12.1 共享座位模型

真人/AI身份显式记录；展示使用viewerSeat与相对方位，规则绝对座次不交换。改操作/训练/音效/成长归属中硬编码0号；旧单机/旧牌谱默认viewerSeat=0保持兼容。

## 12.2 房间生命周期

执行总纲4.4：局域网列表与链接/二维码加入、准备、东风/半庄、空位AI；房主等待室控制设置，开始后固定。房间模式入口使用独立路由，保留单机入口。

## 12.3 权威推进

所有合法校验、摸牌、AI、超时与下一局在NAS串行推进；命令id/版本/身份校验，不信任客户端传seat。前端只展示玩家投影和提交自身意图，菜单/演出不暂停全桌。

## 12.4 隐藏信息与结算

投影过滤他家手牌/行动选项/牌山/seed/内部响应。未终局不能取完整牌谱。家庭独立战绩/奖励按4.5，每成员一次；真人不能被误计为角色相遇。

## 验收：本机

1. 2真人+2AI、4真人、1真人+3AI分别完成一场，1真人桌无家庭奖励。
2. 四个不同viewerSeat的手牌、牌河、庄家、鸣牌方向、和牌/放铳归属正确。
3. 检查实际HTTP/WS响应，不包含他家手牌/seed/内部状态；越权/伪seat/过期/重复命令拒绝。
4. 两成员同时回应鸣牌窗口按规则统一结算，电脑/手机都可操作。
5. 真人战绩和奖励独立，AI段位pt完全不变。

## 验收：真实 NAS（当前待现场验证）

1. 家中多台实际设备完成整场、NAS AI响应性能、连接数与本地反代WebSocket核对。

## 不做

- 不做公网匹配、观战、聊天、语音，不允许客户端持有完整牌局权威状态。

## 交接与停止条件

- 只实施 P12；先读总纲、依赖任务卡与上述真实代码路径，不把计划新增文件当现有能力。
- 先完成本机可验收部分；NAS不可达不是停止本地开发的理由，但不得把NAS项标为通过。
- 如前置契约尚未实现或存在矛盾，先给出具体文件/调用链证据，解决前置边界后再推进，禁止用假接口或第二套规则绕过。
- 每个小批次记录变更和检查证据；阶段完成时更新本卡状态，未验证项继续明确保留。
- 不擅自提交、推送、部署；新增测试或运行测试按当前明确授权执行，不建立额外测试体系。
