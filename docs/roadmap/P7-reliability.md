# P7 使用可靠性与发布准备

> 依赖：P1–P6；当前 HTTP UUID 修复已在 main。先读 [README](./README.md)。
> 目标：页面报错能恢复，保存失败可见且当前进度可备份；准备安全的静态发布与回滚。
> 状态：2026-10-12 本机实现及验收通过；2026-10-14 NAS 发布、Docker/Nginx 和 Windows PowerShell 入口已验证，手动回滚待验证。

## 涉及文件（先读）

- [src/App.tsx](../../src/App.tsx) — 路由、lazy、Suspense，目前没有异常边界。
- [src/index.tsx](../../src/index.tsx) — 根渲染与服务 Worker。
- [src/components/profile/DataManagementCard.tsx](../../src/components/profile/DataManagementCard.tsx) — 导入确认、失败提示与不完整备份拒绝。
- [src/lib/saveTransfer.ts](../../src/lib/saveTransfer.ts) — JSON 导入/导出/回滚。
- [src/lib/cosmetics.ts](../../src/lib/cosmetics.ts) — 双记录购买事务，必须保留失败语义。
- [src/pages/mahjong/japanese/store/persistence.ts](../../src/pages/mahjong/japanese/store/persistence.ts) — 续局/最近牌谱保存。
- [src/lib/wallet.ts](../../src/lib/wallet.ts) — 奖励与余额。
- [src/lib/growth.ts](../../src/lib/growth.ts) — 成长写入。
- [src/store/gameStore.ts](../../src/store/gameStore.ts) — 街机 Zustand persist。
- [scripts/deploy-to-nas.ps1](../../scripts/deploy-to-nas.ps1) — 历史覆盖复制部署。
- [rsbuild.config.ts](../../rsbuild.config.ts) — WASM 与 SPA 配置。
- [public/sw.js](../../public/sw.js) — 仅导航缓存，不是完整离线。

## P7 新增文件（本机已实现）

- `src/lib/storage.ts` — 统一读写、失败状态、会话内待保存内容、重试及严格事务。
- `src/lib/lazyPage.tsx` — 可重建的 lazy 页面导入。
- `src/components/recovery/PageErrorBoundary.tsx` — 根/路由异常恢复。
- `src/components/recovery/StorageNotice.tsx` — 保存失败、导出和重试入口。
- `src/components/recovery/recovery.css` — 恢复界面与手机排版。
- `deploy/nas/nginx.conf` — SPA、WASM、缓存和健康检查配置。
- `deploy/nas/compose.static.yml` — 静态版本父目录挂载模板。
- `scripts/nas-release.sh` — 上传后版本校验、切换、探测、回滚。

## 接口与数据边界

- 跨阶段的模式、成员、快照、凭据、API、房间、奖励和托管规则以 [README 第4节](./README.md#4-跨阶段统一契约唯一来源) 为准，不在此定义不同版本。
- 保留旧 schema、既有业务状态和原入口；新增结构带版本及 normalize。前置阶段计划新增文件须先核对实际实现。

## 7.1 异常恢复

给根应用和路由加异常边界；失败页提供重新尝试、返回大厅、导出当前备份、复制错误。重试须重建 React.lazy 的失败实例，不能只清掉错误状态。返回大厅不得自动丢弃段位存档或清空数据。

## 7.2 统一保存反馈

将普通 localStorage 写入与 Zustand persist 接到统一层。写失败时保留最新字符串/删除意图在本次会话，读取优先待保存内容，全站提示关闭页面可能丢失。提供重试全部待写数据和包含待保存数据的导出；被禁用的读取只可导出已知数据，必须提示备份可能不完整。

## 7.3 关键操作与回滚

商店购买、导入、重置采用严格持久化事务：任一写失败返回失败，原状态保留，失败回滚不得再次抛出使界面白屏。存在未保存进度时先重试成功再允许购买/覆盖导入。保留成功通知和幂等奖励，不以暂存购买假装成功。

## 7.4 资源恢复

已存在的日麻 WASM 预热重试保留；lazy chunk 失败显示恢复界面。普通 HTTP 下不要求 service Worker，不声称完整离线。首次加载不可达显示实际错误，不无限自动刷新。

## 7.5 发布准备

改覆盖复制为上传新 releases/<releaseId>，检查清单和 index/JS/CSS/WASM，先将哈希资源保留到 assets，再原子切换 current。旧标签页所需哈希资源不自动删除。Nginx 挂载父目录，HTML/no-cache、哈希资源 immutable、WASM application/wasm、SPA fallback；探测失败回退上一个 current。首次迁移必须保留 site，未核对挂载前禁止上线。部署入口支持仅准备/只读预检，不联系 NAS 的本地准备不得伪报已部署。

## 验收：本机

1. 本机普通 HTTP：大厅、2048、日麻自由/段位开局正常；UUID 不依赖安全上下文。
2. 隔离浏览器阻断一个 lazy chunk：恢复页出现；解除阻断后重试成功；返回大厅仍可用。
3. 注入存储满/禁用：小游戏和日麻可继续，保存提示出现；导出含最新待写数据；解除故障后重试及刷新恢复。
4. 注入购买第二次写入失败：返回 failed，余额/物品不变；导入失败恢复原数据，不刷新掉暂存。
5. 类型、改动文件静态检查、构建通过；桌面/手机恢复界面截图。
6. 本地准备清单与脚本 dry-run/回滚路径核对；没有 Docker/PowerShell 时明确记录未运行项。

## 验收：真实 NAS（发布切换已验；手动回滚仍待验证）

1. 2026-10-14 已核对 NAS x86_64、8089 端口、运行中 Nginx 容器的只读父目录挂载 `/volume1/docker/game-hub`，以及 API 的持久数据挂载；旧 `site/` 仍保留。
2. 已从 Windows 入口发布 `p16-nas-20261014c`，SHA-256 清单校验通过，`current` 指向该版本、`previous` 保留 `p15-nas-20261014c`；发布后的 `/`、`/profile`、哈希 JS 与 WASM 均返回 HTTP 200，WASM MIME 为 `application/wasm`。
3. 发布脚本的上传步骤现逐项传输版本包顶层文件，避免 OpenSSH `scp -O` 拒绝 `/.` 路径；NAS 脚本实现健康检查失败时恢复原 `current`，本次未注入失败验证。
4. 未在使用中的站点上切回旧版验证手动回滚；自动回滚和手动回滚仍待专门验收。

## 不做

- 不实施成员服务、联机、新视觉和完整离线 PWA。
- 不清空旧存档、不自动提交/推送/部署。

## 交接与停止条件

- 只实施 P7；先读总纲、依赖任务卡与上述真实代码路径，不把计划新增文件当现有能力。
- 先完成本机可验收部分；NAS不可达不是停止本地开发的理由，但不得把NAS项标为通过。
- 如前置契约尚未实现或存在矛盾，先给出具体文件/调用链证据，解决前置边界后再推进，禁止用假接口或第二套规则绕过。
- 每个小批次记录变更和检查证据；阶段完成时更新本卡状态，未验证项继续明确保留。
- 不擅自提交、推送、部署；新增测试或运行测试按当前明确授权执行，不建立额外测试体系。

## 本机实施与验收记录（2026-10-12）

- 本机环境：macOS、Node 20.20.2、Rsbuild 2.2.10，生产预览普通 HTTP。验收期间地址从 `172.20.10.3:8089` 切换为 `192.168.137.183:8089`；NAS 没有参与。
- Browser 插件未提供，使用 Playwright CLI 隔离浏览器；桌面 1440×900、手机 390×844。所有故障注入只影响测试会话。
- `pnpm typecheck`、`pnpm build`、改动文件 Biome 检查通过（achievements.ts 既有4项info保留，无新错误）。未新增测试；6个相关现有文件49项通过，含购买失败回滚、导入导出、街机成长及日麻续局。
- 16个副玩法入口均渲染、有游戏状态、无未捕获运行时异常；3D已有 PCFSoftShadowMap deprecation 警告未在P7处理。
- 段位和自由局在非安全上下文正常开局；日麻出牌后写失败，备份含5条新事件，恢复保存后落盘6条事件；刷新继续同一session。
- lazy chunk 人为阻断后显示恢复页；解除阻断后重试进入2048。复制错误、返回大厅、桌面/手机布局已核对；故障日志为注入导致的预期React/资源错误。
- 街机写失败时真实存储playCount为1，备份playCount为2，含2条开局凭据；重试后真实存储为2且提示消失。普通进度按会话暂存，购买/导入/重置使用严格事务。
- 最初读取失败后恢复权限，旧900雀币和back-sakura保持；暂存与未读旧数据冲突时停止自动覆盖。恢复备份带recovery.partial/pendingCount，partial备份明确拒绝作为完整存档导入。
- 浏览器导入时注入cosmetics写入失败，原记录全部保留、500雀币不变、页面没有刷新或白屏；恢复权限后可重试写入。
- `pnpm prepare:nas p7-final-check`完成构建及113文件SHA-256包；仅输出到被Git忽略的 `output/nas/`，没有NAS连接或发布。
- 本地临时目录 + HTTP服务模拟版本切换、手动回滚、503健康失败回退、篡改资源校验拒绝、保留旧哈希资源、中断激活恢复current并释放锁，均通过。它不等于Nginx容器或NAS验收。
- 英文恢复与双故障组合DOM检查通过：只有一条保存提示，返回大厅保留待保存内容。补拍英文截图时headed截图调用超时，没有把超时当作视觉通过；最终使用20秒截图限时重拍中文桌面/手机成功，已查看 `chunk-final-desktop.png` 和 `chunk-final-mobile.png`，手机无水平溢出。
- 临时截图、备份与模拟目录位于 `/tmp/game-hub-p7-qa/`，未提交到仓库。

## 发布操作与现场门禁

跨平台本地准备：`pnpm prepare:nas <新的releaseId>`；只生成版本包，不连接NAS。

Windows入口（仓库根目录）：

```powershell
pnpm run deploy:nas -PrepareOnly
pnpm run deploy:nas -PreflightOnly
# 下列为外部操作，只有获得明确部署授权且核对挂载后才执行：
pnpm run deploy:nas -Activate -ReleaseId <新的releaseId>
pnpm run deploy:nas -Rollback
```

默认不带模式时只本地准备。`PreflightOnly`只读取current/previous指针，**不能证明挂载/端口已正确**。

Git 提交/推送不会自动发布 NAS：`.github/workflows/ci.yml` 只在 `main`/`master` 上运行 CI，没有部署任务；NAS 位于家庭局域网。需要从可访问 NAS 的机器显式运行 `-Activate`。该 Windows 入口负责静态版本；家庭 API 需同步构建源码后用 NAS Compose 单独重建。

真实 NAS 已核对 Nginx 根目录、父目录挂载、端口、只读权限、静态发布和健康检查。首次容器配置切换不在本批执行；手动回滚仍须单独验收。`server/`、`shared/contracts/`与家庭服务均不属于 P7 的实现范围。

`server/`、`shared/contracts/`与家庭服务均未在P7实现；后续按P10–P13执行。P7不承担公网与完整离线启动。
