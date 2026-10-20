import { Link } from 'react-router-dom';
import { useLocale } from '@/contexts/LocaleContext';
import type { FamilyGameId } from '../../../shared/contracts/gameRoom';

export function InviteFamilyButton({ gameId }: { gameId: FamilyGameId }) {
  const { t } = useLocale();
  return (
    <Link
      to={`/family?game=${gameId}&create=1`}
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
    >
      {t('gameRoom.invite')}
    </Link>
  );
}
