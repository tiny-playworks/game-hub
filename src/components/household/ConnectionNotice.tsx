import { AlertTriangle, Bot, Eye, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';

export interface ConnectionNoticeProps {
  connected: boolean;
  isAutoplay?: boolean;
  leaseLost?: boolean;
  isPaused?: boolean;
  pending?: boolean;
  onTakeover?: () => void;
  onCancelAutoplay?: () => void;
  onResumeGame?: () => void;
}

export function ConnectionNotice({
  connected,
  isAutoplay,
  leaseLost,
  isPaused,
  pending = false,
  onTakeover,
  onCancelAutoplay,
  onResumeGame,
}: ConnectionNoticeProps) {
  const { t } = useLocale();
  if (connected && !isAutoplay && !leaseLost && !isPaused) {
    return null;
  }

  return (
    <div className="w-full mb-3 space-y-2">
      {/* 1. 离线/重连横幅 */}
      {!connected && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200 backdrop-blur">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-amber-400 shrink-0" />
            <span>{t('family.notice.disconnected')}</span>
          </div>
        </div>
      )}

      {/* 2. 控制权被新设备接管横幅 */}
      {leaseLost && (
        <div className="p-3 rounded-xl bg-purple-500/15 border border-purple-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-purple-900 dark:text-purple-200 backdrop-blur">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-purple-400 shrink-0" />
            <span>{t('family.notice.leaseLost')}</span>
          </div>
          {onTakeover && (
            <Button
              size="sm"
              onClick={onTakeover}
              disabled={pending || !connected}
              className="min-h-11 px-3 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            >
              {t('family.notice.takeover')}
            </Button>
          )}
        </div>
      )}

      {/* 3. AI 托管中横幅 */}
      {isAutoplay && !leaseLost && (
        <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200 backdrop-blur">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-400 shrink-0" />
            <span>{t('family.notice.autoplay')}</span>
          </div>
          {onCancelAutoplay && (
            <Button
              size="sm"
              onClick={onCancelAutoplay}
              disabled={pending || !connected}
              className="min-h-11 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {t('family.notice.manual')}
            </Button>
          )}
        </div>
      )}

      {/* 4. 全真人离线暂停横幅 */}
      {isPaused && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200 backdrop-blur">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{t('family.notice.paused')}</span>
          </div>
          {onResumeGame && (
            <Button
              size="sm"
              onClick={onResumeGame}
              disabled={pending || !connected}
              className="min-h-11 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {t('family.notice.resume')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
