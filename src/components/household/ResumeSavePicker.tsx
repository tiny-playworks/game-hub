import React from 'react';
import type { ResumeSaveSummary } from '../../../shared/contracts/sync';
import { useLocale } from '@/contexts/LocaleContext';

interface ResumeSavePickerProps {
  isOpen: boolean;
  currentDeviceId: string;
  saves: ResumeSaveSummary[];
  onSelect: (saveId: string) => void;
  onDelete?: (saveId: string) => void;
  onCancel: () => void;
}

export const ResumeSavePicker: React.FC<ResumeSavePickerProps> = ({
  isOpen,
  currentDeviceId,
  saves,
  onSelect,
  onDelete,
  onCancel,
}) => {
  const { locale } = useLocale();
  const isZh = locale === 'zh';

  if (!isOpen || saves.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 border-b border-neutral-800">
          <h2 id="resume-picker-title" className="text-xl font-bold tracking-tight">
            {isZh ? '选择要继续的自由局对局' : 'Choose Match to Resume'}
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            {isZh
              ? '检测到不同设备保存的未完成对局。选择其中一场继续，其余对局仍将独立保留。'
              : 'Unfinished matches detected across devices. Select one to resume; others will be preserved.'}
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto p-4 space-y-3">
          {saves.map((save) => {
            const isThisDevice = save.deviceId === currentDeviceId;
            const lengthLabel = save.matchLength === 'south'
              ? isZh ? '半庄战' : 'South'
              : isZh ? '东风战' : 'East';
            const roundName = save.roundSummary?.roundName ?? (isZh ? '进行中' : 'In Progress');

            return (
              <div
                key={save.saveId}
                className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/60 border border-neutral-700/50 hover:border-neutral-600 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-neutral-200">
                      {lengthLabel} · {roundName}
                    </span>
                    <span
                      className={`text-2xs px-2 py-0.5 rounded-full font-mono ${
                        isThisDevice
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-neutral-700 text-neutral-300'
                      }`}
                    >
                      {isThisDevice ? (isZh ? '当前设备' : 'This Device') : (isZh ? '其他设备' : 'Other Device')}
                    </span>
                  </div>
                  <div className="text-2xs text-neutral-400">
                    {new Date(save.updatedAt).toLocaleString(isZh ? 'zh-CN' : 'en-US')}
                  </div>
                  {save.roundSummary?.scores && (
                    <div className="text-2xs text-neutral-400 font-mono">
                      {isZh ? '自家点数: ' : 'Score: '}
                      {save.roundSummary.scores[0]}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(save.saveId)}
                      className="px-2.5 py-1.5 text-xs text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      {isZh ? '放弃' : 'Abandon'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelect(save.saveId)}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-neutral-950 hover:bg-amber-400 active:scale-95 transition cursor-pointer"
                  >
                    {isZh ? '继续' : 'Resume'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 bg-neutral-950/60 border-t border-neutral-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-neutral-100 transition cursor-pointer"
          >
            {isZh ? '开新局（保留旧档）' : 'New Match (Keep Saves)'}
          </button>
        </div>
      </div>
    </div>
  );
};
