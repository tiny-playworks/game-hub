# P10 家庭成员与 NAS 服务

> 依赖：P7–P9；先通过 Node/WASM 运行门禁。先读 [README](./README.md)。
> 目标：成员档案隔离，头像加 PIN 登录，NAS 保存权威成长与资产。
> 状态：本机部分实现；街机已接服务端结算，日麻成员对局/结算代码已接入但运行态未验收；真实 NAS 部署待完成。

## 涉及文件（先读）

- [src/lib/saveTransfer.ts](../../src/lib/saveTransfer.ts) — 现有游客完整存档。
- [src/lib/playerProfile.ts](../../src/lib/playerProfile.ts) — 偏好/昵称。
- [src/lib/wallet.ts](../../src/lib/wallet.ts) — 钱包规则。
- [src/lib/playerCharacters.ts](../../src/lib/playerCharacters.ts) — 角色数据和成长。
- [src/lib/riichiRules.ts](../../src/lib/riichiRules.ts) — WASM 预热与 calc。
- [src/pages/mahjong/japanese/engine/match.ts](../../src/pages/mahjong/japanese/engine/match.ts) — 纯规则推进。
- [src/pages/mahjong/japanese/engine/ai.ts](../../src/pages/mahjong/japanese/engine/ai.ts) — AI 内核。
- [src/components/profile/DataManagementCard.tsx](../../src/components/profile/DataManagementCard.tsx) — 导入导出 UI。
- [src/contexts/LocaleContext.tsx](../../src/contexts/LocaleContext.tsx) — 语言偏好。

## 核心实现文件（现有）

- `server/package.json` — 服务依赖与启动/构建命令。
- `server/tsconfig.json` — 服务与共享类型编译范围。
- `server/src/index.ts` — Fastify 生命周期/健康检查。
- `server/src/db.ts` — SQLite schema 和事务/迁移。
- `server/src/auth.ts` — PIN 哈希、Cookie、同源校验。
- `server/src/routes/members.ts` — 成员会话与档案 API。
- `server/src/routes/shop.ts` — 权威购买事务。
- `server/src/routes/progress.ts` — 签到、里程碑与任务领取。
- `server/src/routes/characters.ts` — 角色与服装选择。
- `server/src/routes/arcade.ts` — 街机事件和幂等结算。
- `server/src/arcade/gate.ts` — 无 DOM 的 Node 街机结算门禁。
- `server/src/snapshotRuntime.ts` — 在成员快照上运行共享业务规则。
- `server/src/cli/member.ts` — 本地建成员/重置 PIN。
- `server/src/riichi/runtime.ts` — 同一 WASM 算分契约的 Node 装载。
- `server/src/routes/riichi.ts` — 成员日麻服务端建局、操作、续局和结算。
- `shared/contracts/member.ts` — 成员快照与身份类型。
- `shared/contracts/api.ts` — 统一 API 错误。
- `src/lib/household/api.ts` — 同域客户端。
- `src/contexts/HouseholdContext.tsx` — 游客/成员模式与会话。
- `src/components/household/MemberSelector.tsx` — 头像/PIN 入口。
- `deploy/nas/compose.yml` — 前后端与持久卷模板。

## 接口与数据边界

- 跨阶段的模式、成员、快照、凭据、API、房间、奖励和托管规则以 [README 第4节](./README.md#4-跨阶段统一契约唯一来源) 为准，不在此定义不同版本。
- 保留旧 schema、既有业务状态和原入口；新增结构带版本及 normalize。前置阶段计划新增文件须先核对实际实现。

## 10.1 运行门禁

验证现有 riichi-rs WASM 在 Node 24 中装载，createMatch/applyEvent/AI 可离开 DOM 运行；抽出被引擎运行时引用的纯类型/角色/校验，保留原前端路径入口。统一 calc 适配，禁止另写麻将算分。

## 10.2 服务与身份

按总纲 4.1–4.3 建成员、会话、快照 schema1 与 revision；API Origin/会话校验，成员创建仅 CLI。SQLite 单服务进程持久卷，启动先迁移再开放健康检查。

## 10.3 权威业务

浏览器业务存储入口按模式选择游客本地或成员快照；在线奖励、任务、签到、购买都服务端事务执行并返回新版本，前端不自行扣余额。纯规则与计算从现有模块抽出供两端共用，不复制公式。

## 10.4 旧存档迁移

导出备份→解析规范化各业务域→导入空成员→服务端事务→成功标记；失败不清除本地。仅一次完整迁移，禁止旧数据多设备分别刷增量。

## 10.5 本地部署

本地容器/进程模拟同域静态+API，资料不进入 Git。Nginx /api/v1 与 /ws 反代预留；历史静态入口保持可用直到授权切换。

## 本机进展（2026-10-13 至 2026-10-14）

- 已验证 Node/WASM 独立运行、成员会话与隔离、旧游客存档一次性迁移、购买事务。迁移现从游客 `localStorage` 读取，下载备份失败会停止导入；成员导出单独使用 schema 2，避免误走游客导入与重置。
- 成员资料、语言与主题偏好、签到及里程碑、任务领取、角色与服装选择、商店购买及装备已走版本化 API 或服务端事务。本地浏览器验证签到、昵称、角色、装备在刷新后保留。
- 街机开始/结束事件现由服务端按共享规则结算雀币、任务、成就和记录；每局编号在 SQLite 去重，失败页面可按原局编号重试。Node 无 DOM 门禁验证真实 HTTP 路径，浏览器实跑验证失败重试后入账 5 枚雀币，刷新后仍保留。
- 日麻成员模式已改为由服务端保存局面和推进事件，按共享规则结算成长、雀币、好感及段位；游客仍走本地。新链路尚未完成浏览器与临时数据库的运行态验收，不能据此判定 10.3 已通过。街机目前接收客户端报告的结果，可信结果校验仍待设计。现阶段不得标记 P10 本机完成，也不得作为可用家庭服务部署。
- 2026-10-13：全仓 72 个测试文件、519 项测试通过；前后端类型检查及构建、lint、Node 街机结算门禁通过。NAS 结果不计入本机验收。
- 2026-10-14：成员身份改变时清空内存中的日麻对局、重播和进度摘要；本机临时服务中 A 开局后切到 B，B 的雀币为 0，进入日麻是新局设置页。会话过期的模拟 401 会退出成员状态并显示重新登录提示，桌面与 390px 手机宽度截图无遮挡；新成员登录后若拉取档案失败，也先清理旧成员快照。
- 2026-10-14：服务端街机结算改用不依赖 React 的 Zustand vanilla store，服务运行依赖已加入独立锁文件；仅安装生产依赖的临时目录里，Node 24 服务成功启动并从 `/healthz` 返回 `{"status":"ok"}`。CI 切到 Node 24、安装并检查服务端。前后端类型检查和构建通过；本轮没有运行自动化测试，也没有 Docker 镜像或真实 NAS 验证。
- 2026-10-14：`rs lint --type-check` 通过；仓库现有 `rs check --type-check` 的格式检查仍报 50 个文件（含本轮未改文件），因此 CI 暂以 lint + 类型检查作为静态门禁，格式债需单独整理。
- 2026-10-14：NAS Nginx 模板覆盖客户端传入的 `X-Forwarded-For`，避免 Fastify 信任代理后把伪造 IP 用于 PIN 错误次数统计。模板未在真实 Nginx 中加载，留待 NAS 现场核验。
- 2026-10-14：成员设备编号改用已有的局域网 HTTP 兼容 UUID 生成器，避免回退到普通随机数；本地存储不可用时仍为当前页面生成独立编号，已核对前端类型检查和 diff。尚未在真实局域网浏览器或 NAS 登录链路复核。
- 2026-10-14：新增成员日麻局的 SQLite 状态、服务端生成种子与段位票据、逐步合法动作及 AI 行为核对、一次性终局结算和设备绑定续局；前端成员模式改为等待服务端回执，段位弃赛调用服务端，游客模式保留。Node 24 下前后端类型检查、构建及 `rs lint --type-check` 通过；按当前授权没有新增或运行自动化测试，也未完成本机浏览器/临时服务实际对局验收。服务端目前仍会把单机 AI 局完整牌面发给本人；真人房间隐藏信息、掉线托管及跨设备多存档属于后续阶段。

## 验收：本机（历史记录，需按上述缺口重新验收）

1. Node/WASM 内核装载并完整推进一局；门禁脚本 `server/src/riichi/gate.ts` 在 Node 环境 90 步完赛，已通过。
2. 两个成员分别登录，档案/钱包/段位/外观隔离；30 天记住/退出/错误 PIN 限速；`tests/household-storage.test.ts` 与 `tests/household-server.test.ts` 验证通过。
3. 迁移旧存档成功且本地原件保留；重复迁移拒绝，失败事务无半份数据；`parseLegacyImport` 强校验及备份机制验证通过。
4. 同成员两设备在线购买并发不出现负余额或重复物品；服务端事务与版本 revision 冲突机制已通过。
5. 服务停止、Cookie 失效和 API 失败均有可恢复提示；`tests/household-interaction.test.tsx` 验证通过。
- 早期验收记录为 69 个测试套件、514 项测试；其范围未覆盖全部在线业务写回，不能据此判定 10.3 已完成。

## 验收：真实 NAS（当前待现场验证）

1. 2026-10-13 只读检查已确认 NAS x86_64、旧站点静态容器仍运行；家庭 API 未部署。新服务的容器运行、卷权限、备份位置、反代 Cookie/Origin、端口和回滚均待验证；当前 SSH 用户无 Docker daemon 操作权限。

## 不做

- P10 不实现离线凭据同步与真人房间，不开放公网/匿名账号管理。

## 交接与停止条件

- 只实施 P10；先读总纲、依赖任务卡与上述真实代码路径，不把计划新增文件当现有能力。
- 先完成本机可验收部分；NAS不可达不是停止本地开发的理由，但不得把NAS项标为通过。
- 如前置契约尚未实现或存在矛盾，先给出具体文件/调用链证据，解决前置边界后再推进，禁止用假接口或第二套规则绕过。
- 每个小批次记录变更和检查证据；阶段完成时更新本卡状态，未验证项继续明确保留。
- 不擅自提交、推送、部署；新增测试或运行测试按当前明确授权执行，不建立额外测试体系。
