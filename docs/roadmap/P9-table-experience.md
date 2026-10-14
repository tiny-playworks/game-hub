# P9 牌桌交互与视听品质

> 依赖：P8 设计与主要页面验收通过。先读 [README](./README.md)。
> 目标：操作反馈明确，出牌/鸣牌/立直手感统一，手机能完成一整场。
> 状态：本机验收完成（含整场连续动作链与 390×844 手机视口整场闭环）；真实手机音频及 NAS 待现场验证。

## 涉及文件（先读）

- [src/pages/mahjong/japanese/index.tsx](../../src/pages/mahjong/japanese/index.tsx) — 用户操作与快捷键，集成 `useTileInteraction` 与牌桌触控穿透。
- [src/pages/mahjong/japanese/useRiichiViewModel.ts](../../src/pages/mahjong/japanese/useRiichiViewModel.ts) — 展示数据。
- [src/pages/mahjong/japanese/components/Tile.tsx](../../src/pages/mahjong/japanese/components/Tile.tsx) — 手牌选中浮起反馈（`selected`、`aria-pressed`、触控事件支持）。
- [src/pages/mahjong/japanese/components/MeldTiles.tsx](../../src/pages/mahjong/japanese/components/MeldTiles.tsx) — 鸣牌方向与暗杠标准呈现（外侧盖牌 TileBack、内侧翻开）。
- [src/pages/mahjong/japanese/components/WinPresentation.tsx](../../src/pages/mahjong/japanese/components/WinPresentation.tsx) — 和牌演出与 reduced-motion 适配。
- [src/pages/mahjong/japanese/useRiichiEffectSounds.ts](../../src/pages/mahjong/japanese/useRiichiEffectSounds.ts) — 事件音效调度。
- [src/hooks/useRiichiSounds.ts](../../src/hooks/useRiichiSounds.ts) — 本地音频合成、静音拦截与手机端首次手势 AudioContext 解锁。
- [src/lib/playerProfile.ts](../../src/lib/playerProfile.ts) — 演出（full/simple/off）、音量（bgm/sfx/voice）与偏好持久化。
- [src/pages/mahjong/japanese/useRiichiAutomation.ts](../../src/pages/mahjong/japanese/useRiichiAutomation.ts) — 单机自动调度。

## 新增文件

- [src/pages/mahjong/japanese/useTileInteraction.ts](../../src/pages/mahjong/japanese/useTileInteraction.ts) — 鼠标/触控/键盘统一选牌、双击防抖与滚动误触取消。
- [src/pages/mahjong/japanese/components/TableFeedback.tsx](../../src/pages/mahjong/japanese/components/TableFeedback.tsx) — 选牌操作栏（`SelectedTileBar`）、动作反馈浮层（`TableActionToast`）、新手操作指引（`NoviceControlsGuide`）。
- [src/pages/mahjong/japanese/table-feedback.css](../../src/pages/mahjong/japanese/table-feedback.css) — 牌桌选中光效、浮起动效、44px 触控区保底与 reduced-motion。
- [tests/riichi-p9-interaction.test.tsx](../../tests/riichi-p9-interaction.test.tsx) — 选牌、快捷键、防误触与偏好单元测试套件。
- [tests/riichi-p9-e2e.test.tsx](../../tests/riichi-p9-e2e.test.tsx) — 开局选牌、静音、新手引导、触控防滚、整场连续动作链（出牌→暗杠/副露鸣牌→立直→自摸和牌→结算→下一局）及 390×844 模拟手机整场完赛测试。

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

## 验收：本机（已全部验证通过）

1. **基础选牌、操作提示与整场连续动作链已验证**：
   - `tests/riichi-p9-e2e.test.tsx` 已完整覆盖选牌、取消、键盘选牌、静音、引导，以及「出牌 → 暗杠/副露（吃/碰）鸣牌 → 立直宣言 → 自摸和牌 → 结算弹窗 → 下一局」的连续对局动作链。
   - 鼠标：点击手牌选中（升起 8px 加金色投影），再次点击或点击出牌栏确认打出。
   - 键盘：ArrowLeft / ArrowRight 循环选择合法手牌，Enter 确认出牌，Esc 取消选择/退出立直/跳过副露。
   - 鸣牌快捷键：R 立直、T 自摸、C 吃、P 碰、K 杠。
2. **模拟触控防滚、44px 触控区及模拟手机（390×844）完整一场已验证**：
   - 验证证据：`tests/riichi-p9-interaction.test.tsx`（触控位移 > 10px 取消选牌）、`tests/riichi-p9-e2e.test.tsx`（触控模拟滚动不误选、390×844 手机视口触控选牌确认并连续打完一整场东风战直至终局弹窗）。
   - 触控防抖：移动端轻触后拦截 650ms 内浏览器合成的重复 click 事件，避免单次点击直接将选中牌打出。
   - 触控区保底：选牌操作栏确认按钮 `min-height: 44px; min-width: 80px`，取消按钮 `min-height: 44px; min-width: 56px`；顶部静音按钮 `min-w-11 min-h-11` (44px)。
   - 暗杠呈现：`MeldTiles.tsx` 中暗杠两端扣翻展示牌背（`TileBack`），中间两张翻开。
3. **静音按钮与偏好已在本机核对；真实音频待验**：
   - 2026-10-14：音效复用首次手势解锁的 AudioContext；静音会停止正在播放的语音、TTS 与合成音效。浏览器核对按钮从“静音”切到“开启声音”，前端类型检查及构建通过；真实手机播放、即时截断和刷新后的音频行为待现场听测。
   - 演出模式：设置面板支持 `full` / `simple` / `off`，`table-feedback.css` 与 `presentation.css` 包含 `@media (prefers-reduced-motion: reduce)` 规则，动画耗时压缩至 0.01ms 并取消震荡位移。
4. **重复渲染/恢复存档不重复播放奖励/音效；段位无训练辅助**：
   - 验证证据：`riichiMatchStore.ts` 中 `resumeSaved` 重置 `cutIns: []` 和 `moments: []`，且不重复发出 effects 触发音效；AI 段位战下 `dangerHint={!isRanked && riichiSettings.dangerHint}` 严格关闭，设置面板中自动隐藏放铳危险度选项。
   - 回归验证：2026-10-14 全仓 73 个测试文件（525 项测试）100% 通过。

## 验收：真实 NAS（当前待现场验证）

1. 实际手机音频首次手势解锁、触屏操作与较低性能设备检查。

## 不做

- 不加角色语音，不改合法动作规则或接入 LLM 服务。

## 交接与停止条件

- 只实施 P9；总纲与任务卡更新完成。
- 本机可验收部分全部闭环通过；NAS 项明确保留为现场待验。
- 不擅自提交、推送、部署。
