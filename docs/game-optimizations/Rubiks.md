# 3D 魔方优化评估

## 源码入口

- 页面：`src/pages/rubiks/index.tsx`
- 引擎：`src/pages/rubiks/RubiksCubeEngine.ts`
- 手势：`src/pages/rubiks/gestureMath.ts`
- 立方体模型：`src/pages/rubiks/cubeModel.ts`
- 样式：`src/pages/rubiks/rubiks.css`

## 当前状态

当前版本是 Three.js 3D 魔方，支持真实三阶小块、贴纸材质、左键拖动转层、右键旋转视角、滚轮缩放、打乱和重置。已有手势、贴纸、页面相关测试。

## 已落地优化

- 魔方引擎和 React 页面分离，页面只持有 engine controller。
- 有 `ResizeObserver`，相机 zoom 会按容器比例调整。
- 使用 pointer capture 处理拖拽，转层结束会吸附到 90 度。
- 打乱期间会设置 busy，避免重复操作。
- dispose 会清理 renderer、controls、geometry、material 和事件。

## 待优化问题

- 没有独立魔方状态模型，历史、撤销、步数、复原判断都不好做。
- 打乱是动画序列，但没有记录标准魔方记号。
- 移动端说明仍偏桌面：右键和滚轮在手机上不可用。
- 没有 WebGL 不可用时的降级提示。
- 没有计时、步数、撤销、重做、自动复原或教学模式。

## 建议重构

- 抽象 cube state：用 cubie permutation/orientation 或面贴纸模型记录真实状态。
- 每次转层生成 move 事件，记录 `R`、`U'`、`F2` 这类 notation。
- 页面 HUD 加步数、计时、撤销、重做、是否已复原。
- 移动端增加双指缩放/拖动说明，或提供视角重置按钮。
- 增加 WebGL fallback：提示设备不支持 3D 渲染，而不是空白舞台。

## 优先级

- P0：补 WebGL fallback；移动端帮助文案改成可执行的触屏说明。
- P1：增加 move history、步数、撤销和复原检测。
- P2：加入标准打乱公式、计时挑战、教学高亮和自动复原演示。

## 验证建议

- 单测覆盖手势轴选择、转层吸附、reset 后状态。
- 浏览器验证桌面左键转层、右键视角、移动端单指转层和响应式舞台。
