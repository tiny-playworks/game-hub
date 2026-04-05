import { getAvatarPresetById, type PlayerProfile } from '@/lib/playerProfile';

type Props = {
  profile: PlayerProfile;
  size?: 'sm' | 'md' | 'lg';
};

export function PlayerAvatar({ profile, size = 'md' }: Props) {
  const box =
    size === 'lg'
      ? 'h-20 w-20 rounded-[22px] text-3xl'
      : size === 'sm'
        ? 'h-10 w-10 rounded-xl text-lg'
        : 'h-16 w-16 rounded-2xl text-2xl';

  if (profile.avatarMode === 'upload' && profile.avatarUploadDataUrl) {
    return (
      <img
        src={profile.avatarUploadDataUrl}
        alt=""
        className={`${box} border border-slate-200 object-cover`}
      />
    );
  }
  const preset = getAvatarPresetById(profile.avatarPresetId);
  return (
    <div
      className={`flex items-center justify-center border border-slate-200 font-semibold ${box} ${preset.bgClass} ${preset.fgClass}`}
      role="img"
      aria-label={preset.label}
    >
      {preset.glyph}
    </div>
  );
}
