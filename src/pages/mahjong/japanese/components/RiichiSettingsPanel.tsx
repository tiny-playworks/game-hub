import { useLocale } from '@/contexts/LocaleContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { stopRiichiAudioPlayback, stopRiichiVoicePlayback } from '@/hooks/useRiichiSounds';
import {
  type RiichiPlayerSettings,
  updatePlayerProfile,
} from '@/lib/playerProfile';
import { stopSoundEffects, unlockAudioContext } from '@/lib/speech';

const switches = [
  'autoWin',
  'noCall',
  'autoTsumogiri',
  'callConfirm',
  'singleClickDiscard',
  'highlightClaimTile',
  'showTableHints',
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

  const isMuted =
    audioVolumes.bgm <= 0 && audioVolumes.sfx <= 0 && audioVolumes.voice <= 0;
  const toggleMute = (muted: boolean) => {
    if (muted) stopRiichiAudioPlayback();
    else unlockAudioContext();
    updatePlayerProfile({
      audioVolumes: {
        ...audioVolumes,
        bgm: muted ? 0 : 1,
        sfx: muted ? 0 : 1,
        voice: muted ? 0 : 1,
      },
    });
  };

  const setAudioVolume = (type: 'bgm' | 'sfx' | 'voice', value: number) => {
    if (value <= 0) {
      if (type === 'sfx') stopSoundEffects();
      else if (type === 'voice') stopRiichiVoicePlayback();
    } else if (type === 'sfx' || type === 'bgm') {
      unlockAudioContext();
    }
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
            <span>{t('riichi.settings.bgmVolume')}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(audioVolumes.bgm * 100)}
              onChange={(e) =>
                setAudioVolume('bgm', Number(e.target.value) / 100)
              }
              className="w-32 h-2 accent-[#c54838] cursor-pointer"
            />
            <span className="w-8 text-right font-mono">
              {Math.round(audioVolumes.bgm * 100)}%
            </span>
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>{t('riichi.settings.sfxVolume')}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(audioVolumes.sfx * 100)}
              onChange={(e) =>
                setAudioVolume('sfx', Number(e.target.value) / 100)
              }
              className="w-32 h-2 accent-[#c54838] cursor-pointer"
            />
            <span className="w-8 text-right font-mono">
              {Math.round(audioVolumes.sfx * 100)}%
            </span>
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>{t('riichi.settings.voiceVolume')}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(audioVolumes.voice * 100)}
              onChange={(e) =>
                setAudioVolume('voice', Number(e.target.value) / 100)
              }
              className="w-32 h-2 accent-[#c54838] cursor-pointer"
            />
            <span className="w-8 text-right font-mono">
              {Math.round(audioVolumes.voice * 100)}%
            </span>
          </label>
        </div>
      )}
      <label className="riichi-settings-level">
        <span>{t('riichi.settings.turnTimeLimit')}</span>
        <select
          value={riichiSettings.turnTimeLimit}
          onChange={(event) =>
            set(
              'turnTimeLimit',
              event.target.value as RiichiPlayerSettings['turnTimeLimit'],
            )
          }
        >
          <option value="standard">
            {t('riichi.settings.turnTimeLimit.standard')}
          </option>
          <option value="relaxed">
            {t('riichi.settings.turnTimeLimit.relaxed')}
          </option>
          <option value="long">
            {t('riichi.settings.turnTimeLimit.long')}
          </option>
          {!ranked && (
            <option value="unlimited">
              {t('riichi.settings.turnTimeLimit.unlimited')}
            </option>
          )}
        </select>
      </label>
      <label className="riichi-settings-level">
        <span>{t('riichi.settings.aiSpeed')}</span>
        <select
          value={riichiSettings.aiSpeed}
          onChange={(event) =>
            set(
              'aiSpeed',
              event.target.value as RiichiPlayerSettings['aiSpeed'],
            )
          }
        >
          <option value="slow">{t('riichi.settings.aiSpeed.slow')}</option>
          <option value="normal">{t('riichi.settings.aiSpeed.normal')}</option>
          <option value="fast">{t('riichi.settings.aiSpeed.fast')}</option>
        </select>
      </label>
      <label className="riichi-settings-level">
        <span>{t('riichi.settings.buttonSize')}</span>
        <select
          value={riichiSettings.buttonSize}
          onChange={(event) =>
            set(
              'buttonSize',
              event.target.value as RiichiPlayerSettings['buttonSize'],
            )
          }
        >
          <option value="large">{t('riichi.settings.buttonSize.large')}</option>
          <option value="standard">
            {t('riichi.settings.buttonSize.standard')}
          </option>
        </select>
      </label>
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
