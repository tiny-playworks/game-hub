import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { claimDailyTask } from '@/lib/dailyTasks';
import { claimWeeklyTask } from '@/lib/weeklyTasks';
export function TaskClaimButton({
  task,
  scope,
  onClaim,
}: {
  task: { id: string; completed: boolean; claimed: boolean };
  scope: 'daily' | 'weekly';
  onClaim: () => void;
}) {
  const { t } = useLocale();
  const [error, setError] = useState(false);
  if (!task.completed) return null;
  if (task.claimed)
    return (
      <span className="text-xs text-primary">{t('home.daily.claimed')}</span>
    );
  return (
    <div className="mt-2">
      <Button
        size="sm"
        data-task-claim={task.id}
        onClick={() => {
          try {
            (scope === 'daily' ? claimDailyTask : claimWeeklyTask)(task.id);
            setError(false);
            onClaim();
          } catch {
            setError(true);
          }
        }}
      >
        {t('arcade.claim')}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {t('save.failed')}
        </p>
      )}
    </div>
  );
}
