import { CloudOff, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';

export function LocalResumeNotice({
  failed,
  onRetry,
}: {
  failed: boolean;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  return (
    <div
      role={failed ? 'alert' : undefined}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2 text-xs ${failed ? 'border border-destructive/30 bg-destructive/5 text-destructive' : 'text-muted-foreground'}`}
    >
      {failed ? (
        <CloudOff className="size-4 shrink-0" />
      ) : (
        <HardDrive className="size-3.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1 leading-5">
        {t(failed ? 'resume.failed' : 'resume.saved')}
      </span>
      {failed ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('storage.retry')}
        </Button>
      ) : null}
    </div>
  );
}
