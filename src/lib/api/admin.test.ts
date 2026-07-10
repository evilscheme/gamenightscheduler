import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginate, requireAdmin, type AdminClient } from './admin';

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
    const result = await paginate<{ id: number }>(client, 'users', 'id', { pageSize: 1000 });
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

  it('respects a custom pageSize', async () => {
    const { client, builder } = makeMockClient([[{ id: 1 }, { id: 2 }]]);
    await paginate<{ id: number }>(client, 'users', 'id', { pageSize: 50 });
    expect(builder.range).toHaveBeenCalledWith(0, 49);
  });

  it('throws when Supabase returns an error for a page', async () => {
    const error = new Error('database unavailable');
    const builder = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error }),
    };
    const client = { from: vi.fn().mockReturnValue(builder) } as unknown as AdminClient;

    await expect(paginate<{ id: number }>(client, 'users', 'id')).rejects.toThrow(
      'database unavailable',
    );
  });
});
