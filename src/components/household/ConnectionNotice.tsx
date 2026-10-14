import { AlertTriangle, Bot, Eye, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ConnectionNoticeProps {
  connected: boolean;
  isAutoplay?: boolean;
  leaseLost?: boolean;
  isPaused?: boolean;
  onTakeover?: () => void;
  onCancelAutoplay?: () => void;
  onResumeGame?: () => void;
}

export function ConnectionNotice({
  connected,
  isAutoplay,
  leaseLost,
  isPaused,
  onTakeover,
  onCancelAutoplay,
  onResumeGame,
}: ConnectionNoticeProps) {
  if (connected && !isAutoplay && !leaseLost && !isPaused) {
    return null;
  }

  return (
    <div className="w-full mb-3 space-y-2">
      {/* 1. 离线/重连横幅 */}
      {!connected && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200 backdrop-blur">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-amber-400 shrink-0" />
            <span>网络连线中断，60 秒内为您保持席位，正在自动尝试重连…</span>
          </div>
        </div>
      )}

      {/* 2. 控制权被新设备接管横幅 */}
      {leaseLost && (
        <div className="p-3 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-between text-xs text-purple-200 backdrop-blur">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-purple-400 shrink-0" />
            <span>当前席位已在另一台设备接管控制，本设备已自动转为只读观战模式。</span>
          </div>
          {onTakeover && (
            <Button
              size="sm"
              onClick={onTakeover}
              className="h-6 px-2.5 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            >
              夺回控制权
            </Button>
          )}
        </div>
      )}

      {/* 3. AI 托管中横幅 */}
      {isAutoplay && !leaseLost && (
        <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-between text-xs text-blue-200 backdrop-blur">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-400 shrink-0" />
            <span>因超时未操作，当前席位正由 AI 临时替您行牌，牌局正常推进中。</span>
          </div>
          {onCancelAutoplay && (
            <Button
              size="sm"
              onClick={onCancelAutoplay}
              className="h-6 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              恢复手动操作
            </Button>
          )}
        </div>
      )}

      {/* 4. 全真人离线暂停横幅 */}
      {isPaused && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-between text-xs text-rose-200 backdrop-blur">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>所有真人玩家均已离线，牌局已自动暂停并保存至 SQLite，等待成员上线恢复。</span>
          </div>
          {onResumeGame && (
            <Button
              size="sm"
              onClick={onResumeGame}
              className="h-6 px-2.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              继续牌局
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
