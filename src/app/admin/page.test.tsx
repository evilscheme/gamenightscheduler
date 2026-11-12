import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from './page';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ authStatus: 'authenticated', profile: { id: 'admin', is_admin: true } }),
}));
vi.mock('@/hooks/useAuthRedirect', () => ({ useAuthRedirect: () => {} }));

// The spinner draws on a canvas, which jsdom lacks.
vi.mock('@/components/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/ui')>()),
  LoadingSpinner: () => <div>loading</div>,
}));

// The tabs themselves are covered elsewhere; here they just show what they got.
vi.mock('@/components/admin/OverviewTab', () => ({
  OverviewTab: ({ games }: { games: unknown[] }) => <div>overview: {games.length} games</div>,
}));
vi.mock('@/components/admin/GamesTab', () => ({
  GamesTab: ({ games }: { games: unknown[] }) => <div>games tab: {games.length} games</div>,
}));
vi.mock('@/components/admin/TopUsersTab', () => ({
  TopUsersTab: () => <div>top users tab</div>,
}));
vi.mock('@/components/admin/ActivityTab', () => ({
  ActivityTab: () => <div>activity tab</div>,
}));
vi.mock('@/components/admin/UpcomingGamesTab', () => ({
  UpcomingGamesTab: () => <div>upcoming tab</div>,
}));

type Pending = { url: string; resolve: (body: unknown) => void; fail: () => void };

const BODIES: Record<string, unknown> = {
  '/api/admin/stats': { totalUsers: 1, totalGames: 1, totalSessions: 0, recentUsers: [], recentGames: [] },
  '/api/admin/games': { games: [{ id: 'g1' }, { id: 'g2' }], health: {} },
  '/api/admin/top-users': { topGms: [], topPlayers: [] },
};

let pending: Pending[];

beforeEach(() => {
  pending = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url: string) =>
        new Promise((resolve) => {
          pending.push({
            url,
            resolve: (body) => resolve({ ok: true, json: async () => body }),
            fail: () => resolve({ ok: false, json: async () => ({}) }),
          });
        })
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function respond(url: string, how: 'ok' | 'fail' = 'ok') {
  const p = pending.find((x) => x.url === url);
  if (!p) throw new Error(`no request to ${url}`);
  pending = pending.filter((x) => x !== p);
  if (how === 'ok') p.resolve(BODIES[url]);
  else p.fail();
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminPage />
    </QueryClientProvider>
  );
}

const requested = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);

describe('AdminPage', () => {
  it('loads stats and games up front, and top users only when its tab opens', async () => {
    renderPage();
    await waitFor(() => expect(requested()).toEqual(['/api/admin/stats', '/api/admin/games']));

    fireEvent.click(screen.getByRole('button', { name: 'Top Users' }));
    await waitFor(() => expect(requested()).toContain('/api/admin/top-users'));
    respond('/api/admin/top-users');
    expect(await screen.findByText('top users tab')).toBeInTheDocument();

    // Switching away and back reuses it.
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Top Users' }));
    expect(await screen.findByText('top users tab')).toBeInTheDocument();
    expect(requested().filter((u) => u === '/api/admin/top-users')).toHaveLength(1);
  });

  it('shows the Activity tab as soon as stats arrive, without waiting for the games list', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    await waitFor(() => expect(requested()).toContain('/api/admin/stats'));
    respond('/api/admin/stats');
    expect(await screen.findByText('activity tab')).toBeInTheDocument();
  });

  it('keeps Overview loading until both stats and games arrive', async () => {
    renderPage();
    await waitFor(() => expect(requested()).toHaveLength(2));
    respond('/api/admin/stats');
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.queryByText(/overview:/)).not.toBeInTheDocument();
    respond('/api/admin/games');
    expect(await screen.findByText('overview: 2 games')).toBeInTheDocument();
  });

  it("shows a tab's own error without blocking tabs that don't use the failed query", async () => {
    renderPage();
    await waitFor(() => expect(requested()).toHaveLength(2));
    respond('/api/admin/games', 'fail');
    expect(await screen.findByText('Failed to fetch admin data')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    respond('/api/admin/stats');
    expect(await screen.findByText('activity tab')).toBeInTheDocument();
  });
});
