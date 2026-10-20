import { games } from '@/data/games';
import { difficultyLabelKey, normalizeArcadeDifficulty } from '@/lib/arcade';
import { formatMessage, getMessage, type Locale } from '@/lib/i18n';
import type { FamilyFeedItem } from '../../shared/contracts/leaderboard';

export function formatFamilyFeedItem(
  item: FamilyFeedItem,
  locale: Locale,
): string {
  const nickname = item.nickname || '—';
  if (item.kind === 'family-cup') {
    return formatMessage(locale, 'leaderboard.feed.familyCup', { nickname });
  }
  const gameId = item.gameId ?? '';
  const game = games.find((g) => g.id === gameId);
  const gameName = getMessage(locale, `game.${gameId}.name`);
  if (item.kind === 'family-arcade') {
    return formatMessage(locale, 'gameRoom.feed', { nickname, game: gameName });
  }
  const diffLabel = item.difficulty
    ? getMessage(
        locale,
        difficultyLabelKey(
          gameId,
          normalizeArcadeDifficulty(gameId, item.difficulty),
        ),
      )
    : '—';
  const unitLabel = getMessage(
    locale,
    game?.bestMetric === 'wins'
      ? 'arcade.unit.streak'
      : (game?.bestUnitKey ?? 'arcade.unit.points'),
  );
  const value = item.value ?? 0;

  if (item.kind === 'weekly-champion') {
    return formatMessage(locale, 'leaderboard.feed.weeklyChampion', {
      nickname,
      weekId: item.weekId ?? '—',
      game: gameName,
      difficulty: diffLabel,
      value,
      unit: unitLabel,
    });
  }
  return formatMessage(locale, 'leaderboard.feed.familyRecord', {
    nickname,
    game: gameName,
    difficulty: diffLabel,
    value,
    unit: unitLabel,
  });
}
