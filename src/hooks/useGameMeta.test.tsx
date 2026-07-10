import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGameMeta } from './useGameMeta';

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({}),
}));
vi.mock('nanoid', () => ({ nanoid: () => 'NEWCODE123' }));

const dataMocks = vi.hoisted(() => ({
  fetchGameWithGM: vi.fn(),
  fetchGameMembers: vi.fn(),
  fetchMyGamesLite: vi.fn(),
  regenerateInviteCode: vi.fn(),
  leaveGame: vi.fn(),
  removePlayer: vi.fn(),
  deleteGame: vi.fn(),
  toggleCoGm: vi.fn(),
}));
vi.mock('@/lib/data', () => dataMocks);

const GAME = {
  id: 'game-1',
  name: 'Test Game',
  invite_code: 'OLDCODE',
  gm_id: 'user-1',
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup() {
  dataMocks.fetchGameWithGM.mockResolvedValue({ data: { ...GAME }, error: null });
  dataMocks.fetchGameMembers.mockResolvedValue({ data: [], error: null });
  dataMocks.fetchMyGamesLite.mockResolvedValue([]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useGameMeta('game-1', 'user-1'), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useGameMeta — regenerateInvite', () => {
  it('applies the new code optimistically and keeps it on success', async () => {
    const mutation = deferred<{ error: null }>();
    dataMocks.regenerateInviteCode.mockReturnValue(mutation.promise);
    const { result } = setup();
    await waitFor(() => expect(result.current.game?.invite_code).toBe('OLDCODE'));

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.regenerateInvite();
    });

    // Optimistic: visible before the server write resolves.
    await waitFor(() => expect(result.current.game?.invite_code).toBe('NEWCODE123'));
    expect(dataMocks.regenerateInviteCode).toHaveBeenCalledWith(
      expect.anything(),
      'game-1',
      'NEWCODE123'
    );

    await act(async () => {
      mutation.resolve({ error: null });
      await pending;
    });

    await waitFor(() => expect(result.current.game?.invite_code).toBe('NEWCODE123'));
    // No reconcile refetch on success.
    expect(dataMocks.fetchGameWithGM).toHaveBeenCalledTimes(1);
  });

  it('reverts the code and reconciles with the server on error', async () => {
    const mutation = deferred<{ error: { message: string } }>();
    dataMocks.regenerateInviteCode.mockReturnValue(mutation.promise);
    const { result } = setup();
    await waitFor(() => expect(result.current.game?.invite_code).toBe('OLDCODE'));

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.regenerateInvite();
    });
    await waitFor(() => expect(result.current.game?.invite_code).toBe('NEWCODE123'));

    await act(async () => {
      mutation.resolve({ error: { message: 'boom' } });
      await pending;
    });

    // Reverted, and the game query refetched for server truth.
    await waitFor(() => expect(result.current.game?.invite_code).toBe('OLDCODE'));
    expect(dataMocks.fetchGameWithGM).toHaveBeenCalledTimes(2);
  });
});
