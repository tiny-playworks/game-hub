import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'rstack/test';
import { createEmptySnapshot } from '../server/src/snapshot';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { WeeklyChampionsCard } from '@/components/profile/WeeklyChampionsCard';
import { ArcadeSession, useArcade } from '@/contexts/ArcadeContext';
import { HouseholdProvider } from '@/contexts/HouseholdContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { formatFamilyFeedItem } from '@/lib/formatFamilyFeed';
import { getMessage } from '@/lib/i18n';
import { leaderboardMessages } from '@/lib/leaderboardMessages';
import Leaderboard from '@/pages/Leaderboard';

describe('P23.4 Family Leaderboard & Feed UI', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('has matching zh and en keys in leaderboardMessages and resolves via getMessage', () => {
    expect(Object.keys(leaderboardMessages.zh).sort()).toEqual(
      Object.keys(leaderboardMessages.en).sort(),
    );
    for (const key of Object.keys(leaderboardMessages.zh)) {
      expect(getMessage('zh', key)).not.toBe(key);
      expect(getMessage('en', key)).not.toBe(key);
    }
  });

  it('formats family feed items accurately in both zh and en', () => {
    const recordItem = {
      id: 1,
      kind: 'family-record' as const,
      memberId: 'm1',
      nickname: 'Alice',
      gameId: '2048',
      difficulty: 'normal',
      value: 4096,
      weekId: null,
      cupId: null,
      createdAt: 1700000000000,
    };
    expect(formatFamilyFeedItem(recordItem, 'zh')).toContain('Alice');
    expect(formatFamilyFeedItem(recordItem, 'zh')).toContain('4096');
    expect(formatFamilyFeedItem(recordItem, 'en')).toContain('Alice');
    expect(formatFamilyFeedItem(recordItem, 'en')).toContain('4096');

    const champItem = {
      id: 2,
      kind: 'weekly-champion' as const,
      memberId: 'm2',
      nickname: 'Bob',
      gameId: 'snake',
      difficulty: 'hard',
      value: 320,
      weekId: '2026-10-12',
      cupId: null,
      createdAt: 1700000000000,
    };
    expect(formatFamilyFeedItem(champItem, 'zh')).toContain('2026-10-12');
    expect(formatFamilyFeedItem(champItem, 'en')).toContain('2026-10-12');
  });

  it('shows member-only prompt on Leaderboard page when in guest mode', async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/healthz')) {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      }
      if (url.includes('/api/v1/members')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 });
    };

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/leaderboard']}>
          <LocaleProvider>
            <HouseholdProvider>
              <Leaderboard />
            </HouseholdProvider>
          </LocaleProvider>
        </MemoryRouter>,
      );
    });

    expect(screen.getByTestId('leaderboard-member-only')).toBeDefined();
  });

  it('renders live rankings, scope switching, and family feed when logged in as an online member', async () => {
    const snap = createEmptySnapshot('m1', 'Alice');
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/healthz')) {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      }
      if (url.includes('/api/v1/members')) {
        return new Response(
          JSON.stringify([
            { id: 'm1', nickname: 'Alice', avatarPresetId: 'default-1', avatarUploadDataUrl: null },
            { id: 'm2', nickname: 'Bob', avatarPresetId: 'default-2', avatarUploadDataUrl: null },
          ]),
          { status: 200 },
        );
      }
      if (url.endsWith('/api/v1/me')) {
        return new Response(
          JSON.stringify({ snapshot: snap, deviceId: 'dev-1' }),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/leaderboard')) {
        const isWeek = url.includes('scope=week');
        return new Response(
          JSON.stringify({
            gameId: '2048',
            difficulty: 'normal',
            scope: isWeek ? 'week' : 'all-time',
            metric: 'max',
            weekId: isWeek ? '2026-10-19' : null,
            entries: [
              {
                rank: 1,
                memberId: 'm1',
                nickname: 'Alice',
                avatar: 'default-1',
                value: isWeek ? 2048 : 8192,
                achievedAt: 1700000000000,
              },
              {
                rank: 2,
                memberId: 'm2',
                nickname: 'Bob',
                avatar: 'default-2',
                value: 1024,
                achievedAt: 0,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/feed')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 10,
                kind: 'family-record',
                memberId: 'm1',
                nickname: 'Alice',
                gameId: '2048',
                difficulty: 'normal',
                value: 8192,
                weekId: null,
                cupId: null,
                createdAt: 1700000000000,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/me/champions')) {
        return new Response(
          JSON.stringify({
            badges: [
              {
                weekId: '2026-10-12',
                gameId: '2048',
                difficulty: 'normal',
                value: 4096,
                awardedAt: 1700000000000,
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/leaderboard?game=2048&difficulty=normal']}>
          <LocaleProvider>
            <HouseholdProvider>
              <Leaderboard />
              <WeeklyChampionsCard />
            </HouseholdProvider>
          </LocaleProvider>
        </MemoryRouter>,
      );
    });

    // All-time board rendered with Alice (#1, 8192) and Bob (#2, 1024)
    expect(screen.getByTestId('leaderboard-row-m1').textContent).toContain('8192');
    expect(screen.getByTestId('leaderboard-row-m2').textContent).toContain('1024');

    // WeeklyChampionsCard rendered with 2026-10-12 badge
    expect(screen.getByTestId('champion-badge-2026-10-12-2048').textContent).toContain('4096');

    // Switch to weekly scope
    await act(async () => {
      fireEvent.click(screen.getByTestId('scope-week'));
    });
    expect(screen.getByTestId('leaderboard-row-m1').textContent).toContain('2048');
  });

  it('displays family standing, gap to previous, and family record notice in GameResultOverlay', async () => {
    const snap = createEmptySnapshot('m1', 'Alice');
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/healthz')) {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      }
      if (url.includes('/api/v1/members')) {
        return new Response(
          JSON.stringify([{ id: 'm1', nickname: 'Alice', avatarPresetId: 'default-1', avatarUploadDataUrl: null }]),
          { status: 200 },
        );
      }
      if (url.endsWith('/api/v1/me')) {
        return new Response(JSON.stringify({ snapshot: snap, deviceId: 'dev-1' }), { status: 200 });
      }
      if (url.includes('/api/v1/me/arcade/events')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        if (body.event?.type === 'start') {
          return new Response(
            JSON.stringify({ snapshot: snap, result: { coinsEarned: 0, capReached: false } }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            snapshot: snap,
            result: {
              coinsEarned: 25,
              capReached: false,
              record: { isNewBest: true, previousBest: 1024, currentBest: 2048 },
              leaderboard: {
                allTimeRank: 2,
                weekRank: 1,
                allTimeGapToPrevious: 512,
                weekGapToPrevious: null,
                isFamilyRecord: true,
              },
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };

    function TriggerFinish() {
      const arcade = useArcade();
      return (
        <div>
          <button
            type="button"
            data-testid="finish-btn"
            onClick={() => arcade.finish('win', 2048)}
          >
            Finish
          </button>
          <GameResultOverlay
            open={Boolean(arcade.result)}
            tone="win"
            title="Victory"
            onRestart={arcade.restart}
          />
        </div>
      );
    }

    await act(async () => {
      render(
        <MemoryRouter>
          <LocaleProvider>
            <HouseholdProvider>
              <ArcadeSession gameId="2048">
                <TriggerFinish />
              </ArcadeSession>
            </HouseholdProvider>
          </LocaleProvider>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('finish-btn'));
    });

    const standingBox = screen.getByTestId('overlay-family-standing');
    expect(standingBox).toBeDefined();
    expect(standingBox.textContent).toContain('512');
  });
});
