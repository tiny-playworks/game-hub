# P2 角色：8 名对手角色（数据 / 立绘 / AI 风格 / 台词 / Cut-in）

> 依赖：P1。先读 [README](./README.md)。
> 目标：角色从「名字牌」变成「坐在牌桌对面的人」。对手座位显示角色，AI 按角色风格打牌，立直/和牌时有 Cut-in 与台词气泡。
> 建议拆 3 次执行：2.1–2.3（数据+立绘接入）→ 2.4（AI 风格）→ 2.5–2.7（座位/台词/Cut-in）。

## 涉及文件（先读）

- [playerCharacters.ts](../../src/lib/playerCharacters.ts) — 现有 3 角色、解锁规则、好感
- [CharacterPortraitSlot.tsx](../../src/components/characters/CharacterPortraitSlot.tsx)
- 日麻：[engine/ai.ts](../../src/pages/mahjong/japanese/engine/ai.ts)、[engine/rules.ts](../../src/pages/mahjong/japanese/engine/rules.ts)、[engine/round.ts](../../src/pages/mahjong/japanese/engine/round.ts)（`RiichiEffect` / `RiichiSound`）、[engine/match.ts](../../src/pages/mahjong/japanese/engine/match.ts)
- [store/riichiMatchStore.ts](../../src/pages/mahjong/japanese/store/riichiMatchStore.ts)（`subscribeRiichiEffects`）、[useRiichiAutomation.ts](../../src/pages/mahjong/japanese/useRiichiAutomation.ts)
- [components/OpponentSeat.tsx](../../src/pages/mahjong/japanese/components/OpponentSeat.tsx)、[RiichiDesktopStage.tsx](../../src/pages/mahjong/japanese/components/RiichiDesktopStage.tsx)、[RiichiSettingsPanel.tsx](../../src/pages/mahjong/japanese/components/RiichiSettingsPanel.tsx)

---

## 2.1 角色名册

保留现有 3 人（id 不变，兼容老存档），新增 5 人。`rankBand` 决定其在段位战中出现的段位带（P3 使用）。

| id        | 名字 | 段位带 | 风格                       | 一句话人设                       |
| --------- | ---- | ------ | -------------------------- | -------------------------------- |
| `koharu`  | 小春 | 初心   | 随性新手：爱鸣牌、不太防守 | 刚学会麻将的元气学妹，输了也开心 |
| `mio`     | 澪   | 初心   | 稳健防守                   | 现有角色，冷静理性，先理顺手牌   |
| `rin`     | 凛   | 雀士   | 鸣牌速攻                   | 现有角色，急性子，速度就是一切   |
| `chitose` | 千岁 | 雀士   | 均衡门清                   | 茶馆看板娘，教科书式打法         |
| `sora`    | 空   | 雀杰   | 大牌打点                   | 现有角色，追求节奏与打点         |
| `aya`     | 绫   | 雀杰   | 立直狂                     | 能立就立的赌徒气质大姐姐         |
| `mahiru`  | 真昼 | 雀豪   | 染手（混一/清一）          | 偏爱一色的画家，牌河也要好看     |
| `yoru`    | 夜   | 雀圣   | 读牌大师（攻守兼备）       | 雀庄的传说，最终 Boss，话很少    |

角色人设、bio、标签文案由执行方按上表撰写（zh + en）。

## 2.2 数据结构扩展

扩展 `CharacterDef`（保持已有字段，`portraitKey` / `voicePackId` / `themeToken` 保留）：

```ts
type RankBand = 'novice' | 'adept' | 'expert' | 'master' | 'saint'; // 初心/雀士/雀杰/雀豪/雀圣

interface CharacterStyle {
  callAggression: number; // 0–1 鸣牌倾向
  riichiAggression: number; // 0–1 立直倾向（vs 默听）
  defenseBias: number; // 0–1 越高越早弃和
  valueBias: number; // 0–1 越高越追求打点
  flushBias: number; // 0–1 染手倾向
}

type LineTrigger =
  | 'match-start'
  | 'riichi'
  | 'ron'
  | 'tsumo'
  | 'deal-in'
  | 'call'
  | 'ryuukyoku-tenpai'
  | 'match-top'
  | 'match-last';

interface CharacterDef {
  // ...existing
  rankBand: RankBand;
  style: CharacterStyle;
  styleTagKeys: string[]; // 如 ['character.tag.defense']
  expressions: { normal: string; happy: string; frustrated: string }; // 资源路径
  lines: Record<LineTrigger, string[]>; // i18n key 数组，每个触发 2–3 条随机
}
```

解锁规则扩展：`unlockRule.type` 新增 `'rank-band'`（达到该段位带即解锁，P3 生效）。

- 默认解锁：`koharu`、`mio`。
- `rin` / `sora` 保留旧规则，并与 `rank-band` 取「或」；老玩家已解锁的不回收。
- 解锁 = 可设为**主角色**（大厅展示 + 自己的 Cut-in 头像）。作为对手出现不需要解锁。

## 2.3 立绘资源

- 目录：`src/assets/characters/{id}/{normal,happy,frustrated}.webp`，另出一张 `avatar.webp`（256×256 头像裁切）。
- 规格：竖版 1024×1536，透明背景，半身（腰以上），人物居中偏上，三张表情同一姿势仅改表情/手势。
- 生成提示词模板（统一画风，逐角色替换括号内容）：

```
anime style half-body character portrait, Japanese mahjong parlor theme,
soft cel shading, clean lineart, warm lighting, transparent background,
waist-up, facing slightly left, {角色外观：发色/发型/服装/配饰},
expression: {normal calm smile | happy bright laugh | frustrated pouting},
consistent character design, high quality, no text, no watermark
```

- `CharacterPortraitSlot` 改造：有资源时显示图片（`size` 新增 `xl` 用于大厅、`cutin` 用于 Cut-in），无资源时保持现有渐变占位。资源未齐时一切功能可用。

## 2.4 AI 打法风格

在 [ai.ts](../../src/pages/mahjong/japanese/engine/ai.ts) 中让 `decideAiTurn` / `decideAiClaim` 接收可选 `CharacterStyle`，用参数调制现有判断，**不重写 AI**：

| 参数               | 作用点                                                 |
| ------------------ | ------------------------------------------------------ |
| `callAggression`   | 是否吃/碰/明杠的阈值（高 → 有役即鸣、甚至为速度鸣牌）  |
| `riichiAggression` | 听牌时立直 vs 默听；低打点/差听牌时是否仍立直          |
| `defenseBias`      | 面对立直/副露威胁时转 defend 的向听数/打点阈值         |
| `valueBias`        | `evaluateTileValue` 中役牌、宝牌、断幺等打点要素的权重 |
| `flushBias`        | 某花色占比 ≥ 阈值时倾向保留该色、打出他色              |

- 风格在 beginner / standard 两档上都要生效（P3 再加 strong/expert）。
- 对局状态里记录每个座位的 `characterId`（`RiichiMatchState` 增加 `seatCharacters: [null, id, id, id]`，座位 0 为玩家），存档/回放需兼容旧数据（缺省时用默认三人）。
- AI 决策保持纯函数、可复现（同 seed 同结果）。

## 2.5 对手座位展示

- `OpponentSeat` 增加角色头像（avatar）、名字、1 个风格标签；当前行动者头像有呼吸光圈。
- 自由对局开局前可选 3 名对手（默认随机，从已遇到/全部角色中选）；**主角色不会作为对手出现**。
- 玩家座位显示主角色头像。

## 2.6 台词气泡

- 新增 `RiichiEffect` 类型：`{ type: 'moment'; kind: LineTrigger; seat: number }`，在 `round.ts` / `match.ts` 对应时机推入（放铳的 `deal-in` 由和牌结算推导放铳者）。
- 新组件 `SpeechBubble`：显示在对应座位旁，2.5s 自动消失，同座位不叠加。
- 选句：从角色 `lines[kind]` 随机（用 seeded random 或非关键随机均可，台词不影响对局）。
- 每名角色每个触发 2–3 句，共 8×9×2–3 ≈ 180 句，zh + en。

## 2.7 Cut-in 演出

- 触发：任意座位**立直**、**荣和**、**自摸**。玩家座位用主角色。
- 表现：牌桌中部横向斜切色带（角色 accent 色）从一侧滑入 → 半身立绘（立直/和牌用 `happy`，被他人和牌时不触发）+ 大字「立直！/ 荣！/ 自摸！」+ 台词 → 900ms 后滑出。
- 期间 `useRiichiAutomation` 暂停 AI 推进，结束后继续；点击可跳过。
- 设置面板新增「演出强度」：完整 / 简化（仅大字，无立绘）/ 关闭。存入现有日麻设置。

---

## 验收

1. 自由对局中三名对手显示头像、名字、风格标签；立绘未到位的角色显示渐变占位且不报错。
2. 选「凛 + 小春 + 绫」与「澪 + 千岁 + 夜」各打 2 局，能直观感到前者鸣牌/立直明显更多。
3. 任何人立直、和牌都有 Cut-in；演出强度切到「关闭」后无 Cut-in 但仍有台词气泡。
4. 开局、立直、放铳、终局一位/四位时角色会说对应台词，中英文切换正常。
5. 旧日麻存档可继续，旧回放可播放。
6. 大厅主角色显示大立绘；可在 Profile 中切换已解锁的主角色。

## 不做

- 不做段位、对手按段位匹配（P3）。
- 不做好感故事与角色档案页（P5），好感逻辑保持现状。
- 不做牌桌闲聊（P4，仅本阶段的事件台词）。
- 不做语音。
