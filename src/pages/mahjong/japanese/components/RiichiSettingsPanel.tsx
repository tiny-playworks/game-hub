import { useLocale } from '@/contexts/LocaleContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import {
  type RiichiPlayerSettings,
  updatePlayerProfile,
} from '@/lib/playerProfile';

const switches = [
  'autoWin',
  'noCall',
  'autoTsumogiri',
  'callConfirm',
  'dangerHint',
] as const;

export function RiichiSettingsPanel() {
  const { t } = useLocale();
  const { riichiSettings } = usePlayerProfile();
  const set = <K extends keyof RiichiPlayerSettings>(
    key: K,
    value: RiichiPlayerSettings[K],
  ) => updatePlayerProfile({ riichiSettings: { [key]: value } });

  return (
    <fieldset className="riichi-settings-panel">
      <legend>{t('riichi.settings.title')}</legend>
      <div className="riichi-settings-grid">
        {switches.map((key) => (
          <label key={key}>
            <span>{t(`riichi.settings.${key}`)}</span>
            <input
              type="checkbox"
              checked={riichiSettings[key]}
              onChange={(event) => set(key, event.target.checked)}
            />
          </label>
        ))}
      </div>
      <label className="riichi-settings-level">
        <span>{t('riichi.settings.aiLevel')}</span>
        <select
          value={riichiSettings.aiLevel}
          onChange={(event) =>
            set(
              'aiLevel',
              event.target.value as RiichiPlayerSettings['aiLevel'],
            )
          }
        >
          <option value="beginner">{t('riichi.settings.beginner')}</option>
          <option value="standard">{t('riichi.settings.standard')}</option>
        </select>
      </label>
    </fieldset>
  );
}
