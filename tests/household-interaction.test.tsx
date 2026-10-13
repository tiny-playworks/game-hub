import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'rstack/test';
import { MemberSelector } from '@/components/household/MemberSelector';
import { HouseholdProvider } from '@/contexts/HouseholdContext';
import { LocaleProvider } from '@/contexts/LocaleContext';

describe('P10 Household UI Interaction', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // 默认 mock
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders nothing when server is offline/unavailable', async () => {
    globalThis.fetch = async () => {
      throw new Error('Server down');
    };

    let containerResult: HTMLElement;
    await act(async () => {
      const { container } = render(
        <LocaleProvider>
          <HouseholdProvider>
            <MemberSelector />
          </HouseholdProvider>
        </LocaleProvider>,
      );
      containerResult = container;
    });

    expect(containerResult!.querySelector('[data-member-selector-trigger]')).toBeNull();
  });

  it('renders guest trigger button when server is online and unauthenticated', async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/healthz')) {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      }
      if (url.includes('/api/v1/members')) {
        return new Response(
          JSON.stringify([
            { id: 'mem-1', nickname: 'Alice', avatarPresetId: 'default-1', avatarUploadDataUrl: null },
          ]),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/me')) {
        return new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 });
      }
      return new Response('Not found', { status: 404 });
    };

    await act(async () => {
      render(
        <LocaleProvider>
          <HouseholdProvider>
            <MemberSelector />
          </HouseholdProvider>
        </LocaleProvider>,
      );
    });

    const trigger = screen.getByRole('button', { name: /家庭成员|Guest/i });
    expect(trigger).toBeDefined();
    expect(trigger.getAttribute('data-member-selector-trigger')).toBeTruthy();
  });
});
