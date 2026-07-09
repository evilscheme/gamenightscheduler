import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePlayDates } from './usePlayDates';
import type { GamePlayDate } from '@/types';

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({}),
}));

const dataMocks = vi.hoisted(() => ({
  fetchGamePlayDates: vi.fn(),
  addPlayDate: vi.fn(),
  removePlayDate: vi.fn(),
  updatePlayDateNote: vi.fn(),
  upsertPlayDate: vi.fn(),
}));
vi.mock('@/lib/data', () => dataMocks);

const GAME_ID = 'game-1';

function row(overrides: Partial<GamePlayDate>): GamePlayDate {
  return {
    id: 'pd-1',
    game_id: GAME_ID,
    date: '2026-08-01',
    note: null,
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  } as GamePlayDate;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(seed: GamePlayDate[]) {
  dataMocks.fetchGamePlayDates.mockResolvedValue({ data: seed, error: null });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => usePlayDates(GAME_ID), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePlayDates — toggleExtraDate (add)', () => {
  it('shows a temp row optimistically, then reconciles with the server row', async () => {
    const add = deferred<{ data: GamePlayDate; error: null }>();
    dataMocks.addPlayDate.mockReturnValue(add.promise);
    const { result } = setup([]);
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.toggleExtraDate('2026-08-02', false);
    });

    // Optimistic temp row while the insert is in flight.
    await waitFor(() => {
      expect(result.current.gamePlayDates.map((r) => r.id)).toEqual(['temp-2026-08-02']);
    });

    const serverRow = row({ id: 'server-1', date: '2026-08-02' });
    await act(async () => {
      add.resolve({ data: serverRow, error: null });
      await pending;
    });

    // Temp row swapped for the server row.
    await waitFor(() => {
      expect(result.current.gamePlayDates.map((r) => r.id)).toEqual(['server-1']);
    });
  });

  it('removes the temp row when the insert fails', async () => {
    dataMocks.addPlayDate.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { result } = setup([]);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleExtraDate('2026-08-02', false);
    });

    await waitFor(() => {
      expect(result.current.gamePlayDates).toEqual([]);
    });
  });
});

describe('usePlayDates — toggleExtraDate (remove)', () => {
  it('restores the removed row in sorted position when the delete fails', async () => {
    const seed = [
      row({ id: 'a', date: '2026-08-01' }),
      row({ id: 'b', date: '2026-08-02' }),
      row({ id: 'c', date: '2026-08-03' }),
    ];
    const remove = deferred<{ error: { message: string } }>();
    dataMocks.removePlayDate.mockReturnValue(remove.promise);
    const { result } = setup(seed);
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.toggleExtraDate('2026-08-02', true);
    });
    // Optimistically gone.
    await waitFor(() => {
      expect(result.current.gamePlayDates.map((r) => r.id)).toEqual(['a', 'c']);
    });

    await act(async () => {
      remove.resolve({ error: { message: 'boom' } });
      await pending;
    });

    // Restored, still date-sorted.
    await waitFor(() => {
      expect(result.current.gamePlayDates.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    });
  });
});

describe('usePlayDates — updatePlayDateNote', () => {
  it('reverts the note on error for an existing row', async () => {
    const seed = [row({ id: 'a', date: '2026-08-01', note: 'original' })];
    const update = deferred<{ error: { message: string } }>();
    dataMocks.updatePlayDateNote.mockReturnValue(update.promise);
    const { result } = setup(seed);
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.updatePlayDateNote('2026-08-01', 'changed');
    });
    await waitFor(() => {
      expect(result.current.gamePlayDates[0]?.note).toBe('changed');
    });

    await act(async () => {
      update.resolve({ error: { message: 'boom' } });
      await pending;
    });

    await waitFor(() => {
      expect(result.current.gamePlayDates[0]?.note).toBe('original');
    });
  });
});
