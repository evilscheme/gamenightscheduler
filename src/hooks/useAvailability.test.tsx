import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAvailability } from './useAvailability';
import { queryKeys } from '@/lib/queryKeys';
import type { Availability } from '@/types';

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({}),
}));

const dataMocks = vi.hoisted(() => ({
  fetchAllAvailability: vi.fn(),
  fetchUserAvailability: vi.fn(),
  upsertAvailability: vi.fn(),
  batchUpsertAvailability: vi.fn(),
  fetchUserDefaults: vi.fn(),
}));
vi.mock('@/lib/data', () => dataMocks);

const GAME_ID = 'game-1';
const USER_ID = 'user-1';

function row(overrides: Partial<Availability>): Availability {
  return {
    id: 'row-1',
    user_id: USER_ID,
    game_id: GAME_ID,
    date: '2026-08-01',
    status: 'available',
    comment: null,
    available_after: null,
    available_until: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  } as Availability;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(seed: Availability[]) {
  dataMocks.fetchAllAvailability.mockResolvedValue({ data: seed, error: null });
  dataMocks.fetchUserDefaults.mockResolvedValue({ data: [], error: null });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const utils = renderHook(() => useAvailability(GAME_ID, USER_ID, null), {
    wrapper,
  });
  return { ...utils, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAvailability — changeAvailability', () => {
  it('applies the write to the cache synchronously and keeps it on success', async () => {
    const upsert = deferred<{ error: null }>();
    dataMocks.upsertAvailability.mockReturnValue(upsert.promise);
    const { result, queryClient } = setup([]);
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.changeAvailability('2026-08-02', 'maybe', 'late ok', '20:00', null);
    });

    // Optimistic: visible before the server write resolves (the deferred
    // upsert is still pending; waitFor only flushes the notify scheduler).
    await waitFor(() => {
      expect(result.current.availability['2026-08-02']).toEqual({
        status: 'maybe',
        comment: 'late ok',
        available_after: '20:00',
        available_until: null,
      });
    });
    // The row is written under the queryKeys-registry key, full row shape.
    expect(dataMocks.upsertAvailability).toHaveBeenCalledWith(expect.anything(), {
      user_id: USER_ID,
      game_id: GAME_ID,
      date: '2026-08-02',
      status: 'maybe',
      comment: 'late ok',
      available_after: '20:00',
      available_until: null,
    });

    await act(async () => {
      upsert.resolve({ error: null });
      await pending;
    });

    // Retained on success; no reconcile refetch (initial fetch only).
    await waitFor(() => {
      expect(result.current.availability['2026-08-02']?.status).toBe('maybe');
    });
    expect(dataMocks.fetchAllAvailability).toHaveBeenCalledTimes(1);
    const cached = queryClient.getQueryData<Availability[]>(queryKeys.availability(GAME_ID));
    expect(cached?.some((a) => a.date === '2026-08-02' && a.status === 'maybe')).toBe(true);
  });

  it('rolls back and refetches server truth on write error', async () => {
    const seed = [row({ date: '2026-08-01', status: 'maybe' })];
    const upsert = deferred<{ error: { message: string } }>();
    dataMocks.upsertAvailability.mockReturnValue(upsert.promise);
    const { result } = setup(seed);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.availability['2026-08-01']?.status).toBe('maybe');

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.changeAvailability('2026-08-01', 'available', null, null, null);
    });
    await waitFor(() => {
      expect(result.current.availability['2026-08-01']?.status).toBe('available');
    });

    await act(async () => {
      upsert.resolve({ error: { message: 'boom' } });
      await pending;
    });

    // Reverted to the pre-write row AND reconciled against the server.
    await waitFor(() => {
      expect(result.current.availability['2026-08-01']?.status).toBe('maybe');
    });
    expect(dataMocks.fetchAllAvailability).toHaveBeenCalledTimes(2);
  });
});

describe('useAvailability — bulkSetStatus', () => {
  it('issues ONE batched upsert for N dates and applies all optimistically', async () => {
    dataMocks.batchUpsertAvailability.mockResolvedValue({ error: null });
    const { result } = setup([]);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.bulkSetStatus(
        ['2026-08-03', '2026-08-04', '2026-08-05'],
        'unavailable'
      );
    });

    expect(dataMocks.batchUpsertAvailability).toHaveBeenCalledTimes(1);
    const rows = dataMocks.batchUpsertAvailability.mock.calls[0][1];
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r).toMatchObject({ user_id: USER_ID, game_id: GAME_ID, status: 'unavailable' });
    }
    await waitFor(() => {
      expect(result.current.availability['2026-08-03']?.status).toBe('unavailable');
      expect(result.current.availability['2026-08-05']?.status).toBe('unavailable');
    });
  });

  it('reverts exactly the affected rows on error, leaving other players intact', async () => {
    const seed = [
      row({ id: 'mine', date: '2026-08-01', status: 'available', comment: 'keep me' }),
      row({ id: 'theirs', user_id: 'user-2', date: '2026-08-01', status: 'maybe' }),
    ];
    const batch = deferred<{ error: { message: string } }>();
    dataMocks.batchUpsertAvailability.mockReturnValue(batch.promise);
    const { result } = setup(seed);
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.bulkSetStatus(['2026-08-01', '2026-08-02'], 'unavailable');
    });
    await waitFor(() => {
      expect(result.current.availability['2026-08-01']?.status).toBe('unavailable');
      expect(result.current.availability['2026-08-02']?.status).toBe('unavailable');
    });

    // Make the reconcile refetch hang so we observe the reverted cache, not
    // the refetch result.
    dataMocks.fetchAllAvailability.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      batch.resolve({ error: { message: 'boom' } });
      await pending;
    });

    // Own row restored (comment included), speculative date removed,
    // the other player's row untouched.
    await waitFor(() => {
      expect(result.current.availability['2026-08-01']).toEqual({
        status: 'available',
        comment: 'keep me',
        available_after: null,
        available_until: null,
      });
    });
    expect(result.current.availability['2026-08-02']).toBeUndefined();
    expect(
      result.current.allAvailability.some(
        (a) => a.user_id === 'user-2' && a.status === 'maybe'
      )
    ).toBe(true);
    expect(dataMocks.fetchAllAvailability).toHaveBeenCalledTimes(2);
  });
});
