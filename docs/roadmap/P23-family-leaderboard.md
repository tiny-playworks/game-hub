# P23 家庭排行榜与动态

> 依赖：P22 完成 NAS 基线；P10/P11 成员权威数据与离线同步；P6 街机统一结算。可与 P24 并行。先读 [README](./README.md)。
> 目标：让 16 个街机游戏的成绩在家人之间可见、可比，给“再来一把”一个理由。
> 状态：2026-10-21 已正式部署；NAS 分数最大/步数最少/连胜三类榜、独立挑战隔离、CLI 隐藏/恢复、受控周界与荣誉防重通过；桌面/手机真实历史榜→周榜交互通过，见 [NAS 记录](./NAS-ACCEPTANCE-2026-10-21.md)。

## 涉及文件（已实现）

- [server/src/routes/arcade.ts](../../server/src/routes/arcade.ts) — `/api/v1/me/arcade/events` 开局/结束结算、合理性校验 `validatePlausibleFinish` 与榜单写入 `recordRankedResult`。
- [server/src/db.ts](../../server/src/db.ts) — `arcade_rounds`、`offline_receipts`、`leaderboard_entries`、`leaderboard_week_settlements`、`weekly_champions`、`family_feed`。
- [server/src/services/progression.ts](../../server/src/services/progression.ts) 与 [server/src/routes/sync.ts](../../server/src/routes/sync.ts) — 离线街机凭据接受链（带 `meta.durationMs` 下限校验）。
- [shared/contracts/leaderboard.ts](../../shared/contracts/leaderboard.ts)、[server/src/services/leaderboard.ts](../../server/src/services/leaderboard.ts)、[server/src/services/arcadeLimits.ts](../../server/src/services/arcadeLimits.ts)、[server/src/routes/leaderboard.ts](../../server/src/routes/leaderboard.ts)、[server/src/cli/leaderboard.ts](../../server/src/cli/leaderboard.ts) — 榜单服务、周冠惰性结算、家庭动态、16 游戏合理性门禁与管理 CLI。
- [src/pages/Leaderboard.tsx](../../src/pages/Leaderboard.tsx)、[src/components/game/FamilyStandingPill.tsx](../../src/components/game/FamilyStandingPill.tsx)、[src/components/game/GameResultOverlay.tsx](../../src/components/game/GameResultOverlay.tsx)、[src/components/home/FamilyFeedLobbyPanel.tsx](../../src/components/home/FamilyFeedLobbyPanel.tsx)、[src/components/profile/WeeklyChampionsCard.tsx](../../src/components/profile/WeeklyChampionsCard.tsx) — 家庭榜单页、GameShell 与结算弹层实时名次/分差/新纪录提示、大厅动态与个人资料页周冠荣誉展示。

## 23.1 榜单口径

- 维度：每个“游戏 × 难度”一组，各有 **历史最佳** 与 **本周最佳** 两张榜。每名成员在每张榜上只出现一次（取其最佳）。
- 指标沿用 `games.ts` 的 `bestMetric`：分数类取最大，步数/秒数类取最小，棋牌类 vs AI 取**最佳连胜**；与个人最佳展示完全一致。
- 周界：周一 00:00（Asia/Shanghai）切换。
- 数据源：服务端已接受的在线 `arcade_rounds` 结果 + 已接受的离线街机凭据（按 `occurredAt` 归周）。只计成员，游客不上榜；真人对战（`family-arcade`，见 P24）不进入本榜。
- 同分时先达成者在前。

## 23.2 周冠军与家庭动态

- 周冠军：某“游戏 × 难度”在该周**至少 2 名成员**有有效成绩时，周结束后颁发周冠军徽记给第一名（并列同时颁发）。结算由服务端在跨周后首次请求时惰性执行，唯一键 `(weekId, gameId, difficulty, memberId)` 防重。已结算的周不因迟到的离线凭据回溯改判。
- 只给荣誉：徽记、可展示称号、动态条目；**不发雀币、成长、好感**，不影响每日/每周任务。
- 家庭动态（服务端生成，客户端只读）：刷新家庭历史纪录、获得周冠军、（P24 起）家人对战结果、（已有）家庭杯完赛。保留最近 100 条；大厅显示最近若干条，可进完整列表。

## 23.3 校验加固与管理

- 补齐 16 个游戏的服务端合理性校验：分数/指标上限、在线局 `started_at → finished_at` 最短时长、指标间一致性（如 2048 最大方块 ≤ 分数、俄罗斯方块行数与分数）。离线凭据没有服务端开局时间，按客户端 `meta.durationMs` 做同等下限校验，缺失则仅计个人统计不上榜。
- 管理 CLI 新增：列出某榜前 N 条、隐藏/恢复指定成绩（记录原因与时间）。被隐藏的成绩不上榜、不计周冠军，但不扣已发的单局奖励与个人统计。
- 不做种子 + 操作序列重放验算。

## 23.4 界面

- 游戏结算遮罩与 GameShell 显示“家庭第 N / 本周第 N”与“距上一名差多少”；刷新家庭纪录时有轻量提示。
- 新的家庭榜单页：按分类/游戏/难度切换，历史 / 本周标签；成员头像、昵称、成绩、达成时间。
- 个人资料页展示已获得的周冠军徽记与称号。
- 离线或游客模式下隐藏榜单入口或显示“登录家庭成员后可见”，不显示过期缓存冒充实时榜单。

## 验收

1. 两名以上成员在多个游戏/难度上产生成绩后，历史榜、周榜与各自个人最佳一致；min / max / wins 三类口径各至少验证一个游戏。
2. 跨周后周冠军按“至少 2 人”规则颁发且只颁发一次；只有 1 人参与的榜不颁发；迟到离线凭据不改判已结算周。
3. 构造不合理成绩（超上限、时长过短、指标矛盾）被拒；CLI 隐藏后榜单与周冠军计算排除该成绩。
4. 雀币、任务、成就结算前后无变化（荣誉不带经济奖励）。
5. 中英文、浅/深色、桌面/手机截图核对榜单页、结算遮罩与动态；NAS 现场记录另做。

## 不做

- 不做跨家庭/公网榜、不做实时推送排名变化、不做重放验算、不给榜单发雀币。

## 交接与停止条件

- 与 P24 并行时注意 `server/src/db.ts` 迁移顺序，两边新表互不依赖；合并前在同一数据副本上跑完整迁移。
- 不擅自提交、推送或部署；新增/运行测试依当前用户授权。
