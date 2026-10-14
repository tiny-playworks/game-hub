# Game Hub Mac 端 GPT 交接任务

> 更新时间：2026-10-14
> 代码基线：`codex/p16-challenges-stories`，当前 HEAD `3d64e3f`
> 环境边界：接手方没有家庭 NAS 访问权限；请完成本机能做的视觉、代码与回归工作，不把 NAS 功能验收写成已通过。

## 当前状态

- P1–P16 的现有实现均在当前分支中。P16 主题挑战、八名角色的新篇故事、收藏目标已实现；不要从头重做。
- P16 已部署到 NAS，版本 `p16-nas-20261014c`。静态站、API 健康、深链和 WASM 等基础检查已通过。成员跨设备同步、挑战防重复领奖、断线/重启恢复等现场行为仍待真实设备验证。
- P16 的 `pnpm typecheck`、`pnpm build` 已通过；P16 功能测试和页面目视回归尚未完成。
- 目前没有故事插画或主题挑战横幅。用户已明确要求把生图能力纳入本轮工作；此项是对 P16 任务卡“不要扩展资产目录”的限定增补，只新增下文列出的故事/挑战图片。
- 现有用户指令允许代码完成后提交并推送。开始前核对分支、远端及 `git status`，只提交本轮相关改动，保留工作区里的其他变更。

## 交付目标

在 Mac 本机完成一轮可审阅的 Game Hub 整站与家庭功能 UI 巡检/修整、本机回归，以及 P16 视觉补齐：给八篇主题故事生成并接入插画，改善挑战卡片呈现；核对大厅、游戏入口、成员/房间、档案、角色、牌谱与训练等主要页面的路由、布局和交互。优先修复会阻断家庭用户流程或导致页面难以使用的问题，并把检查证据写回路线图。不要尝试连接、部署或修改 NAS。

## 工作安排

### 1. 先核对代码和既有约定

先读：

- [`README.md`](./README.md)，尤其第 1、4、5 节的产品和跨阶段约定。
- [`P16-challenges-stories.md`](./P16-challenges-stories.md) 的实现、验收和部署记录。
- `src/lib/characterStories.ts`、`src/pages/CharacterProfile.tsx`、`src/components/characters/CharacterStoryPlayer.tsx`。
- `src/components/home/ThemeChallengePanel.tsx`、`src/pages/Profile.tsx`。
- `src/lib/playerCharacters.ts`、`src/lib/i18n.ts` 和 `src/assets/characters/<character-id>/` 中的头像/表情。

以当前代码和角色素材为准确认八名角色的外观、色彩与性格；不要照搬其他交接材料里可能过期的角色色彩描述。先看 `git status`，不要重置或覆盖已有改动。

### 2. 用生图能力制作 P16 插画

使用现有角色头像作为参考图，保持同一角色的脸、发型、服饰和标志配件一致；八张图使用统一的日系插画质感和光线，但场景与人物动作各有变化。

- 为 `koharu`、`mio`、`rin`、`chitose`、`sora`、`aya`、`mahiru`、`yoru` 各生成一张主题故事插画。横向 4:3 或 3:2，适合故事弹窗与窄屏裁切。
- 生成一张日式雀庄主题横幅，建议 3:1 比例，用于大厅主题挑战卡片。
- 插画不带文字、标识、UI 或可读牌谱；不要改变角色身份，也不要额外加入主角以外的清晰人物。
- 最终资源放入 `src/assets/stories/<character-id>.webp` 与 `src/assets/challenges/theme-banner.webp`。每张角色图尽量控制在 200 KB 左右，横幅控制在 350 KB 左右；检查尺寸、裁切和压缩后的清晰度。
- 生图完成后逐张检查角色身份、手部和麻将物件。若一次生成不一致，继续修图或重生成，不要把明显错误的图直接接入。

建议提示词骨架：

```text
Use the supplied Game Hub character portrait as the identity reference. Preserve the
character's recognizable face, hairstyle, outfit, palette and signature accessories.
Create a polished Japanese anime story illustration for a warm family riichi-mahjong
game, with a quiet mahjong-parlor scene, cinematic but readable lighting, clear focal
point, and generous safe margins for responsive cropping. No text, lettering, logo,
interface, watermark, or legible tile notation. Landscape 4:3.
```

提示词里的场景、表情和配色要按每篇新故事及当前角色设定分别调整，不要八张只换背景色。

### 3. 把图片接入现有 P16 页面

- 故事插画用于 P16 新篇（`stage === 4`）的阅读体验；不要让它意外替换既有好感阶段故事的角色立绘。
- 横幅以不影响文字对比和操作的方式用于大厅主题挑战卡；窄屏下检查裁切、加载和阅读顺序。
- 复用现有组件、主题和本地化方式；中英文、浅色/深色主题都要能读清文字。全站巡检沿用路线图已确定的视觉方向，不要另起一套主题或更换技术栈。
- 资源由明确的静态导入或项目现有资源模式管理，不能运行时请求 NAS 文件路径。确认生产构建能打包所有图片。

### 4. 完成本机回归和页面检查

先针对 P16 行为补齐/运行现有测试，重点核对：

- 三条挑战的完成条件、重复事件/刷新后不重复发奖。
- 训练局、旧局和家庭真人桌不会推进 P16 挑战。
- 挑战状态持久化、故事集解锁、角色自身锁定条件及收藏目标入口。
- 在线/离线同步相关逻辑有本机服务端或隔离测试覆盖；没有 NAS 也可运行的部分应在本机验证。

先从路由表列出主要页面，再用本机浏览器检查大厅与游戏入口、家庭成员登录/管理和房间页面、档案收藏目标、角色与八篇主题故事、牌谱/训练等核心路径。记录并修复明显的断链、遮挡、溢出、不可操作控件、窄屏布局和中英文文案问题；同时确认已部署站点常用的直接访问路由在本机刷新时可用。至少检查桌面宽度和约 `390×844` 的手机视口，以及中文/英文；重点页面抽查浅色/深色主题。仅在本机开发服务和隔离测试数据上操作，不接触真实 NAS 成员档案。

建议完成并记录：

```bash
pnpm test -- <P16相关测试路径>
pnpm typecheck
pnpm lint
pnpm build
```

按仓库现状选用实际测试过滤参数；若 P16 测试没有独立路径，先查现有测试组织再运行。`pnpm check` 会自动修复全仓文件，谨慎使用，避免无关格式化。若修复代码，再跑受影响的测试和构建。

### 5. 更新证据并交付

- 将新增插画、接入页面、测试命令/结果和浏览器检查结果写入 [`P16-challenges-stories.md`](./P16-challenges-stories.md) 的“当前交付记录”。
- 只把本机实际通过的项目标为完成。NAS 真实成员、跨设备同步、真人房间、重启恢复和挑战奖励防重现场验证继续标为待验。
- 汇报图片路径与数量、页面改动、检查结果、未解决问题及 NAS 限制。
- 按用户此前授权提交并推送当前工作分支；提交前再次确认只包含本轮文件。文档或前端资源推送不会自动发布到 NAS，本轮不做 NAS 部署。

## 完成标准

- 八张角色图和一张挑战横幅质量、身份及裁切通过检查，生产构建正常。
- 插画只出现在 P16 新篇/挑战视图中；故事权限、挑战规则、奖励和存档契约没有被视觉改动破坏。
- P16 本机测试、类型检查、规范检查、构建与整站/家庭核心页面检查结果有明确记录。
- 文档准确区分本机验证和 NAS 现场待验，改动已按授权提交并推送。

## 可直接交给 Mac 端 GPT 的任务提示

```text
请在当前 Game Hub 仓库完成 docs/roadmap/HANDOFF-MAC-GPT.md 中的工作。
先检查 git 分支和工作区，保留已有改动；阅读路线图总纲与 P16 任务卡，不要重做已实现功能。
本轮要完成 Game Hub 整站及家庭功能的本机 UI 巡检/必要修整，并使用生图能力为八名角色
各制作一张 P16 主题故事插画，再制作大厅挑战横幅，按交接文档接入现有页面；运行 P16
本机回归，并检查桌面/手机的主要页面和家庭核心流程。
你没有 NAS 环境：不要尝试连接或部署 NAS，也不要将 NAS 现场验收标为通过。
完成后更新 P16 交付记录，汇报图片和验证证据，并按用户已授权的要求提交、推送本轮改动。
```
