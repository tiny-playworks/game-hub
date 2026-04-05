# 玩家 Meta 待办清单（单人维护）

**维护者**：单人开发，无独立团队。  
**用途**：唯一「还没做 / 以后做」的汇总；**暂缓**与**近期**都只是排期差异，**一律记为待办**，不单独建「永久不做」清单（范围边界仍以 [PLAN.md](PLAN.md) 为准）。

**已完成并归档**：P0～P2 见 [archive/player-meta-p0-p2-solo-done.md](archive/player-meta-p0-p2-solo-done.md)。

**历史实施说明书**（已关闭执行，规格仍可查）：[player-meta-next-plan.md](player-meta-next-plan.md)。

---

## 一、近期可排期（建议优先看）

| ID | 项 | 说明 / 入口文档 |
| --- | --- | --- |
| B-A1 | **音频系统 1.0** | [sound-assets.md](sound-assets.md)、[player-meta-roadmap.md](player-meta-roadmap.md) Phase 3；音量分组、BGM、UI 音、日麻系统语音包等 |
| B-A2 | **游戏感 / 大厅 polish** | 收藏入口、解锁弹窗体验、首页/结算细调等非 P0 已写死的条目；对照 roadmap Phase 4 余量 |
| B-A3 | **成就与任务扩展** | 更多进度型成就、周任务维度、统计维度（[roadmap](player-meta-roadmap.md) §2.2） |
| B-A4 | **成长 / 档案一致性** | 需要时对照 [growth-profile-plan-alignment.md](growth-profile-plan-alignment.md) 做小步修正 |

---

## 二、暂缓排期（仍是待办）

以下**不排进当前迭代**，但保留在 backlog，避免误以为「从项目里删掉」。

| ID | 项 | 说明 |
| --- | --- | --- |
| B-B1 | **真登录** | PLAN 范围外当前迭代 |
| B-B2 | **云存档** | 同上 |
| B-B3 | **SSR / 在线多人** | PLAN 已标明非当前 Web 仓库主线目标 |
| B-B4 | **完整音频系统**之外的 **AI 资源大批量生产** | 与版权/方案确认绑定 |
| B-B5 | **完整雀士角色 1.0**（立绘+语音量产、角色中心等） | [roadmap](player-meta-roadmap.md) Phase 6；依赖资源与 Phase 5 预研深化 |

---

## 三、分阶段路线图中的未闭合项（简表）

与 [player-meta-roadmap.md](player-meta-roadmap.md) 第 4 节对照，P0–P2 **未覆盖**或**仅部分覆盖**的后续工作包括但不限于：

| Phase | 主题 | 待办要点 |
| --- | --- | --- |
| **3** | 音频 1.0 | 见 sound-assets + roadmap Phase 3 P0–P2 音效层级 |
| **4** | 游戏感（余量） | 收藏入口、全局解锁反馈强度等未在 P0–P2 全部写死项 |
| **5** | 角色预研（余量） | 角色选择主流程、占位立绘资源、语音包切换 UX（P2 已立结构） |
| **6** | 雀士 1.0 | 4 角色内容与语音清单、资料页等 |

完成其中任一项时：优先改代码与 `sound-assets` / roadmap 相关小节，并在本文件或 PLAN 快照里**更新一行状态**即可（无需维持多份执行说明书）。

---

## 四、单人工作方式提示

- 不再使用「派单给多个 AI」流程；需要协作时直接把 [player-meta-next-plan.md](player-meta-next-plan.md) 中**对应章节** + 本 backlog 条目交给执行方即可。
- 新增大方向时：**先**在本文件或 [PLAN.md](PLAN.md) 加一句，**再**动代码，避免文档双源失控。

---

*创建：2026-04-05，与 P0–P2 归档同步。*
