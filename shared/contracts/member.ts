import type { CheckinState } from '../../src/lib/checkin';
import type { CosmeticsState } from '../../src/lib/cosmetics';
import type { DailyTaskState } from '../../src/lib/dailyTasks';
import type { GrowthState } from '../../src/lib/growth';
import type { PlayerCharacterState } from '../../src/lib/playerCharacters';
import type { PlayerProfile } from '../../src/lib/playerProfile';
import type { PlayerStatsState } from '../../src/lib/playerStats';
import type { RankedState } from '../../src/lib/ranked';
import type { WalletState } from '../../src/lib/wallet';
import type { WeeklyTaskState } from '../../src/lib/weeklyTasks';
import type { ArcadeStoredState } from '../../src/lib/arcadeStats';

export type HouseholdMode = 'guest-local' | 'member-online';

export interface MemberSummary {
  id: string;
  nickname: string;
  avatarPresetId: string;
  avatarUploadDataUrl: string | null;
}

export interface MemberSnapshot {
  schema: 1;
  memberId: string;
  revision: number;
  updatedAt: string;
  profile: PlayerProfile;
  growth: GrowthState;
  characters: PlayerCharacterState;
  wallet: WalletState;
  cosmetics: CosmeticsState;
  achievements: string[];
  arcade: ArcadeStoredState;
  stats: PlayerStatsState;
  dailyTasks: DailyTaskState;
  weeklyTasks: WeeklyTaskState;
  checkin: CheckinState;
  ranked: RankedState;
  preferences: {
    locale: 'zh' | 'en';
    riichiTheme: string | null;
    venueTheme: string | null;
    arcadePrefs: Record<string, unknown>;
  };
  /** 旧牌谱与装饰性本地记录完整保留，后续按 P11 契约转换为独立续局。 */
  legacyData: Record<string, string>;
}
