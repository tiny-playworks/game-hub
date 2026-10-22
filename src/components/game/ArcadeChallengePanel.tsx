import { Target, Trophy } from 'lucide-react';
import { useArcade } from '@/contexts/ArcadeContext';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { gameStorage } from '@/lib/storage';
import {
  ARCADE_CHALLENGE_STORAGE_KEY,
  arcadeChallengeGoal,
  normalizeArcadeChallenges,
} from '../../../shared/contracts/arcadeChallenge';

export function ArcadeChallengePanel() {
  const arcade = useArcade();
  const household = useOptionalHousehold();
  const { t, locale } = useLocale();
  let local: unknown = null;
  if (!household?.currentMember) {
    try {
      local = JSON.parse(
        gameStorage.getItem(ARCADE_CHALLENGE_STORAGE_KEY) ?? 'null',
      );
    } catch {
      /* Empty practice history. */
    }
  }
  const ledger = normalizeArcadeChallenges(
    household?.currentMember ? household.snapshot?.arcadeChallenges : local,
  );
  const record = ledger.records[`${arcade.gameId}:${arcade.difficulty}`];
  return (
    <div className="arcade-mode-panel">
      <div
        className="arcade-mode-tabs"
        role="group"
        aria-label={t('play.personalProgress')}
      >
        {(['classic', 'challenge'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={arcade.mode === mode}
            onClick={() => arcade.changeMode(mode)}
          >
            <span>{mode === 'classic' ? '01' : '02'}</span>
            {t(mode === 'classic' ? 'play.classic' : 'play.trial')}
          </button>
        ))}
      </div>
      {arcade.mode === 'challenge' ? (
        <div className="arcade-challenge-objective">
          <span className="arcade-challenge-seal" aria-hidden="true">
            <Target className="size-5" />
          </span>
          <div>
            <strong>
              {formatMessage(
                locale,
                `play.trial.goal.${arcade.gameId}${arcade.gameId === 'tictactoe' && arcade.difficulty === 'hard' ? '.hard' : ''}`,
                arcadeChallengeGoal(arcade.gameId, arcade.difficulty),
              )}
            </strong>
            <p>
              {t('play.practiceOnly')}
              {record
                ? ` · ${formatMessage(locale, 'play.trialAttempts', { attempts: record.attempts, clears: record.clears })}`
                : ''}
            </p>
          </div>
          {record?.clears ? (
            <Trophy className="ml-auto size-5 shrink-0 text-gold" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
