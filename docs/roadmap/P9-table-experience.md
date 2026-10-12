# P9 牌桌交互与视听品质

> 依赖：P8 设计与主要页面验收通过。先读 [README](./README.md)。
> 目标：操作反馈明确，出牌/鸣牌/立直手感统一，手机能完成一整场。
> 状态：待实施。任务内容尚未代表实现或验收。

## 涉及文件（先读）

- [src/pages/mahjong/japanese/index.tsx](../../src/pages/mahjong/japanese/index.tsx) — 用户操作与快捷键。
- [src/pages/mahjong/japanese/useRiichiViewModel.ts](../../src/pages/mahjong/japanese/useRiichiViewModel.ts) — 展示数据。
- [src/pages/mahjong/japanese/components/Tile.tsx](../../src/pages/mahjong/japanese/components/Tile.tsx) — 手牌反馈。
- [src/pages/mahjong/japanese/components/MeldTiles.tsx](../../src/pages/mahjong/japanese/components/MeldTiles.tsx) — 鸣牌方向。
- [src/pages/mahjong/japanese/components/WinPresentation.tsx](../../src/pages/mahjong/japanese/components/WinPresentation.tsx) — 和牌演出。
- [src/pages/mahjong/japanese/useRiichiEffectSounds.ts](../../src/pages/mahjong/japanese/useRiichiEffectSounds.ts) — 已有事件音效。
- [src/hooks/useRiichiSounds.ts](../../src/hooks/useRiichiSounds.ts) — 已有本地音频。
- [src/lib/playerProfile.ts](../../src/lib/playerProfile.ts) — 演出与自动操作偏好。
- [src/pages/mahjong/japanese/useRiichiAutomation.ts](../../src/pages/mahjong/japanese/useRiichiAutomation.ts) — 当前单机调度。

## 拟新增文件（计划新增，当前不要求存在）

- `src/pages/mahjong/japanese/useTileInteraction.ts` — 鼠标/触控/键盘统一选牌。
- `src/pages/mahjong/japanese/components/TableFeedback.tsx` — 动作反馈与过渡。
- `src/pages/mahjong/japanese/table-feedback.css` — 桌面/触控动效。

## 接口与数据边界

- 跨阶段的模式、成员、快照、凭据、API、房间、奖励和托管规则以 [README 第4节](./README.md#4-跨阶段统一契约唯一来源) 为准，不在此定义不同版本。
- 保留旧 schema、既有业务状态和原入口；新增结构带版本及 normalize。前置阶段计划新增文件须先核对实际实现。

## 9.1 操作一致

悬停/选中/不可操作态明确；手机先选牌再确认出牌，防滚动误触。方向键选牌、Enter 出牌、Esc 退出选择，按钮按既有合法动作显示。

## 9.2 演出与音效

复用已存在本地音频，提供统一音量/静音；动画对应真实事件，不提前写规则状态、不重复播放。立直横牌、鸣牌来源、宝牌、役种分段与终局过渡完善。

## 9.3 偏好与节奏

设置保存自动和了、不鸣牌、立直摸切、演出强度；完整/简化/关闭均可用。网络模式后续不以本地菜单/演出暂停服务器，当前结构留清楚边界。

## 9.4 新手操作提示

首次进入给出可关闭的一次性操作说明，不新增长篇阻断教程；危险度继续标明是估计，训练提示不进入 AI 段位。

## 验收：本机

1. 鼠标、键盘、手机触控各完成出牌/鸣牌/立直/和牌/下一局。
2. 选牌触控不被滚动误触，按钮点击区不少于 44px；手机完整一场。
3. 静音、演出简化/关闭、reduced-motion 真实生效，刷新后保留。
4. 重复渲染/恢复存档不重复播放奖励/音效；段位无训练辅助。

## 验收：真实 NAS（当前待现场验证）

1. 实际手机音频首次手势解锁、触屏操作与较低性能设备检查。

## 不做

- 不加角色语音，不改合法动作规则或接入 LLM 服务。

## 交接与停止条件

- 只实施 P9；先读总纲、依赖任务卡与上述真实代码路径，不把计划新增文件当现有能力。
- 先完成本机可验收部分；NAS不可达不是停止本地开发的理由，但不得把NAS项标为通过。
- 如前置契约尚未实现或存在矛盾，先给出具体文件/调用链证据，解决前置边界后再推进，禁止用假接口或第二套规则绕过。
- 每个小批次记录变更和检查证据；阶段完成时更新本卡状态，未验证项继续明确保留。
- 不擅自提交、推送、部署；新增测试或运行测试按当前明确授权执行，不建立额外测试体系。
