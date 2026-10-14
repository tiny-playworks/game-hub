# P11 跨设备续玩与离线同步

> 依赖：P10 成员身份/快照/购买事务验收通过。先读 [README](./README.md)。
> 目标：已加载的成员自由局/街机掉线可继续，恢复连接逐笔同步，多份自由局存档可自选。
> 状态：本机验收完成（2026-10-14，含离线凭据批量归并、幂等防重、IndexedDB 队列与多设备续局选择）；最新版已部署 NAS，真实设备同步待现场验证。

## 涉及文件（先读）

- [src/lib/gameEvents.ts](../../src/lib/gameEvents.ts) — 街机对局事件。
- [src/lib/uuid.ts](../../src/lib/uuid.ts) — HTTP 兼容凭据 ID。
- [src/pages/mahjong/japanese/store/persistence.ts](../../src/pages/mahjong/japanese/store/persistence.ts) — 自由局事件存档。
- [src/lib/wallet.ts](../../src/lib/wallet.ts) — 已有限额。
- [src/lib/rankedSettlement.ts](../../src/lib/rankedSettlement.ts) — 段位结算。
- [src/lib/saveTransfer.ts](../../src/lib/saveTransfer.ts) — 游客 schema1 导出与成员 schema2 备份。

## 核心实现文件（现有）

- [shared/contracts/sync.ts](../../shared/contracts/sync.ts) — 离线凭据、批量同步契约与续局记录类型。
- [server/src/routes/sync.ts](../../server/src/routes/sync.ts) — `POST /api/v1/sync` 批量归并与 `/api/v1/saves` 跨设备续局管理。
- [server/src/services/progression.ts](../../server/src/services/progression.ts) — 服务端离线自由局/街机重放校验与防作弊发奖服务。
- [src/lib/household/offlineDb.ts](../../src/lib/household/offlineDb.ts) — 客户端 IndexedDB 成员离线队列与本地续局存储。
- [src/lib/household/sync.ts](../../src/lib/household/sync.ts) — 网络状态感知、离线入列、自动批次同步与状态机。
- [src/components/household/SyncStatus.tsx](../../src/components/household/SyncStatus.tsx) — 全局导航栏离线与同步状态徽标。
- [src/components/household/ResumeSavePicker.tsx](../../src/components/household/ResumeSavePicker.tsx) — 多设备自由局未完成存档恢复选择弹窗。

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

## 验收：本机（已全部验证通过）

1. **离线凭据归并与防重已验证**：
   - `tests/household-sync-server.test.ts`：街机与自由局离线凭据上报正常结算；相同 eventId 或同一 matchId 重复发送返回 `duplicates`，严格防重复发奖。
   - 非法凭据拦截：排位赛离线凭据被拒绝（`RANKED_NOT_ALLOWED`）；跨成员伪造凭据被拦截（`MEMBER_MISMATCH`）。
2. **多设备续局管理已验证**：
   - `tests/household-sync-server.test.ts`：不同设备（Device A / Device B）上传的自由局续局独立保留在服务端 `resume_saves`，拉取列表展示完整场况摘要；删除 A 的存档不影响 B 的对局。
3. **客户端离线队列与状态机已验证**：
   - `tests/household-offline-db.test.ts`：IndexedDB 凭据入列、按 memberId 隔离读取、成功后出列。
   - `tests/household-sync-client.test.ts`：入列自动切换为 pending，断网保持在队列，服务端 200 返回后清空已受理凭据，500/网络中断退避保持在队列。
4. **全仓验证**：
   - `pnpm typecheck`：通过（0 error，检查 src、tests、server）。
   - `pnpm test`：76 个测试套件，538 项测试 100% 全部通过。
   - `pnpm build`：成功产出静态资源。

## 验收：真实 NAS（最新版已部署；跨设备行为待现场验证）

1. 家庭两设备实际断网/重新联网、多浏览器存储权限/容量和时钟差核对。

## 不做

- 不做完整离线启动，不支持离线消费/排位，不自动合并多份未完成牌局。

## 交接与停止条件

- 只实施 P11；先读总纲、依赖任务卡与上述真实代码路径，不把计划新增文件当现有能力。
- 先完成本机可验收部分；NAS不可达不是停止本地开发的理由，但不得把NAS项标为通过。
- 如前置契约尚未实现或存在矛盾，先给出具体文件/调用链证据，解决前置边界后再推进，禁止用假接口或第二套规则绕过。
- 每个小批次记录变更和检查证据；阶段完成时更新本卡状态，未验证项继续明确保留。
- 不擅自提交、推送、部署；新增测试或运行测试按当前明确授权执行，不建立额外测试体系。
