# P22.3 第 10 名角色：椿（Tsubaki）设定与实现记录

> 状态：2026-10-19 已完成接入与本地全套验证（资产、角色名册、收束关 `tsubaki-finale`、点差逆转 AI、双语文案与四阶段故事、永久装饰奖励及测试全部通过）。

## 1. 已确认设定

| 项目 | 定稿 |
| --- | --- |
| 身份 | 神秘的雀庄老板（店主），年长的成熟女性，沉稳带笑；P19 第一季收束关的对手 |
| 打法 | **逆风翻盘型 / 终局压力型**：看点差——落后时提高立直与打点攻击性；领先时保位收手；其余局面均衡偏防守 |
| 主角色 | **可选**。通关巡礼第一季收束关（第 9 关之后）解锁；AI 对手池也可遇到 |
| 美术 | 与现有立绘一致（半写实日系、白底、1024×1536）；配色**金 / 酒红 + 深墨绿**；和风 / 大正浪漫服饰 |

## 2. 角色定义草案（接入代码时使用）

- `id: 'tsubaki'`，历史名册**追加**到 `CHARACTER_DEFS` 末尾（`aoi` 之后），不改既有顺序与外观奖励 ID。
- `rankBand: 'master'`（强度定位在大师档；不进入段位战固定名单之外的强度特权）。
- `style`（草案，基线；逆风/领先的动态修正走 `aiStrategy.ts` 的点差逻辑，不新增偷看信息）：

  ```
  callAggression: 0.4, riichiAggression: 0.75, defenseBias: 0.6, valueBias: 0.7, flushBias: 0.3
  ```
- `styleTagKeys`: `character.tag.comeback`（新增：逆风翻盘）、`character.tag.balanced`。
- `unlockRule`：需新增 `{ type: 'journey-stage', target: 'tsubaki-finale' }`（由巡礼收束关完成记录判定），必须保证“已解锁即可选用”，旧存档不受影响。
- 需新增：九关之外的收束关 `tsubaki-finale`（`journey_attempts` 的 stage CHECK 需再迁移）、四阶段故事键、双语名称/台词/简介、AI 点差倾向（只用公开点差/局数）。

## 3. 角色设定文本（供出图与文案）

- 外貌：约 30 岁出头，高挑，酒红色波浪长发在脑后松松盘起，一缕垂在肩前；深墨绿色眼眸，眼角有一点泪痣；神情从容，嘴角带着看透一切的浅笑。
- 服饰：大正浪漫——酒红底、金色刺绣山茶花的羽织，内搭深墨绿高领和服式连衣裙，金色细腰带、流苏与小小的麻将牌形发簪（或牌形吊坠，需为抽象装饰，不含可辨认的具体牌面）。
- 气质：雀庄的老板，总是在你以为大局已定时，微笑着把点棒推回牌桌中央。
- 一句话标语：`点差会说话，我只负责听。` / `The score gap talks. I only listen.`

## 4. 出图提示词（可直接给其他 AI）

**共用基底（每张都带上，保持角色一致）**

```
Semi-realistic Japanese anime illustration, visual-novel character sprite, a single character,
three-quarter-body standing portrait (head to mid-thigh), plain pure white background (#FFFFFF),
no text, no watermark, no frame, no shadow on the ground, clean lineart, soft cel shading,
highly detailed hair strands and fabric texture, consistent character design.

Character: a mature, elegant Japanese woman in her early thirties, the owner of a mahjong parlor.
Tall, graceful posture. Long wavy WINE-RED hair loosely pinned up at the back of the head with one
lock falling over her shoulder, a small gold hairpin shaped like an abstract rectangular tile with
a tassel (no readable tile faces). Deep DARK-GREEN eyes, a small beauty mark under the left eye,
calm knowing expression. Outfit: Taisho-romance style — a wine-red haori with gold embroidered
camellia flowers over a dark-green high-collar kimono-style dress, thin gold obi cord with tassel.
Color palette: wine red, antique gold, deep ink green, cream skin tones.
Output size 1024x1536 (portrait, 2:3), character centered with margin around, same lighting and
same art style as the existing cast.
```

**normal.webp（默认）**

```
[基底] Expression: calm, gentle closed-lip smile, half-lidded confident eyes, one hand resting
lightly in the other in front of her waist, head tilted very slightly.
```

**happy.webp（和牌/领先）**

```
[基底] Expression: a warm, genuinely delighted smile with eyes slightly crescent, cheeks faintly
flushed, one hand raised near her mouth as if elegantly covering a soft laugh, slightly leaning forward.
```

**frustrated.webp（放铳/落后）**

```
[基底] Expression: a rueful half-smile with furrowed brows and one eye slightly narrowed,
sighing, one hand touching her temple, the other holding her sleeve; composed but clearly a bit annoyed.
```

**avatar.webp（头像，256×256）**

```
Same character and style as above, close-up bust/face portrait cropped to a square,
face centered, shoulders and hairpin visible, plain pure white background, 1:1 ratio,
export 256x256 (generate larger e.g. 1024x1024 and downscale).
```

**一致性小技巧**：先出 `normal`，其余三张以它为参考图（image-to-image / 角色参考），并在提示词里重复“same character, same outfit, same hairstyle”。

## 5. 交付规格（资产到位后我来接入）

放到 `src/assets/characters/tsubaki/`：

| 文件 | 尺寸 | 格式 |
| --- | --- | --- |
| `normal.webp` | 1024×1536 | WebP，白底 |
| `happy.webp` | 1024×1536 | WebP，白底 |
| `frustrated.webp` | 1024×1536 | WebP，白底 |
| `avatar.webp` | 256×256 | WebP |

## 6. 接入清单（资产到位后）

1. 资产与 `src/assets/characters/index.ts` 映射；`playerCharacters.ts` 追加定义与新解锁规则类型。
2. 收束关 `tsubaki-finale`：关卡定义、目标判定（可由合法重放事件判定：例如“在落后 ≥ N 点时完成逆转进入前二/不放铳收官”，待实现前再定）、`journey_attempts` CHECK 迁移与 `normalizeJourneyProgress`。
3. AI：点差感知（落后增强立直/打点，领先收手），只用公开信息；加入 P14 对比基准与“不窥探他家”测试。
4. i18n：名称、标语、简介、标签、台词（match-start/riichi/ron/tsumo 各 3，其余各 2）、四阶段故事、收束关文案（中英）。
5. 旧档案加载、角色页、牌桌、结算、故事全路径检查；浅/深色、桌面/手机截图。
6. 测试：名册顺序不变、旧外观奖励 ID 不变、未解锁不可选、解锁后可选、旧存档兼容。
