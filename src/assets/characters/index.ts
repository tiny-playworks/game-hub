import ayaAvatar from './aya/avatar.webp';
import ayaFrustrated from './aya/frustrated.webp';
import ayaHappy from './aya/happy.webp';
import ayaNormal from './aya/normal.webp';
import chitoseAvatar from './chitose/avatar.webp';
import chitoseFrustrated from './chitose/frustrated.webp';
import chitoseHappy from './chitose/happy.webp';
import chitoseNormal from './chitose/normal.webp';
import koharuAvatar from './koharu/avatar.webp';
import koharuFrustrated from './koharu/frustrated.webp';
import koharuHappy from './koharu/happy.webp';
import koharuNormal from './koharu/normal.webp';
import mahiruAvatar from './mahiru/avatar.webp';
import mahiruFrustrated from './mahiru/frustrated.webp';
import mahiruHappy from './mahiru/happy.webp';
import mahiruNormal from './mahiru/normal.webp';
import mioAvatar from './mio/avatar.webp';
import mioFrustrated from './mio/frustrated.webp';
import mioHappy from './mio/happy.webp';
import mioNormal from './mio/normal.webp';
import rinAvatar from './rin/avatar.webp';
import rinFrustrated from './rin/frustrated.webp';
import rinHappy from './rin/happy.webp';
import rinNormal from './rin/normal.webp';
import soraAvatar from './sora/avatar.webp';
import soraFrustrated from './sora/frustrated.webp';
import soraHappy from './sora/happy.webp';
import soraNormal from './sora/normal.webp';
import yoruAvatar from './yoru/avatar.webp';
import yoruFrustrated from './yoru/frustrated.webp';
import yoruHappy from './yoru/happy.webp';
import yoruNormal from './yoru/normal.webp';

const assets: Record<string, string> = {
  'characters/koharu/avatar.webp': koharuAvatar,
  'characters/mio/avatar.webp': mioAvatar,
  'characters/rin/avatar.webp': rinAvatar,
  'characters/chitose/avatar.webp': chitoseAvatar,
  'characters/sora/avatar.webp': soraAvatar,
  'characters/aya/avatar.webp': ayaAvatar,
  'characters/mahiru/avatar.webp': mahiruAvatar,
  'characters/yoru/avatar.webp': yoruAvatar,
  'characters/koharu/happy.webp': koharuHappy,
  'characters/koharu/frustrated.webp': koharuFrustrated,
  'characters/mio/happy.webp': mioHappy,
  'characters/mio/frustrated.webp': mioFrustrated,
  'characters/rin/happy.webp': rinHappy,
  'characters/rin/frustrated.webp': rinFrustrated,
  'characters/chitose/happy.webp': chitoseHappy,
  'characters/chitose/frustrated.webp': chitoseFrustrated,
  'characters/sora/happy.webp': soraHappy,
  'characters/sora/frustrated.webp': soraFrustrated,
  'characters/aya/happy.webp': ayaHappy,
  'characters/aya/frustrated.webp': ayaFrustrated,
  'characters/mahiru/happy.webp': mahiruHappy,
  'characters/mahiru/frustrated.webp': mahiruFrustrated,
  'characters/yoru/happy.webp': yoruHappy,
  'characters/yoru/frustrated.webp': yoruFrustrated,
  'characters/koharu/normal.webp': koharuNormal,
  'characters/mio/normal.webp': mioNormal,
  'characters/rin/normal.webp': rinNormal,
  'characters/chitose/normal.webp': chitoseNormal,
  'characters/sora/normal.webp': soraNormal,
  'characters/aya/normal.webp': ayaNormal,
  'characters/mahiru/normal.webp': mahiruNormal,
  'characters/yoru/normal.webp': yoruNormal,
};

/** 数据层保存稳定资源路径，表现层只解析已到位的资源。 */
export function getCharacterAsset(path: string): string | undefined {
  return assets[path];
}
