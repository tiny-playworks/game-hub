type Props = {
  onClose: () => void;
};

export function GuidePanel({ onClose }: Props) {
  return (
    <div className="mb-4 p-4 bg-[#1d3557]/80 rounded-xl border border-[#457b9d]/50">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-bold text-[#a8dadc]">新人玩家指南</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[#f1faee]/70 hover:text-[#f1faee] text-sm"
        >
          ✕ 关闭
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="bg-[#2d4a3c]/50 p-3 rounded-lg">
          <h4 className="font-semibold text-[#f1faee] mb-2">🎯 基本目标</h4>
          <ul className="text-[#f1faee]/80 space-y-1 text-xs">
            <li>• 组成 4 面子 + 1 对子</li>
            <li>• 必须有至少 1 个役种</li>
            <li>• 立直后听牌固定</li>
          </ul>
        </div>
        <div className="bg-[#2d4a3c]/50 p-3 rounded-lg">
          <h4 className="font-semibold text-[#f1faee] mb-2">🎮 操作说明</h4>
          <ul className="text-[#f1faee]/80 space-y-1 text-xs">
            <li>• 点击手牌出牌</li>
            <li>• 可吃/碰/杠时会提示</li>
            <li>• 听牌时可宣告立直</li>
          </ul>
        </div>
        <div className="bg-[#2d4a3c]/50 p-3 rounded-lg">
          <h4 className="font-semibold text-[#f1faee] mb-2">💡 小贴士</h4>
          <ul className="text-[#f1faee]/80 space-y-1 text-xs">
            <li>• 绿色=条子 红色=万子</li>
            <li>• 黄色=筒子 黑色=字牌</li>
            <li>• 红色数字=赤宝牌</li>
          </ul>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[#457b9d]/30">
        <p className="text-xs text-[#a8dadc]/90">
          💡 提示：游戏上方会显示当前状态和可选操作，仔细阅读后再做决定哦！
        </p>
      </div>
    </div>
  );
}
