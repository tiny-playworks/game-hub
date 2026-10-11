import { useLocale } from '@/contexts/LocaleContext';
import { games } from '@/data/games';
import { type ArcadeDifficulty, arcadeStatsKey } from '@/lib/arcade';
import {
  DEFAULT_GAME_STATS,
  getBestValue,
  useGameStore,
} from '@/store/gameStore';

export function PersonalBest({
  gameId,
  difficulty = 'normal',
}: {
  gameId: string;
  difficulty?: ArcadeDifficulty;
}) {
  const { t } = useLocale();
  const stats = useGameStore(
    (state) =>
      state.stats[arcadeStatsKey(gameId, difficulty)] ?? DEFAULT_GAME_STATS,
  );
  const game = games.find((item) => item.id === gameId);
  if (!game || game.categoryId === 'mahjong') return null;
  const value = getBestValue(gameId, stats);
  return (
    <span
      className="game-pill border-gold/40 bg-gold/10 text-xs"
      data-personal-best={gameId}
      data-difficulty={difficulty}
    >
      <span>{t('arcade.personalBest')}</span>
      <strong>
        {game.bestMetric === 'wins'
          ? `${stats.wins} ${t('arcade.unit.wins')} · ${stats.bestStreak} ${t('arcade.unit.streak')}`
          : value === null
            ? '—'
            : `${value} ${t(game.bestUnitKey)}`}
      </strong>
    </span>
  );
}
