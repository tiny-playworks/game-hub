import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
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
  const household = useOptionalHousehold();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
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
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            if (household?.currentMember) {
              await household.performProgressAction({
                type: scope === 'daily' ? 'claim-daily-task' : 'claim-weekly-task',
                taskId: task.id,
              });
            } else {
              (scope === 'daily' ? claimDailyTask : claimWeeklyTask)(task.id);
            }
            setError(false);
            onClaim();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
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
