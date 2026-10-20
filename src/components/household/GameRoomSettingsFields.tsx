import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import type {
  FamilyGameId,
  GameRoomSettings,
} from '../../../shared/contracts/gameRoom';

export const defaultGameRoomSettings: GameRoomSettings = {
  difficulty: 'normal',
  firstPlayer: 'random',
  clock: null,
  undoLimit: 3,
  turnSeconds: 15,
};

export function GameRoomSettingsFields({
  gameId,
  value,
  onChange,
  disabled = false,
}: {
  gameId: FamilyGameId;
  value: GameRoomSettings;
  onChange: (value: GameRoomSettings) => void;
  disabled?: boolean;
}) {
  const { t, locale } = useLocale();
  const selectClass =
    'mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm';
  return (
    <fieldset
      disabled={disabled}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 disabled:opacity-60"
    >
      <label className="text-sm">
        {t('common.difficulty')}
        <select
          className={selectClass}
          value={value.difficulty}
          onChange={(event) =>
            onChange({
              ...value,
              difficulty: event.target.value as GameRoomSettings['difficulty'],
            })
          }
        >
          {(['easy', 'normal', 'hard'] as const).map((level) => (
            <option key={level} value={level}>
              {t(`common.difficulty.${level}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        {t('gameRoom.first')}
        <select
          className={selectClass}
          value={value.firstPlayer}
          onChange={(event) =>
            onChange({
              ...value,
              firstPlayer: event.target
                .value as GameRoomSettings['firstPlayer'],
            })
          }
        >
          {(['random', 'host', 'opponent'] as const).map((first) => (
            <option key={first} value={first}>
              {t(`gameRoom.${first}`)}
            </option>
          ))}
        </select>
      </label>
      {gameId === 'doudizhu' ? (
        <label className="text-sm">
          {t('gameRoom.turnSeconds')}
          <select
            className={selectClass}
            value={value.turnSeconds}
            onChange={(event) =>
              onChange({
                ...value,
                turnSeconds: Number(
                  event.target.value,
                ) as GameRoomSettings['turnSeconds'],
              })
            }
          >
            {[10, 15, 30].map((seconds) => (
              <option key={seconds} value={seconds}>
                {formatMessage(locale, 'gameRoom.seconds', { seconds })}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <label className="text-sm">
            {t('gameRoom.clock')}
            <select
              className={selectClass}
              value={value.clock?.totalSeconds ?? 0}
              onChange={(event) => {
                const totalSeconds = Number(event.target.value);
                onChange({
                  ...value,
                  clock: totalSeconds
                    ? {
                        totalSeconds,
                        incrementSeconds: totalSeconds === 180 ? 2 : 5,
                      }
                    : null,
                });
              }}
            >
              <option value={0}>{t('gameRoom.unlimited')}</option>
              {[180, 600, 1200].map((total) => (
                <option key={total} value={total}>
                  {formatMessage(locale, 'gameRoom.clockPreset', {
                    minutes: total / 60,
                    seconds: total === 180 ? 2 : 5,
                  })}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t('gameRoom.undoLimit')}
            <select
              className={selectClass}
              value={value.undoLimit}
              onChange={(event) =>
                onChange({
                  ...value,
                  undoLimit: Number(
                    event.target.value,
                  ) as GameRoomSettings['undoLimit'],
                })
              }
            >
              {[0, 1, 3].map((count) => (
                <option key={count} value={count}>
                  {count
                    ? formatMessage(locale, 'gameRoom.undoCount', { count })
                    : t('gameRoom.disabled')}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </fieldset>
  );
}
