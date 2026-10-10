# P4 局内演出：和牌演出 / 终局复盘 / 牌桌闲聊

> 依赖：P2（立绘、Cut-in、台词气泡）、P3（段位结算页）。先读 [README](./README.md)。
> 目标：让和牌「爽」、让输了「知道为什么输」、让牌桌「有人味」。
> 建议拆 2 次执行：4.1（和牌演出）→ 4.2–4.3（复盘 + 闲聊）。

## 涉及文件（先读）

- [components/Modals.tsx](../../src/pages/mahjong/japanese/components/Modals.tsx)（现有和牌/流局弹窗）
- [components/ReplayViewer.tsx](../../src/pages/mahjong/japanese/components/ReplayViewer.tsx)、[trainingAdvice.ts](../../src/pages/mahjong/japanese/trainingAdvice.ts)、[components/TrainingPanel.tsx](../../src/pages/mahjong/japanese/components/TrainingPanel.tsx)
- [lib/riichiSettlement.ts](../../src/lib/riichiSettlement.ts)、[engine/evaluate.ts](../../src/pages/mahjong/japanese/engine/evaluate.ts)
- [hooks/useScreenShake.ts](../../src/hooks/useScreenShake.ts)、[hooks/useRiichiSounds.ts](../../src/hooks/useRiichiSounds.ts)、[useRiichiEffectSounds.ts](../../src/pages/mahjong/japanese/useRiichiEffectSounds.ts)
- P2 的 `SpeechBubble`、Cut-in 组件；P3 的段位结算页

---

## 4.1 和牌演出升级

替换现有和牌弹窗为分步演出（`WinPresentation` 组件），时间轴：

| 步骤 | 时长 | 内容 |
|------|------|------|
| 1 | — | P2 Cut-in（已有） |
| 2 | 400ms | 和牌手牌横向展开，和了牌金色描边上浮；副露列在右侧 |
| 3 | 每条 180ms | 役种逐条从右滑入：「立直 1 番」「一发 1 番」… 役满役种用金底 |
| 4 | 300ms | 宝牌/里宝牌指示牌翻开，命中数计入 |
| 5 | 400ms | 合计「4 番 30 符」→ 点数大字从 0 滚动到最终值 |
| 6 | — | 档位标签 + 特效（见下表），随后显示点数移动（四家 ±） |

| 档位 | 标签 | 特效 |
|------|------|------|
| < 满贯 | 无 | 无 |
| 满贯 | 满贯 | 金色闪光扫过 |
| 跳满 | 跳满 | 闪光 + 轻微震屏 |
| 倍满 / 三倍满 | 倍满 / 三倍满 | 金色粒子爆发 + 震屏 |
| 役满 / 双倍役满 | 役满 | 全屏暗场 + 彩虹描边 + 大字竖排 + 强震屏 + 专属音效 |

- 任意时刻点击 → 直接跳到最终状态；再次点击 → 继续。
- 遵守 P2 的「演出强度」：简化 = 直接显示最终状态但保留档位标签；关闭 = 使用简洁卡片。
- `prefers-reduced-motion` 时禁用震屏与粒子。
- 粒子用 CSS/Canvas 2D 实现即可，不引入新库。
- 流局也做轻量演出：听牌者手牌亮出 + 「流局 / 听牌 / 不听」标签 + 罚符移动。

## 4.2 终局复盘

**目标**：每场结束后给出「关键决策」列表，告诉玩家哪里和 AI 判断不同。

- 数据：对局过程中已有日志与回放（`RiichiReplayFile`）。复盘时离线重放：对玩家每次打牌决策，用 **expert AI**（P3）在相同局面下求推荐打牌。
- 关键决策判定（满足任一即入选，最多展示 8 条，按影响排序）：
  1. 玩家打牌与 AI 推荐不同，且向听数变差或有效进张少 ≥ 4 张；
  2. 玩家放铳的那一打（显示放铳牌、对手当时状态：立直/副露/巡目、AI 推荐的安全牌）；
  3. 听牌时 AI 建议默听/立直而玩家相反，且结果有明显差异。
- 每条显示：局名巡目（东2局 7巡）、当时手牌、玩家打出 vs AI 推荐（并列两张牌高亮）、一句原因（复用/扩展 `trainingAdvice.ts` 的文案生成）、「在回放中查看」跳转到 `ReplayViewer` 对应步。
- 复盘页顶部汇总：和了率、放铳率、立直率、副露率、平均和了打点（本场）。
- 入口：段位结算页「复盘」按钮（P3 预留）、自由对局终局弹窗、Profile 最近战绩每条记录（仅最近一场可复盘，复用 `saveLastReplay`）。
- 计算放到 `requestIdleCallback` 或分片执行，打开复盘页时显示进度，不能卡住 UI。

## 4.3 牌桌闲聊

在 P2 事件台词基础上，增加低频「环境闲聊」：

| 触发 | 说话人 | 概率 |
|------|--------|------|
| 有人立直 | 其他某个角色（非立直者） | 40% |
| 自己连续 8 巡未进张（向听不变） | 该角色 | 20% |
| 被他家和牌（非放铳者） | 某个旁观角色 | 30% |
| 自家点数跌到末位且进入南场/All Last | 该角色 | 50% |
| 他家和出满贯以上 | 某个旁观角色 | 60% |
| 连续两局流局 | 随机 | 30% |
| 玩家打出危险牌后幸存（他家立直中打无筋中张未被荣） | 某个角色 | 25% |

- 频控：全桌每 8s 最多 1 条；同一角色每 20s 最多 1 条；Cut-in 期间不出闲聊。
- 每角色每个触发 2–3 句，新增约 8×7×2–3 ≈ 150 句，zh + en，语气贴合 P2 人设（如 `yoru` 话少、句短）。
- 设置面板加「闲聊」开关（默认开）。
- 闲聊选择逻辑放 `src/pages/mahjong/japanese/chatter.ts`，订阅 `subscribeRiichiEffects` 与局面变化，不进入 engine（不影响对局可复现性）。

---

## 验收

1. 和出 1000 点小牌：演出简短；和出满贯/倍满/役满（可用自由对局 + 固定 seed 或调试手段构造）：特效逐级增强，点击可跳过。
2. 演出强度「关闭」时和牌只显示简洁卡片。
3. 一场段位战结束后点「复盘」：数秒内生成关键决策列表；放铳那一手必定在列表中；点击可跳转回放到对应步。
4. 对局中能看到闲聊气泡，频率不打扰（一局东风战约 5–10 条）；关掉开关后只剩事件台词。
5. 中英文下所有新文案正常。

## 不做

- 不做外观相关的和牌特效变体（P5 商店提供）。
- 不做语音。
- 不做跨多场的长期数据分析报告（只做单场复盘）。
