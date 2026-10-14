# 晚间交接文档：面向具备真实 NAS 环境与生图能力的 ChatGPT

> **当前工程基线**：分支 `codex/p15-replay-training`（Commit `662967d`，已推送到远端 GitHub）。  
> **运行环境**：Node 24（必须执行 `source ~/.nvm/nvm.sh && nvm use 24`，因内置 Node.js 原生 `node:sqlite`）。  
> **质量基线**：`pnpm typecheck`（0 error）、`pnpm lint`（344 文件 0 error 0 warning）、`pnpm test`（81 个测试套件，563 个用例全通）、`pnpm build`（Rsbuild 0.36s 正常打包）。

---

## 一、当前项目架构与进度全景

工程是一个以日式麻将（立直麻将）为核心、集成多款小游戏的家庭桌面游戏大厅（Game Hub）。
今天白天已完整完成 **P11 到 P15** 的全部建设：
- **P11**：家庭档案同步与幂等增量迁移（`server/src/routes/sync.ts`）。
- **P12**：家庭多人联机房间管理与崩溃恢复（`RoomManager` + SQLite WAL 恢复）。
- **P13**：断线重连、超时自动托管与段位结算（`socket.ts` + Lease 租约控制设备）。
- **P14**：AI 段位质量标杆，4 档确定性 AI（`beginner`/`standard`/`strong`/`expert`）。
- **P15**：长期牌谱归档（200 普通 / 100 收藏 FIFO）、0/1/2/3 全座位本人视角复盘参数化、实战分歧转换为错题强化训练（`RiichiTraining`）与最近 20 场薄弱点分析（`TrainingSummary`）。

---

## 二、今晚给你的重点工作安排（3 大任务）

由于你当前运行在**真实的 NAS 宿主环境**，且具备**更强推理与高质量生图能力**，请承接以下三项重点工作：

### 任务 1：真实 NAS 现场环境验收与排查（现场硬指标验证）

> 此前 P10 ~ P15 由于本地无 NAS 环境，所有任务卡均明确标注了“真实 NAS 待验证”项。你今晚需直接在实际 NAS 硬件与网络环境下进行实体验收，补齐任务卡证据。

1. **真实网络与多设备租约接管验证**：
   - 使用两台真实设备（例如一台 PC 桌面浏览器、一台移动端手机）同时连接家庭房间。
   - 验证单设备控制权租约（Lease）：PC 入座操作中，手机登录同一成员点击“接管控制”，确认 PC 端立即失去控制权（变为只读观战并收到 `CONTROL_LEASE_LOST` 提示），手机能无缝续行出牌。
2. **NAS 进程强杀断电与数据一致性验证**：
   - 在真人对局进行中（例如东 2 局行牌过半），直接向服务端发送 `SIGKILL` 强制终止 Node 进程。
   - 重新拉起服务端，验证 `active_rooms` 与 `room_commands` 能够自动从 SQLite WAL 中完整回放，牌桌进入 `isPaused = true` 暂停保护状态；真人重连后可正常继续推进。
3. **NAS 网络高延迟与长牌谱加载压力**：
   - 验证手机端通过内网/反代访问 `GET /api/v1/replays` 列表与大事件量牌谱（半庄终局）详情的耗时与内存开销。
   - 验证移动端手机视口（390×844）下复盘弹窗、逐步回放和错题训练的操作手感与遮挡情况。
4. **回写验收证据**：
   - 验证完毕后，更新 [`docs/roadmap/P10-household-service.md`](./P10-household-service.md) 至 [`P15-replay-training.md`](./P15-replay-training.md) 末尾的“真实 NAS 验证”小节，记录实际数据（吞吐、延迟、设备类型）。

---

### 任务 2：实施终章 P16（主题挑战、角色故事与收藏目标）

> 严格遵照 [`docs/roadmap/P16-challenges-stories.md`](./P16-challenges-stories.md) 和 [`docs/roadmap/README.md`](./README.md) 第 4 节执行。

#### 1. 分支与工作流
- 从 `codex/p15-replay-training` 切出新分支：
  ```bash
  git checkout -b codex/p16-challenges-stories
  ```
- 保持增量小步提交，完成前不得破坏现有 81 个测试套件。

#### 2. 契约与数据库（`shared/contracts/challenge.ts` & `server/src/db.ts`）
- 挑战集合 ID 固定为 `venue-v1`，schema 为 1。
- 初版 3 条固定主题挑战：
  1. `menzen-win`：门清和牌一次（无吃碰明杠）。
  2. `hanchan-nodealin`：完成一场完整半庄且放铳次数为 0。
  3. `riichi-three-matches`：完成三场日麻对局。
- 计数口径：**仅计入新开始的自由对局与 AI 段位匹配，训练模式与 1 真人家庭桌不计**。
- 奖励发放：每条挑战完成发放 **40 雀币 + 30 成长点**，服务端唯一约束凭据防重复刷奖（不可重领）。

#### 3. 角色短故事集（8 位角色各 1 篇双语故事）
- 在 [`src/lib/characterStories.ts`](../../src/lib/characterStories.ts) 中为全部 8 位角色（小春、澪、凛、千岁、空、绫、真昼、夜）各追加一篇全新短故事。
- 中英文双语齐全，阅读权限与原角色解锁条件严格保持一致（已解锁角色可读，未解锁角色展示锁定原因）。
- 三条主题挑战全部完成时，触发故事集解锁标识。

#### 4. 收藏目标看板（`src/components/profile/CollectionGoalsCard.tsx`）
- 梳理未拥有的称号、装扮与外观道具，列出清晰的真实获取途径（如“角色好感度达 3 级”、“达到雀杰段位”、“雀庄商店 120 雀币购买”等）。
- 所有跳转按钮必须指向真实有效页面（如 `/shop`、`/characters`、`/category/mahjong`），严禁不可点击的假按钮。

#### 5. 大厅挑战浮窗与结算通知（`src/components/home/ThemeChallengePanel.tsx`）
- 在游戏大厅/首页或雀庄大厅展示当前主题挑战进度条。
- 挑战达成时触发完成动效并安全同步至服务端。

---

### 任务 3：发挥你的生图模型能力，增强视觉呈现（选做但极具价值）

当前工程已有 8 位角色的基础头像与 3 档表情，但故事卡片和主题挑战缺少高质量插图。你可以利用你的生图能力提供以下美术补充：

1. **8 位角色的故事专属 CG / 插画（Aspect Ratio 16:9 或 4:3）**：
   - 存放路径：`src/assets/stories/`（建议转为 WebP 格式，单张压缩在 100~200KB）。
   - **风格指引**：精致日系二次元插画（Anime illustration, warm lighting, cozy mahjong parlor atmosphere），严格对应角色设定色系：
     - **小春（Koharu）**：阳光、活力、暖橙色/琥珀金、橘色发夹与麻将桌边的茶点。
     - **澪（Mio）**：冷静、理性、深海蓝/白银银发、整齐切齐的牌河与书卷。
     - **凛（Rin）**：好胜、热烈、赤红/黑色渐变、凌厉的立直棒与火花。
     - **千岁（Chitose）**：温和、治愈、抹茶淡绿、茶室与和风茶具。
     - **空（Sora）**：音乐、随性、深紫罗兰、耳机与跳动的音符牌背。
     - **绫（Aya）**：勇敢、干练、赤电绯红、闪耀的电光光环。
     - **真昼（Mahiru）**：艺术、专注、青碧配金墨水、画笔与手稿。
     - **夜（Yoru）**：神秘、恬静、幽紫夜空与皎洁月影。
2. **主题挑战专属 Banner 背景图**：
   - 存放路径：`src/assets/challenges/theme-banner.webp`。
   - 尺寸推荐：1200×400，日式雀庄木质桌面与麻将牌阵，提供沉浸感。

---

## 三、常用命令速查

```bash
# 1. 切换至 Node 24（重要）
source ~/.nvm/nvm.sh && nvm use 24

# 2. 类型检查（必须全部 0 错误）
pnpm typecheck

# 3. 代码规范检查（必须 0 error，0 warning）
pnpm lint

# 4. 运行全量测试套件（当前 81 个套件全部通过）
pnpm test

# 5. 生产打包验证
pnpm build

# 6. 本地/NAS 启动服务
pnpm start:server
pnpm dev
```

请按上述指引，接棒推进真实 NAS 验证与 P16 终章落地！祝顺利！
