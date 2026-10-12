# P11 跨设备续玩与离线同步

> 依赖：P10 成员身份/快照/购买事务验收通过。先读 [README](./README.md)。
> 目标：已加载的成员自由局/街机掉线可继续，恢复连接逐笔同步，多份自由局存档可自选。
> 状态：待实施。任务内容尚未代表实现或验收。

## 涉及文件（先读）

- [src/lib/gameEvents.ts](../../src/lib/gameEvents.ts) — 街机对局事件。
- [src/lib/uuid.ts](../../src/lib/uuid.ts) — HTTP 兼容凭据 ID。
- [src/pages/mahjong/japanese/store/persistence.ts](../../src/pages/mahjong/japanese/store/persistence.ts) — 自由局事件存档。
- [src/lib/wallet.ts](../../src/lib/wallet.ts) — 已有限额。
- [src/lib/rankedSettlement.ts](../../src/lib/rankedSettlement.ts) — 段位结算。
- [src/lib/saveTransfer.ts](../../src/lib/saveTransfer.ts) — 游客 schema1 导出。

## 拟新增文件（计划新增，当前不要求存在）

- `shared/contracts/sync.ts` — 离线凭据与逐条响应。
- `server/src/routes/sync.ts` — 幂等批量接收。
- `server/src/services/progression.ts` — 统一对局/任务/奖励结算。
- `src/lib/household/offlineDb.ts` — IndexedDB 成员缓存/队列/续局事务。
- `src/lib/household/sync.ts` — 连接恢复、批次重传与状态。
- `src/components/household/SyncStatus.tsx` — 已确认/待同步/失败状态。
- `src/components/household/ResumeSavePicker.tsx` — 多设备存档选择。

## 接口与数据边界

- 跨阶段的模式、成员、快照、凭据、API、房间、奖励和托管规则以 [README 第4节](./README.md#4-跨阶段统一契约唯一来源) 为准，不在此定义不同版本。
- 保留旧 schema、既有业务状态和原入口；新增结构带版本及 normalize。前置阶段计划新增文件须先核对实际实现。

## 11.1 缓存与队列

按总纲4.2建 IndexedDB；缓存仅当前已登录成员，切换不混队列。已加载自由局/街机继续生成凭据，待同步收入与确认余额分开；离线禁用购买、AI段位、真人房间及任务领奖。

## 11.2 服务端归并

事务验证重放自由局或街机结果、唯一凭据、每日额度；返回每条 accepted/duplicate/rejected，永久拒绝保留可导出证据但不无限重试，临时失败退避重试。接受成功且客户端未收响应时再次提交只返回 duplicate。

## 11.3 续局与设置

自由局按设备/saveId保留多份；用户明确选择恢复，未选存档不删除。偏好修改只覆盖本次字段，处理 revision 冲突，不全档最后写入覆盖。

## 11.4 备份与迁移

新增 schema2成员导出/恢复，schema1游客仍可读；恢复备份不重放已结算事件，不把游客钱包当增量。浏览器存储故障沿用P7提示/导出，不谎称离线数据已安全保存。

## 验收：本机

1. 切断 API 后，已加载自由局/街机可完赛；联网同步一次，重复发送不重复领奖。
2. 两设备同成员各保留未完成自由局；恢复其中一份不会删除另一份。
3. 跨日/达到上限/不合法凭据/旧 revision/收到响应前断线均按总纲处理。
4. 退出/换成员不会上传错归属队列；重开浏览器后已有队列可恢复。
5. 完整断网的新页面不冒充可启动，资源未加载时P7恢复界面说明。

## 验收：真实 NAS（当前待现场验证）

1. 家庭两设备实际断网/重新联网、多浏览器存储权限/容量和时钟差核对。

## 不做

- 不做完整离线启动，不支持离线消费/排位，不自动合并多份未完成牌局。

## 交接与停止条件

- 只实施 P11；先读总纲、依赖任务卡与上述真实代码路径，不把计划新增文件当现有能力。
- 先完成本机可验收部分；NAS不可达不是停止本地开发的理由，但不得把NAS项标为通过。
- 如前置契约尚未实现或存在矛盾，先给出具体文件/调用链证据，解决前置边界后再推进，禁止用假接口或第二套规则绕过。
- 每个小批次记录变更和检查证据；阶段完成时更新本卡状态，未验证项继续明确保留。
- 不擅自提交、推送、部署；新增测试或运行测试按当前明确授权执行，不建立额外测试体系。
