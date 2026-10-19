# P22 第三轮收尾：P19–P21 NAS 上线与第 10 名角色

> 依赖：P19–P21 本地非 NAS 端已交付（2026-10-16，`b3e64c5`）。先读 [README](./README.md)。
> 目标：把第三轮成果部署到真实 NAS 并完成现场验收，留下一个干净、可回滚的基线，再开第四轮街机工作。
> 状态：2026-10-19 本地非 NAS 准备已完成；22.1 部署、22.2 现场验收、22.3 第 10 人（待设定访谈）未开始。

## 本地准备记录（非 NAS）

- [tests/p22-migration-rehearsal.test.ts](../../tests/p22-migration-rehearsal.test.ts)：把数据库回退到 P19 前（3 关 CHECK）、无 `family_cups*`、无 P23 榜单表的形态，用真实 `openDatabase` 迁移：成员快照散列与 revision 不变、旧挑战记录保留且后 6 关可写、新表齐全、`integrity_check`/`foreign_key_check` 通过、重复打开幂等。
- 新增 `pnpm --filter game-hub-household-server migrate-check <household.sqlite>`（先 `build`）：在临时副本上演练迁移并比对每名成员快照散列/revision，原库只读不动。NAS 22.1 第 2 步可直接对正式库副本使用。
- 全仓类型检查、规范检查、测试与前后端构建通过。
- 仍需现场：22.1 备份/QA 环境/切换/回滚演练、22.2 真机多设备验收、第 10 人定稿。

## 涉及文件（实施前先核对）

- [P19](./P19-character-season.md)、[P20](./P20-family-cup.md)、[P21](./P21-curated-rotation.md) — 各卡“验收”一节即本卡现场验收清单。
- [NAS-ACCEPTANCE-2026-10-15.md](./NAS-ACCEPTANCE-2026-10-15.md) — 上次发布的证据格式、备份与回退流程，本次照此执行。
- [scripts/prepare-nas-release.mjs](../../scripts/prepare-nas-release.mjs)、[scripts/nas-release.sh](../../scripts/nas-release.sh)、[scripts/deploy-to-nas.ps1](../../scripts/deploy-to-nas.ps1) — 发布入口。
- [server/src/db.ts](../../server/src/db.ts) — P19 `journey_attempts` 迁移与 P20 `family_cups` / `family_cup_matches` 新表，部署前须在 NAS 数据副本上演练。

## 22.1 NAS 部署（必做）

1. 发布前核对挂载、权限、端口、CPU 架构；对正式 SQLite 做一致性备份，记录两名正式成员快照散列与 revision。
2. 先在隔离 QA 环境（独立数据目录）用正式库副本跑 DB 迁移，确认 P19 关卡进度迁移、P20 杯赛表创建、P21 精选配置与徽记均不破坏旧档案；再正式切换 `current`。
3. 新 releaseId 写入 README 第 3 节；保留 `nas-closeout-20261015d` 作为直接回退点，演练一次手动回滚与健康失败回退。

## 22.2 现场验收（必做）

- **P19**：九关在 NAS 成员下可玩、可失败、可重试；跨设备进度一致；一次性奖励不重复。
- **P20**：至少两台真实设备、两名成员完成一届 2 场杯赛：入座、各场结算、断线托管、控制权接回、服务重启后杯赛进度不变且不重复加分；删除牌谱后榜单不变。
- **P21**：游客 / 成员、有无牌谱、有无杯赛资格四种情况下推荐都指向真实入口；做一次精选配置切换演练并保留上一版。
- 证据另存 `docs/roadmap/NAS-ACCEPTANCE-<日期>.md`（计划新增），P19–P21 任务卡与 README 状态同步更新。

## 22.3 第 10 名角色（独立子项，不阻塞 P23+）

- 开工前另开一次设定访谈，定稿身份、打法风格、AI 倾向、美术方向、是否可选为主角色及解锁条件。
- 定稿后按 P19 “新对手”条款制作：资产规格、双语名称与台词、AI 风格标签、四阶段故事键、收束关卡。
- 定稿未完成时，P22 仍可以“P19 九关 + 第 10 人待定”状态关闭 22.1/22.2；本子项单独记录进度，P23/P24 可正常开工。

## 22.4 可选：实体设备体验补记

- P9/P11/P13 遗留的实体手机音频首次解锁、触控、锁屏后台恢复与家庭 Wi-Fi 抖动体验，如有家人可配合则顺带记录；不作为本卡关闭条件。

## 验收

1. NAS 正式环境运行新版本，前后端健康、资源散列、深链通过；正式成员快照/revision 与发布前一致（迁移新增字段除外，且有说明）。
2. P19–P21 各卡验收项在真实 NAS 上逐条有证据；P20 多设备项使用真实设备而非单浏览器模拟。
3. 回滚演练通过，回退点写入 README。

## 不做

- 不在本卡新增玩法或修改 P19–P21 设计；现场发现的缺陷只做修复。
- 不生成 EXE。

## 交接与停止条件

- NAS 不可达时只能完成本地准备，不得标记现场通过。
- 部署、提交、推送须用户明确要求后执行。
