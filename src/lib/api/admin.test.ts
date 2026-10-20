import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTtlCache, paginate, PAGINATION_ORDER_KEY, requireAdmin, type AdminClient } from './admin';
import { fakePostgrest } from '@/test/fakePostgrest';

const authMocks = vi.hoisted(() => {
  const serverClient = {
    auth: {
      getUser: vi.fn(),
    },
  };
  const adminBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  const adminClient = {
    from: vi.fn().mockReturnValue(adminBuilder),
  };
  return {
    serverClient,
    adminBuilder,
    adminClient,
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: authMocks.createClient,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: authMocks.createAdminClient,
}));

function makeMockClient(pages: unknown[][]) {
  let pageIndex = 0;
  const range = vi.fn().mockImplementation(() => {
    const data = pages[pageIndex] ?? [];
    pageIndex++;
    return Promise.resolve({ data });
  });
  const builder = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range,
  };
  const from = vi.fn().mockReturnValue(builder);
  return { client: { from } as unknown as AdminClient, builder, from };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.createClient.mockResolvedValue(authMocks.serverClient);
  authMocks.createAdminClient.mockReturnValue(authMocks.adminClient);
  authMocks.adminClient.from.mockReturnValue(authMocks.adminBuilder);
  authMocks.adminBuilder.select.mockReturnThis();
  authMocks.adminBuilder.eq.mockReturnThis();
});

describe('requireAdmin', () => {
  it('returns 401 when there is no authenticated user', async () => {
    authMocks.serverClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await requireAdmin();

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    await expect((result as Response).json()).resolves.toEqual({
      error: 'Authentication required',
    });
    expect(authMocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('returns 403 when the authenticated user is not an admin', async () => {
    authMocks.serverClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    authMocks.adminBuilder.single.mockResolvedValue({
      data: { is_admin: false },
      error: null,
    });

    const result = await requireAdmin();

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    await expect((result as Response).json()).resolves.toEqual({
      error: 'Admin access required',
    });
    expect(authMocks.adminClient.from).toHaveBeenCalledWith('users');
    expect(authMocks.adminBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('returns the admin client for authenticated admins', async () => {
    authMocks.serverClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null,
    });
    authMocks.adminBuilder.single.mockResolvedValue({
      data: { is_admin: true },
      error: null,
    });

    const result = await requireAdmin();

    expect(result).toEqual({ admin: authMocks.adminClient });
  });
});

describe('paginate', () => {
  it('returns rows for a single page', async () => {
    const { client } = makeMockClient([[{ id: 1 }, { id: 2 }]]);
    const result = await paginate<{ id: number }>(client, 'users', 'id');
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('paginates across multiple pages until a short page is returned', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const partialPage = [{ id: 1000 }, { id: 1001 }];
    const { client, builder } = makeMockClient([fullPage, partialPage]);

    const result = await paginate<{ id: number }>(client, 'users', 'id');

    expect(result).toHaveLength(1002);
    expect(result[0]).toEqual({ id: 0 });
    expect(result[1001]).toEqual({ id: 1001 });
    expect(builder.range).toHaveBeenCalledTimes(2);
    expect(builder.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(builder.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it('returns an empty array when the first page is empty', async () => {
    const { client, builder } = makeMockClient([[]]);
    const result = await paginate<{ id: number }>(client, 'users', 'id');
    expect(result).toEqual([]);
    expect(builder.range).toHaveBeenCalledTimes(1);
  });

  it('applies a date-column cutoff via gte when provided', async () => {
    const { client, builder } = makeMockClient([[{ id: 1 }]]);
    await paginate<{ id: number }>(client, 'users', 'id, created_at', {
      dateColumn: 'created_at',
      cutoff: '2025-01-01',
    });
    expect(builder.gte).toHaveBeenCalledWith('created_at', '2025-01-01');
  });

  it('does not call gte when cutoff is missing', async () => {
    const { client, builder } = makeMockClient([[{ id: 1 }]]);
    await paginate<{ id: number }>(client, 'users', 'id', { dateColumn: 'created_at' });
    expect(builder.gte).not.toHaveBeenCalled();
  });

  it("orders every page by the table's unique key", async () => {
    const { client, builder } = makeMockClient([[{ day: '2026-01-01' }]]);
    await paginate<{ day: string }>(client, 'platform_daily_stats', 'day');
    expect(builder.order).toHaveBeenCalledWith('day', { ascending: true });
  });

  it('reads more than 1000 rows completely, with no duplicates, when the database reorders between queries', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: `u${String(i).padStart(4, '0')}` }));
    const client = fakePostgrest({ users: rows }) as unknown as AdminClient;

    const result = await paginate<{ id: string }>(client, 'users', 'id');

    expect(result).toHaveLength(2500);
    expect(new Set(result.map((r) => r.id)).size).toBe(2500);
  });

  it('applies the cutoff before paging, so historical rows cannot crowd out recent ones', async () => {
    const old = Array.from({ length: 1500 }, (_, i) => ({ id: `a${String(i).padStart(4, '0')}`, created_at: '2020-01-01' }));
    const recent = Array.from({ length: 1200 }, (_, i) => ({ id: `b${String(i).padStart(4, '0')}`, created_at: '2026-06-01' }));
    const client = fakePostgrest({ users: [...old, ...recent] }) as unknown as AdminClient;

    const result = await paginate<{ id: string }>(client, 'users', 'id', { dateColumn: 'created_at', cutoff: '2026-01-01' });

    expect(result.map((r) => r.id).sort()).toEqual(recent.map((r) => r.id));
  });

  it('names a unique order key for every table', () => {
    // Primary keys (schema.sql). Non-unique keys like created_at would let
    // tied rows straddle a page boundary.
    expect(PAGINATION_ORDER_KEY).toEqual({
      users: 'id',
      games: 'id',
      game_memberships: 'id',
      availability: 'id',
      user_availability_defaults: 'id',
      sessions: 'id',
      game_play_dates: 'id',
      platform_daily_stats: 'day',
      deletion_log: 'id',
    });
  });

  it('throws when Supabase returns an error for a page', async () => {
    const error = new Error('database unavailable');
    const builder = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error }),
    };
    const client = { from: vi.fn().mockReturnValue(builder) } as unknown as AdminClient;

    await expect(paginate<{ id: number }>(client, 'users', 'id')).rejects.toThrow(
      'database unavailable',
    );
  });
});

describe('createTtlCache', () => {
  it('returns an entry until it is older than the TTL', () => {
    vi.useFakeTimers();
    try {
      const cache = createTtlCache<string>(1000);
      cache.set('k', 'v');
      expect(cache.get('k')).toBe('v');
      vi.advanceTimersByTime(999);
      expect(cache.get('k')).toBe('v');
      vi.advanceTimersByTime(1);
      expect(cache.get('k')).toBeUndefined();
      expect(cache.get('missing')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
