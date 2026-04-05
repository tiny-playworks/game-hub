# 音效与动画资源（日本立直麻将）

本仓库**仅维护日本立直麻将（日麻）**对局；音效与动画说明如下，不再描述其它麻将规则。

## 已接入（public/sounds/riichi/）

**音量与档案（2026-04-05）**：对局 wav / beep 使用 `playerProfile.audioVolumes.sfx`（0～1）；立直 TTS 等使用 `audioVolumes.voice`；档案页可设 BGM/SFX/语音三档，`bgm` 待接大厅与对局 BGM。

以下文件由 `iroha/` 复制到 `public/sounds/riichi/`，经 **use-sound** 播放：

| 文件         | 用途   | 触发时机（日麻）        |
| ---------- | ---- | ---------------- |
| `rich.wav` | 立直宣言 | 玩家点击「立直宣言」      |
| `chi.wav`  | 吃    | 选择吃并确认           |
| `pon.wav`  | 碰    | 选择碰并确认           |
| `kan.wav`  | 杠    | 明杠 / 暗杠 / 加杠 确认 |
| `tumo.wav` | 自摸   | 自摸和了时            |
| `ron.wav`  | 荣和   | 荣和时              |

- **对局内播放**：`src/hooks/useRiichiSounds.ts` → 日本立直麻将页面（含立直、打牌 / 摸牌 / 流局等 TTS 日文，见 `src/lib/speech.ts`）。

`src/hooks/useMahjongSounds.ts` 为同类 wav 的轻量封装，**当前无其它麻将规则页面**；主要用于单元测试，对局请以 `useRiichiSounds` 为准。

---

## 待补全（建议）

### 高优先级（对局中频繁触发）

| 类型   | 说明          | 建议文件名                       | 获取建议                                         |
| ---- | ----------- | ---------------------------- | -------------------------------------------- |
| 打牌   | 出牌时牌落桌 / 碰桌面 | `discard.wav` / `tile_put.wav` | 每手出牌都会用，小森平「卓上」「カチ」、freesound "tile" "table" |
| 摸牌   | 从牌墙摸牌       | `draw.wav` / `tile_draw.wav`   | 每轮摸牌一次，同上或短促的「カサ」声                           |

### 中优先级（和了 / 流局 / 界面）

| 类型        | 说明             | 建议文件名                             | 获取建议                              |
| --------- | -------------- | --------------------------------- | --------------------------------- |
| 和了效果音     | 非语音，短促提示       | `agari_se.wav` / `win.wav`        | 可与 tumo/ron 语音叠用或二选一；小森平「達成」「正解」类 |
| 流局        | 荒牌 / 流局提示      | `ryuukyoku.wav` / `draw_game.wav` | 可选，一句提示或短 BGM                     |
| 按钮 / UI 点击 | 通用点击反馈         | `click.wav` / `button.wav`        | 可跨游戏共用，极短 0.1s 内                    |

### 低优先级（可选）

| 类型      | 说明              |
| ------- | --------------- |
| 宝牌表示牌翻开 | 开局 / 杠后翻开里宝时，短翻牌声 |
| 一发 / 里宝提示 | 若做提示 UI，可配短提示音    |
| BGM     | 对局 BGM、结果画面 BGM，按需 |

---

## 无资源时的 TTS 兜底

打牌、摸牌、流局暂无 wav 时，使用浏览器 **TTS**（`src/lib/speech.ts`）：

| 场景 | 日麻 TTS（示例） |
| --- | ----------- |
| 打牌 | ぽん          |
| 摸牌 | ひ           |
| 流局 | りゅうきょく      |

补全 `discard.wav` / `draw.wav` / `ryuukyoku.wav` 后，可在 `useRiichiSounds` 中优先播 wav，失败再回退 TTS。

## 格式与放置

- **格式**：现有为 `.wav`；若考虑体积可另备 `.ogg`/`.mp3` 做 fallback。
- **目录**：日麻资源集中在 `public/sounds/riichi/`。
- **引用**：`useRiichiSounds` 内使用 `/sounds/riichi/xxx.wav`。

## 免费素材参考

- **小森平的免费下载音效**（桌面游戏・牌类）：[https://taira-komori.jpn.org/playing01cn.html](https://taira-komori.jpn.org/playing01cn.html)
- **Freesound**：搜 "mahjong" "tile" "table tap" "card" "click" 等，筛选 CC0/CC-BY
- **爱给网 / 像素实验室**：搜「麻将」「牌」「点击」，注意商用授权

优先补 **打牌 + 摸牌** 两个 wav，对局体验提升最明显。

---

## 对局动画（日麻）

使用 **Tailwind + 自定义 keyframes**（`src/App.css`），无额外库：

| 场景        | 动画                                                      |
| --------- | ------------------------------------------------------- |
| 刚摸的牌      | `animate-riichi-tile-drawn`（淡入 + 微缩放）                    |
| 当前要出的牌（高亮） | `animate-riichi-active-pulse`（金圈脉动循环）                    |
| 和了 / 流局弹窗 | `animate-riichi-overlay-in` + `animate-riichi-modal-in` |

接入页面：`src/pages/mahjong/japanese/` 下主组件。扩展（如打牌飞出、副露摊开）可在 `App.css` 增加 keyframes 后绑定对应 DOM。
