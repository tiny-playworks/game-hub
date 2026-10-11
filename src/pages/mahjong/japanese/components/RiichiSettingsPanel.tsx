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

export function RiichiSettingsPanel({ ranked = false }: { ranked?: boolean }) {
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
        {switches.filter((key) => !ranked || key !== 'dangerHint').map((key) => (
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
      {!ranked && <label className="riichi-settings-level">
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
          <option value="strong">{t('riichi.settings.strong')}</option>
          <option value="expert">{t('riichi.settings.expert')}</option>
        </select>
      </label>}
      {ranked && <p className="text-sm">{t('ranked.fixedRules')}</p>}
      <label className="riichi-settings-level">
        <span>{t('riichi.settings.presentation')}</span>
        <select
          value={riichiSettings.presentation}
          onChange={(event) =>
            set(
              'presentation',
              event.target.value as RiichiPlayerSettings['presentation'],
            )
          }
        >
          <option value="full">{t('riichi.settings.presentation.full')}</option>
          <option value="simple">
            {t('riichi.settings.presentation.simple')}
          </option>
          <option value="off">{t('riichi.settings.presentation.off')}</option>
        </select>
      </label>
    </fieldset>
  );
}
