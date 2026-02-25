# 音效资源清单（日麻 / 川麻 / 国标）

## 已接入的（public/sounds/riichi/）

以下 6 个文件由 `iroha/` 复制到 `public/sounds/riichi/`，经 **use-sound** 播放：

| 文件 | 用途 | 使用页面与触发时机 |
|------|------|--------------------|
| `rich.wav` | 立直 | 仅日麻：玩家点击「立直宣言」 |
| `chi.wav` | 吃 | 日麻：选择吃并确认；**国标**：选择吃并确认 |
| `pon.wav` | 碰 | 日麻/川麻/国标：选择碰并确认 |
| `kan.wav` | 杠 | 日麻/川麻/国标：明杠/暗杠/加杠确认 |
| `tumo.wav` | 自摸 | 日麻/川麻/国标：自摸和了时 |
| `ron.wav` | 荣和/点炮胡 | 日麻：荣和；川麻/国标：点炮胡 |

- **日麻**：`src/hooks/useRiichiSounds.ts` → `GameMahjongJapanese.tsx`（含立直、打牌/摸牌/流局 TTS 日文）。
- **川麻 / 国标**：`src/hooks/useMahjongSounds.ts` → `GameMahjongSichuan.tsx`、`GameMahjongChinese.tsx`，复用上述 5 个 wav（无立直），打牌/摸牌/流局用**中文 TTS**（见下）。

---

## 还差不少的（建议补全）

### 高优先级（对局中频繁触发）

| 类型 | 说明 | 建议文件名/用途 | 获取建议 |
|------|------|-----------------|----------|
| **打牌** | 出牌时牌落桌/碰桌面 | `discard.wav` / `tile_put.wav` | 每手出牌都会用，小森平「卓上」「カチ」、freesound "tile" "table" |
| **摸牌** | 从牌墙摸牌 | `draw.wav` / `tile_draw.wav` | 每轮摸牌一次，同上或短促的「カサ」声 |

### 中优先级（和了/流局/界面）

| 类型 | 说明 | 建议文件名 | 获取建议 |
|------|------|------------|----------|
| **和了效果音** | 非语音，短促的「胡了」提示音 | `agari_se.wav` / `win.wav` | 可与 tumo/ron 语音叠用或二选一；小森平「達成」「正解」类 |
| **流局** | 荒牌/流局提示 | `ryuukyoku.wav` / `draw_game.wav` | 可选，一句提示或短 BGM |
| **按钮/UI 点击** | 通用点击反馈 | `click.wav` / `button.wav` | 可共用 across 游戏，极短 0.1s 内 |

### 低优先级（可选）

| 类型 | 说明 |
|------|------|
| 宝牌表示牌翻开 | 开局/杠后翻开里宝时，短翻牌声 |
| 一发/里宝提示 | 若做提示 UI，可配短提示音 |
| BGM | 对局 BGM、结果画面 BGM，按需 |

---

## 无资源时用浏览器 TTS

打牌、摸牌、流局暂无 wav，已用**浏览器自带 TTS**（`src/lib/speech.ts`，`speechSynthesis`）播报：

| 场景 | 日麻 TTS | 川麻/国标 TTS |
|------|----------|----------------|
| 打牌 | ぽん | 出 |
| 摸牌 | ひ | 摸 |
| 流局 | りゅうきょく | 流局 |

补全 `discard.wav` / `draw.wav` / `ryuukyoku.wav` 后，可在各自 hook 中改为优先播 wav、失败再回退 TTS（或仅用 wav 关闭 TTS）。

## 格式与放置建议

- **格式**：现有为 `.wav`，可继续用；若考虑体积可另备 `.ogg`/`.mp3` 做 fallback。
- **放置**：日麻专用集中在 `public/sounds/riichi/`；新增文件放同目录即可。
- **引用**：`useRiichiSounds` 内使用 `/sounds/riichi/xxx.wav`。

---

## 免费素材参考

- **小森平的免费下载音效**（桌面游戏・牌类）：https://taira-komori.jpn.org/playing01cn.html  
- **Freesound**：搜 "mahjong" "tile" "table tap" "card" "click" 等，筛选 CC0/CC-BY  
- **爱给网 / 像素实验室**：搜「麻将」「牌」「点击」，注意商用授权  

先补**打牌 + 摸牌**两个，对局体验提升最明显；其次和了效果音与流局、再考虑 UI 点击与其它可选。

---

## 麻将通用动画（日麻 / 川麻 / 国标共用）

使用 **Tailwind + 自定义 keyframes**（`src/App.css`），无额外库；三类麻将均使用同一套 class，视觉一致：

| 场景 | 动画 | 说明 |
|------|------|------|
| 刚摸的牌 | `animate-riichi-tile-drawn` | 淡入 + 微缩放（0.25s） |
| 当前要出的牌（刚摸高亮） | `animate-riichi-active-pulse` | 金圈脉动（1.2s 循环） |
| 和了弹窗 | `animate-riichi-overlay-in` + `animate-riichi-modal-in` | 遮罩淡入、弹窗缩放入场（0.2s） |
| 流局弹窗 | 同上 | 国标流局与和了弹窗一致 |

- **日麻**：`GameMahjongJapanese.tsx` 已接入。
- **川麻**：`GameMahjongSichuan.tsx` 已接入（和了弹窗 + 摸牌高亮）。
- **国标**：`GameMahjongChinese.tsx` 已接入（和了弹窗 + 流局弹窗 + 摸牌高亮）。

如需扩展：打牌飞出、副露摊开等可在 `App.css` 增加 keyframes 后绑到对应 DOM。
