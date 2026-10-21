import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, rs } from 'rstack/test';
import { createEmptySnapshot } from '../server/src/snapshot';
import { CuratedRotationPanel } from '@/components/home/CuratedRotationPanel';
import {
  useOptionalHousehold,
  type HouseholdContextValue,
} from '@/contexts/HouseholdContext';
import { useCharacters } from '@/hooks/useCosmetics';
import { fetchReplayList } from '@/lib/riichiReplayArchive';

rs.mock('@/contexts/HouseholdContext', () => ({
  useOptionalHousehold: rs.fn(),
}));
rs.mock('@/contexts/LocaleContext', () => ({
  useLocale: () => ({ locale: 'zh', t: (key: string) => key }),
}));
rs.mock('@/hooks/useCosmetics', () => ({ useCharacters: rs.fn() }));
rs.mock('@/lib/riichiReplayArchive', () => ({ fetchReplayList: rs.fn() }));

afterEach(() => {
  rs.resetAllMocks();
});

function member(id: string, online = true) {
  const snapshot = createEmptySnapshot(id, id);
  return {
    mode: online ? 'member-online' : 'member-offline',
    currentMember: { id },
    snapshot,
    isServerAvailable: online,
  } as HouseholdContextValue;
}
function setup() {
  rs.mocked(useCharacters).mockReturnValue({
    activeCharacterId: 'aoi',
  } as ReturnType<typeof useCharacters>);
  rs.mocked(useOptionalHousehold).mockReturnValue(member('A'));
  rs.mocked(fetchReplayList).mockResolvedValue({
    total: 1,
    favoritesCount: 0,
    items: [{ source: 'free' }],
  } as Awaited<ReturnType<typeof fetchReplayList>>);
  return render(
    <MemoryRouter>
      <CuratedRotationPanel />
    </MemoryRouter>,
  );
}

it('rechecks personal replay recommendations when switching between two members', async () => {
  const page = setup();
  await waitFor(() =>
    expect(
      page.container.querySelector('a[href="/replays/training"]'),
    ).not.toBeNull(),
  );
  const calls = rs.mocked(fetchReplayList).mock.calls.length;
  rs.mocked(fetchReplayList).mockResolvedValue({
    total: 0,
    favoritesCount: 0,
    items: [],
  } as Awaited<ReturnType<typeof fetchReplayList>>);
  rs.mocked(useOptionalHousehold).mockReturnValue(member('B'));
  await act(async () =>
    page.rerender(
      <MemoryRouter>
        <CuratedRotationPanel />
      </MemoryRouter>,
    ),
  );
  await waitFor(() =>
    expect(
      page.container.querySelector('a[href="/replays/training"]'),
    ).toBeNull(),
  );
  expect(rs.mocked(fetchReplayList).mock.calls.length).toBeGreaterThan(calls);
});

it('hides an online replay suggestion while the member is offline', async () => {
  const page = setup();
  await waitFor(() =>
    expect(
      page.container.querySelector('a[href="/replays/training"]'),
    ).not.toBeNull(),
  );
  rs.mocked(useOptionalHousehold).mockReturnValue(member('A', false));
  await act(async () =>
    page.rerender(
      <MemoryRouter>
        <CuratedRotationPanel />
      </MemoryRouter>,
    ),
  );
  expect(
    page.container.querySelector('a[href="/replays/training"]'),
  ).toBeNull();
});
