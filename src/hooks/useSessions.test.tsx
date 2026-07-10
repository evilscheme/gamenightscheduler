import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSessions } from './useSessions';
import { queryKeys } from '@/lib/queryKeys';
import { USAGE_LIMITS } from '@/lib/constants';
import type { GameSession } from '@/types';

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({}),
}));

const dataMocks = vi.hoisted(() => ({
  fetchGameSessions: vi.fn(),
  confirmSession: vi.fn(),
  cancelSession: vi.fn(),
  updateSession: vi.fn(),
}));
vi.mock('@/lib/data', () => dataMocks);

const GAME_ID = 'game-1';

function row(overrides: Partial<GameSession>): GameSession {
  return {
    id: 's-1',
    game_id: GAME_ID,
    date: '2030-01-10',
    start_time: '19:00',
    end_time: '22:00',
    status: 'confirmed',
    confirmed_by: 'user-1',
    location: null,
    notes: null,
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  } as GameSession;
}

function setup(seed: GameSession[]) {
  dataMocks.fetchGameSessions.mockResolvedValue({ data: seed, error: null });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const utils = renderHook(() => useSessions(GAME_ID), { wrapper });
  return { ...utils, invalidateSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSessions — confirmSession', () => {
  it('writes the server-confirmed row to the cache sorted, and invalidates the dashboard', async () => {
    const serverRow = row({ id: 's-new', date: '2030-01-05' });
    dataMocks.confirmSession.mockResolvedValue({ data: serverRow, error: null });
    const { result, invalidateSpy } = setup([row({ id: 's-1', date: '2030-01-10' })]);
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome!: { success: boolean; error?: string };
    await act(async () => {
      outcome = await result.current.confirmSession('2030-01-05', '19:00', '22:00', 'user-1');
    });

    expect(outcome).toEqual({ success: true });
    // Full row passed through to the data layer.
    expect(dataMocks.confirmSession).toHaveBeenCalledWith(expect.anything(), {
      game_id: GAME_ID,
      date: '2030-01-05',
      start_time: '19:00',
      end_time: '22:00',
      confirmed_by: 'user-1',
      location: null,
      notes: null,
    });
    // Cache write is sorted by date; the other cached view is invalidated.
    await waitFor(() => {
      expect(result.current.sessions.map((s) => s.id)).toEqual(['s-new', 's-1']);
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dashboardAll });
  });

  it('rejects past dates without calling the server', async () => {
    const { result } = setup([]);
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome!: { success: boolean; error?: string };
    await act(async () => {
      outcome = await result.current.confirmSession('2020-01-01', '19:00', '22:00', 'user-1');
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/past/i);
    expect(dataMocks.confirmSession).not.toHaveBeenCalled();
  });

  it('rejects new sessions at the future-session limit without calling the server', async () => {
    const seed = Array.from({ length: USAGE_LIMITS.MAX_FUTURE_SESSIONS_PER_GAME }, (_, i) =>
      row({ id: `s-${i}`, date: `2031-01-${String((i % 28) + 1).padStart(2, '0')}` })
    );
    const { result } = setup(seed);
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome!: { success: boolean; error?: string };
    await act(async () => {
      outcome = await result.current.confirmSession('2032-06-01', '19:00', '22:00', 'user-1');
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/future sessions/i);
    expect(dataMocks.confirmSession).not.toHaveBeenCalled();
  });
});

describe('useSessions — cancelSession', () => {
  it('removes the row from the cache and invalidates the dashboard on success', async () => {
    dataMocks.cancelSession.mockResolvedValue({ error: null });
    const { result, invalidateSpy } = setup([row({ id: 's-1', date: '2030-01-10' })]);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.cancelSession('2030-01-10');
    });

    await waitFor(() => expect(result.current.sessions).toEqual([]));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dashboardAll });
  });

  it('keeps the row when the delete fails', async () => {
    dataMocks.cancelSession.mockResolvedValue({ error: { message: 'boom' } });
    const { result } = setup([row({ id: 's-1', date: '2030-01-10' })]);
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome!: { success: boolean; error?: string };
    await act(async () => {
      outcome = await result.current.cancelSession('2030-01-10');
    });

    expect(outcome.success).toBe(false);
    expect(result.current.sessions.map((s) => s.id)).toEqual(['s-1']);
  });
});

describe('useSessions — updateSession', () => {
  it('refetches and reports when the session vanished (PGRST116)', async () => {
    dataMocks.updateSession.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    });
    const { result } = setup([row({ id: 's-1', date: '2030-01-10' })]);
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome!: { success: boolean; error?: string };
    await act(async () => {
      outcome = await result.current.updateSession('s-1', { start_time: '20:00' });
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toMatch(/no longer exists/i);
    // The refresh path refetched server truth.
    await waitFor(() => expect(dataMocks.fetchGameSessions).toHaveBeenCalledTimes(2));
  });

  it('applies the server-updated row to the cache on success', async () => {
    const updated = row({ id: 's-1', date: '2030-01-10', start_time: '20:00' });
    dataMocks.updateSession.mockResolvedValue({ data: updated, error: null });
    const { result, invalidateSpy } = setup([row({ id: 's-1', date: '2030-01-10' })]);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateSession('s-1', { start_time: '20:00' });
    });

    await waitFor(() => {
      expect(result.current.sessions[0]?.start_time).toBe('20:00');
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dashboardAll });
  });
});
