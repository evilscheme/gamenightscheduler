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

interface SetupOptions {
  /** Override the fetchGameWithGM result (defaults to a successful load). */
  gameRes?: { data: unknown; error: unknown };
  /** Retry count for the query client (defaults to none, for fast tests). */
  retry?: number | false;
}

function setup(opts: SetupOptions = {}) {
  dataMocks.fetchGameWithGM.mockResolvedValue(
    opts.gameRes ?? { data: { ...GAME }, error: null }
  );
  dataMocks.fetchGameMembers.mockResolvedValue({ data: [], error: null });
  dataMocks.fetchMyGamesLite.mockResolvedValue([]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: opts.retry ?? false, retryDelay: 0 } },
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

describe('useGameMeta — load failures', () => {
  // An expired access token makes PostgREST run the request as `anon`, which
  // has no EXECUTE on is_game_participant(), so the query errors rather than
  // returning zero rows. That must not read as "this game does not exist".
  const RLS_ERROR = {
    data: null,
    error: { code: '42501', message: 'permission denied for function is_game_participant' },
  };

  // fetchGameWithGM uses .single(), so PostgREST reports "no rows" as an error
  // (PGRST116, HTTP 406) rather than an empty result. That is how BOTH a
  // deleted game and an RLS-filtered one arrive, so it must stay a not-found —
  // otherwise a non-member sees an error page instead of being redirected.
  const NO_ROWS = {
    data: null,
    error: { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object' },
  };

  it('treats PostgREST no-rows as a missing game, not a failure', async () => {
    const { result } = setup({ gameRes: NO_ROWS });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.game).toBeNull();
  });

  it('surfaces a failed load as an error', async () => {
    const { result } = setup({ gameRes: RLS_ERROR });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.game).toBeNull();
  });

  it('does not report a genuinely missing game as an error', async () => {
    const { result } = setup({ gameRes: { data: null, error: null } });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.game).toBeNull();
  });

  // The self-healing path: the token refresh usually lands before the retry,
  // so the second attempt succeeds and the player never sees a failure.
  it('retries a failed load before giving up', async () => {
    const { result } = setup({ gameRes: RLS_ERROR, retry: 1 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(dataMocks.fetchGameWithGM).toHaveBeenCalledTimes(2);
  });
});
