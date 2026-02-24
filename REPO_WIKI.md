# 项目仓库 Wiki 文档

## 📋 项目概述

**Game Hub（游戏合集）** 是一个基于现代前端技术栈的小游戏与麻将合集项目，包含多种经典游戏的实现。

### 🎯 核心功能
- 多种棋牌游戏（麻将、象棋等）
- 经典小游戏（2048、贪吃蛇、俄罗斯方块等）
- 响应式设计，支持多设备
- 完整的用户交互体验

## 🔧 技术架构

### 核心技术栈
- **构建工具**: Rsbuild v2
- **前端框架**: React 19 + TypeScript (strict mode)
- **样式方案**: Tailwind CSS v4 + PostCSS
- **UI组件库**: shadcn/ui
- **代码质量**: Biome (lint + format)
- **测试框架**: Rstest + Testing Library

### 项目结构
```
src/
├── components/ui/      # UI组件库
├── data/              # 游戏数据配置
├── hooks/             # 自定义Hooks
├── lib/               # 核心业务逻辑
├── pages/             # 页面组件
└── App.tsx           # 应用入口
```

## 🎮 游戏模块

### 麻将游戏系统

#### 中文麻将 (GameMahjongChinese)
- 实现标准国标麻将规则
- 支持吃、碰、杠、胡等基本操作
- 完整的计分系统

#### 日式立直麻将 (GameMahjongJapanese)
- 实现日本立直麻将规则
- 支持立直宣告机制
- 完整的役种判定系统
- 宝牌和里宝牌机制

### 核心算法库

#### mahjong.ts - 中文麻将核心逻辑
- 胡牌判定算法
- 牌型组合验证
- 计分规则实现

#### mahjongRiichi.ts - 日式麻将核心逻辑
- 立直规则实现
- 役种判定系统
- 宝牌计算逻辑

## 🚀 最近改进记录

### 2024年最新改进 (February 2024)

#### 1. 核心算法优化
- ✅ **优先级处理修复**: 修正了杠>碰>吃的操作优先级顺序
- ✅ **胡牌判定增强**: 改进了基础牌型验证算法，增加了过轮检测
- ✅ **杠牌机制完善**: 实现了完整的补牌逻辑和计分规则

#### 2. 日式麻将功能增强
- ✅ **役种系统扩展**: 添加了多个重要役种
  - 三色同顺 (三色同顺)
  - 三色同刻 (三色同刻) 
  - 三杠子 (三杠子)
  - 四暗刻 (四暗刻)
  - 四连刻 (四连刻)
  - 一气通贯 (一气通贯)
- ✅ **立直机制实现**: 完整的立直宣告和相关逻辑
- ✅ **AI决策优化**: 增强了AI的策略性和智能程度

#### 3. 用户体验改进
- ✅ **界面现代化**: 全新的视觉设计和交互体验
- ✅ **新手引导系统**: 添加了详细的游戏教程和指引
- ✅ **状态提示优化**: 更直观的操作反馈和状态显示
- ✅ **响应式设计**: 适配不同屏幕尺寸的显示效果

#### 4. 代码质量提升
- ✅ **代码清理**: 删除了废弃的 `canFormFourMelds` 和 `isSequence` 函数
- ✅ **性能优化**: 替换了效率更高的算法实现
- ✅ **类型安全**: 完善了TypeScript类型定义
- ✅ **可维护性**: 改善了代码结构和注释

### 技术细节更新

#### 算法改进
```typescript
// 旧的递归算法（已删除）
function canFormFourMelds(arr: number[]): boolean {
  // 效率较低的暴力递归实现
}

// 新的优化算法
function canFormFourMeldsOptimized(arr: number[]): boolean {
  // 基于回溯的高效实现
  return backtrack(0, 0);
}
```

#### 功能增强
- 添加了振听状态检测
- 实现了更精确的手牌安全性评估
- 完善了听牌状态分析
- 增强了AI的风险管理能力

## 📊 开发工作流

### 常用命令
```bash
# 开发环境
pnpm run dev          # 启动开发服务器
pnpm run build        # 生产构建
pnpm run preview      # 本地预览生产版本

# 代码质量
pnpm run lint         # 代码检查
pnpm run format       # 代码格式化
pnpm run check        # 综合检查

# 测试
pnpm run test         # 运行测试
pnpm run test:watch   # 监听模式测试
```

### 开发规范
- 遵循Biome代码规范
- 使用TypeScript严格模式
- 组件采用函数式编程
- 路径别名使用 `@/` 前缀

## 🔧 配置说明

### 构建配置
- **Rsbuild配置**: `rsbuild.config.ts`
- **TypeScript配置**: `tsconfig.json`
- **样式配置**: `postcss.config.mjs`
- **代码检查**: `biome.json`

### 路径别名
```
@/ -> src/
@example: import { Button } from '@/components/ui/button'
```

## 🎯 未来规划

### 功能扩展
- [ ] 添加更多麻将变种规则
- [ ] 实现在线多人对战功能
- [ ] 增加游戏统计数据和成就系统
- [ ] 添加语音和动画效果

### 技术优化
- [ ] 性能监控和优化
- [ ] 服务端渲染支持
- [ ] PWA功能集成
- [ ] 国际化支持

## 📚 参考资源

- [Rsbuild官方文档](https://rsbuild.rs)
- [React 19文档](https://react.dev)
- [TypeScript手册](https://www.typescriptlang.org)
- [Tailwind CSS文档](https://tailwindcss.com)
- [shadcn/ui组件库](https://ui.shadcn.com)

---
*最后更新: 2024年2月*
*版本: v1.0.0*