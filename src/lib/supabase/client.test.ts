import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock createBrowserClient to capture the fetch option
const mockCreateBrowserClient = vi.fn().mockReturnValue({});
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) => {
    mockCreateBrowserClient(...args);
    return {};
  },
}));

const SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

describe('Supabase client fetch monitoring', () => {
  let createClient: typeof import('./client').createClient;
  let onSupabaseStatus: typeof import('./client').onSupabaseStatus;

  beforeEach(async () => {
    vi.resetModules();
    mockCreateBrowserClient.mockClear();
    const mod = await import('./client');
    createClient = mod.createClient;
    onSupabaseStatus = mod.onSupabaseStatus;
  });

  it('passes global.fetch to createBrowserClient', () => {
    createClient();
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      SUPABASE_URL,
      'test-anon-key',
      expect.objectContaining({
        global: expect.objectContaining({
          fetch: expect.any(Function),
        }),
      }),
    );
  });

  describe('fetch wrapper', () => {
    let monitoredFetch: typeof fetch;
    let listener: ReturnType<typeof vi.fn>;
    let unsubscribe: () => void;

    beforeEach(() => {
      createClient();
      monitoredFetch =
        mockCreateBrowserClient.mock.calls[0][2].global.fetch;
      listener = vi.fn();
      unsubscribe = onSupabaseStatus(listener);
    });

    afterEach(() => {
      unsubscribe();
      vi.restoreAllMocks();
    });

    it('notifies error on 5xx response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('', { status: 503 })),
      );
      await monitoredFetch(`${SUPABASE_URL}/rest/v1/games`);
      expect(listener).toHaveBeenCalledWith(true);
    });

    it('notifies recovery on 2xx response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
      );
      await monitoredFetch(`${SUPABASE_URL}/rest/v1/games`);
      expect(listener).toHaveBeenCalledWith(false);
    });

    it('does NOT notify on 4xx response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('', { status: 403 })),
      );
      await monitoredFetch(`${SUPABASE_URL}/rest/v1/games`);
      expect(listener).not.toHaveBeenCalled();
    });

    it('does NOT notify for non-Supabase URLs', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('', { status: 503 })),
      );
      await monitoredFetch('https://other-api.com/endpoint');
      expect(listener).not.toHaveBeenCalled();
    });

    it('stops notifying after unsubscribe', async () => {
      unsubscribe();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('', { status: 503 })),
      );
      await monitoredFetch(`${SUPABASE_URL}/rest/v1/games`);
      expect(listener).not.toHaveBeenCalled();
    });

    describe('network error retry', () => {
      it('retries once on network error and returns successful response', async () => {
        const mockFetch = vi
          .fn()
          .mockRejectedValueOnce(new TypeError('Failed to fetch'))
          .mockResolvedValueOnce(new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', mockFetch);

        const response = await monitoredFetch(`${SUPABASE_URL}/rest/v1/games`);

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(response.status).toBe(200);
        expect(listener).toHaveBeenCalledWith(false);
        expect(listener).not.toHaveBeenCalledWith(true);
      });

      it('notifies error and re-throws when retry also fails', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
        );

        await expect(
          monitoredFetch(`${SUPABASE_URL}/rest/v1/games`),
        ).rejects.toThrow('Failed to fetch');
        expect(listener).toHaveBeenCalledWith(true);
      });

      it('does NOT retry for non-Supabase URLs', async () => {
        const mockFetch = vi
          .fn()
          .mockRejectedValue(new TypeError('Failed to fetch'));
        vi.stubGlobal('fetch', mockFetch);

        await expect(
          monitoredFetch('https://other-api.com/endpoint'),
        ).rejects.toThrow('Failed to fetch');
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(listener).not.toHaveBeenCalled();
      });

      it('notifies error when retry returns 5xx', async () => {
        const mockFetch = vi
          .fn()
          .mockRejectedValueOnce(new TypeError('Failed to fetch'))
          .mockResolvedValueOnce(new Response('', { status: 503 }));
        vi.stubGlobal('fetch', mockFetch);

        const response = await monitoredFetch(`${SUPABASE_URL}/rest/v1/games`);

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(response.status).toBe(503);
        expect(listener).toHaveBeenCalledWith(true);
      });
    });
  });
});
