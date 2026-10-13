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
  'chatter',
] as const;

export function RiichiSettingsPanel({ ranked = false }: { ranked?: boolean }) {
  const { t } = useLocale();
  const { riichiSettings, audioVolumes } = usePlayerProfile();
  const set = <K extends keyof RiichiPlayerSettings>(
    key: K,
    value: RiichiPlayerSettings[K],
  ) => updatePlayerProfile({ riichiSettings: { [key]: value } });

  const isMuted = audioVolumes.sfx <= 0 && audioVolumes.voice <= 0;
  const toggleMute = (muted: boolean) => {
    updatePlayerProfile({
      audioVolumes: {
        ...audioVolumes,
        sfx: muted ? 0 : 1,
        voice: muted ? 0 : 1,
      },
    });
  };

  const setAudioVolume = (type: 'sfx' | 'voice', value: number) => {
    updatePlayerProfile({
      audioVolumes: {
        ...audioVolumes,
        [type]: value,
      },
    });
  };

  return (
    <fieldset className="riichi-settings-panel">
      <legend>{t('riichi.settings.title')}</legend>
      <div className="riichi-settings-grid">
        <label>
          <span>{t('riichi.settings.audioMute')}</span>
          <input
            type="checkbox"
            checked={isMuted}
            onChange={(event) => toggleMute(event.target.checked)}
          />
        </label>
        {switches
          .filter((key) => !ranked || key !== 'dangerHint')
          .map((key) => (
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
      {!isMuted && (
        <div className="riichi-settings-volumes mt-3 space-y-2">
          <label className="flex items-center justify-between text-xs">
            <span>{t('riichi.settings.sfxVolume')}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(audioVolumes.sfx * 100)}
              onChange={(e) => setAudioVolume('sfx', Number(e.target.value) / 100)}
              className="w-32 h-2 accent-[#c54838] cursor-pointer"
            />
            <span className="w-8 text-right font-mono">{Math.round(audioVolumes.sfx * 100)}%</span>
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>{t('riichi.settings.voiceVolume')}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(audioVolumes.voice * 100)}
              onChange={(e) => setAudioVolume('voice', Number(e.target.value) / 100)}
              className="w-32 h-2 accent-[#c54838] cursor-pointer"
            />
            <span className="w-8 text-right font-mono">{Math.round(audioVolumes.voice * 100)}%</span>
          </label>
        </div>
      )}
      {!ranked && (
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
            <option value="strong">{t('riichi.settings.strong')}</option>
            <option value="expert">{t('riichi.settings.expert')}</option>
          </select>
        </label>
      )}
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
