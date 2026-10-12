# P15 牌谱档案与训练闭环

> 依赖：P11同步、P12本人座位投影、P14分析口径。先读 [README](./README.md)。
> 目标：可查看长期牌谱，定位薄弱点，从关键决策进入训练。
> 状态：待实施。任务内容尚未代表实现或验收。

## 涉及文件（先读）

- [src/lib/riichiMatchReview.ts](../../src/lib/riichiMatchReview.ts) — 既有expert建议/关键决策分析。
- [src/pages/mahjong/japanese/trainingAdvice.ts](../../src/pages/mahjong/japanese/trainingAdvice.ts) — 向听/进张/风险。
- [src/pages/mahjong/japanese/components/MatchReview.tsx](../../src/pages/mahjong/japanese/components/MatchReview.tsx) — 已有复盘弹窗。
- [src/pages/mahjong/japanese/components/ReplayViewer.tsx](../../src/pages/mahjong/japanese/components/ReplayViewer.tsx) — 已有逐步回放。
- [src/pages/mahjong/japanese/store/persistence.ts](../../src/pages/mahjong/japanese/store/persistence.ts) — 最近一份牌谱。
- [src/pages/Profile.tsx](../../src/pages/Profile.tsx) — 档案入口。

## 拟新增文件（计划新增，当前不要求存在）

- `shared/contracts/replay.ts` — 归档/训练题与viewerSeat。
- `server/src/routes/replays.ts` — 成员列表/收藏/删除/终局权限。
- `src/pages/ReplayArchive.tsx` — 筛选与收藏入口。
- `src/lib/riichiTraining.ts` — 关键决策转练习题。
- `src/pages/RiichiTraining.tsx` — 练习/解释/回原牌谱。
- `src/components/profile/TrainingSummary.tsx` — 薄弱点摘要。

## 接口与数据边界

- 跨阶段的模式、成员、快照、凭据、API、房间、奖励和托管规则以 [README 第4节](./README.md#4-跨阶段统一契约唯一来源) 为准，不在此定义不同版本。
- 保留旧 schema、既有业务状态和原入口；新增结构带版本及 normalize。前置阶段计划新增文件须先核对实际实现。

## 15.1 归档

按总纲4.5保留200普通/100收藏，按日期/来源/结果筛选，游客使用本地独立归档。迁入最近牌谱，不删除已结算凭据；进行中家庭局禁止查询全知牌谱。

## 15.2 本人分析

复盘参数化viewerSeat，按照当时公开信息分析，不能用局后已知手牌解释为当时必选。expert建议标为参考，风险明确估计，沿用已有算法不宣称最优证明。

## 15.3 训练闭环

把向听退步、进张损失、放铳风险、立直选择做练习题：展示当时本人局面→玩家选→建议/原因→回放节点。训练不发对局奖励/段位pt。

## 15.4 薄弱点

显示最近20场的类别数量与趋势，少于5场提示样本不足；分析异步进度/取消保留，删除/同步后摘要一致。

## 验收：本机

1. 本人在0/1/2/3座位的复盘与训练均正确。
2. 筛选/收藏/淘汰/删除后奖励不变；非参赛成员无法取家庭牌谱。
3. 从错误决策进入练习并返回原节点，解释与当时公开信息一致。
4. 已有游客最近牌谱保留；分析取消/加载失败可恢复。

## 验收：真实 NAS（当前待现场验证）

1. NAS牌谱查询、手机复盘布局与较长事件日志加载耗时。

## 不做

- 不新增麻将玩法，不把训练当奖励来源，不使用大模型编造建议。

## 交接与停止条件

- 只实施 P15；先读总纲、依赖任务卡与上述真实代码路径，不把计划新增文件当现有能力。
- 先完成本机可验收部分；NAS不可达不是停止本地开发的理由，但不得把NAS项标为通过。
- 如前置契约尚未实现或存在矛盾，先给出具体文件/调用链证据，解决前置边界后再推进，禁止用假接口或第二套规则绕过。
- 每个小批次记录变更和检查证据；阶段完成时更新本卡状态，未验证项继续明确保留。
- 不擅自提交、推送、部署；新增测试或运行测试按当前明确授权执行，不建立额外测试体系。
