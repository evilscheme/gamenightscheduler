import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createSharedLoadCache,
  createTtlCache,
  paginate,
  PAGINATION_KEY,
  requireAdmin,
  type AdminClient,
} from './admin';
import { PAGE_SIZE } from '@/lib/data/paginate';
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

/** `count` v4-shaped UUIDs spread evenly over the key space. */
function uuids(count: number, tag = 0): string[] {
  return Array.from({ length: count }, (_, i) => {
    const prefix = Math.floor((i / count) * 0x1_0000_0000).toString(16).padStart(8, '0');
    return `${prefix}-0000-4000-8000-${tag.toString(16).padStart(4, '0')}${i.toString(16).padStart(8, '0')}`;
  });
}

type FakeBuilder = Record<'select' | 'gt' | 'gte' | 'lt' | 'order' | 'range', ReturnType<typeof vi.fn>>;

/** fakePostgrest, plus the builder each page request used. */
function fakeAdmin(tables: Record<string, Record<string, unknown>[]>) {
  const fake = fakePostgrest(tables);
  const builders = () => fake.from.mock.results.map((r) => r.value as FakeBuilder);
  return { client: fake as unknown as AdminClient, from: fake.from, builders };
}

describe('paginate', () => {
  it('reads a small table in one request', async () => {
    const rows = uuids(3).map((id) => ({ id, name: `u-${id}` }));
    const { client, from } = fakeAdmin({ users: rows });

    const result = await paginate<{ id: string; name: string }>(client, 'users', 'id, name');

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array for an empty table, in one request', async () => {
    const { client, from } = fakeAdmin({ users: [] });
    expect(await paginate(client, 'users', 'id')).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('selects the key under an alias and strips it, whatever the column list', async () => {
    const rows = uuids(2).map((id) => ({ id, name: 'Game', gm: { id: 'u', name: 'GM', email: 'e' } }));
    const { client, builders } = fakeAdmin({ games: rows });
    const columns = 'id, name, gm:users!games_gm_id_fkey(id, name, email)';

    const result = await paginate<Record<string, unknown>>(client, 'games', columns);

    expect(builders()[0].select).toHaveBeenCalledWith(`_page_key:id, ${columns}`);
    expect(result).toEqual(rows);
    for (const row of result) expect(row).not.toHaveProperty('_page_key');
  });

  it('strips the alias from a * select of a table keyed on another column', async () => {
    const rows = [{ day: '2026-01-01', total_users: 3 }];
    const { client, builders } = fakeAdmin({ platform_daily_stats: rows });

    const result = await paginate<Record<string, unknown>>(client, 'platform_daily_stats', '*');

    expect(builders()[0].select).toHaveBeenCalledWith('_page_key:day, *');
    expect(result).toEqual(rows);
  });

  it('reads a large UUID-keyed table in parallel ranges, every row exactly once, in key order', async () => {
    const ids = uuids(PAGE_SIZE * 9 + 17);
    const { client, from, builders } = fakeAdmin({ availability: ids.map((id) => ({ id, user_id: 'u' })) });

    const result = await paginate<{ id: string }>(client, 'availability', 'id, user_id');

    expect(result.map((r) => r.id)).toEqual([...ids].sort());
    // More requests than pages would need sequentially (one short page per
    // range), and later requests are bounded to a range.
    expect(from.mock.calls.length).toBeGreaterThan(10);
    expect(builders().some((b) => b.lt.mock.calls.length > 0)).toBe(true);
  });

  it('keeps the cutoff on every page alongside the key filters', async () => {
    const old = uuids(1500, 1).map((id) => ({ id, created_at: '2020-01-01' }));
    const recent = uuids(2200, 2).map((id) => ({ id, created_at: '2026-06-01' }));
    const { client, builders } = fakeAdmin({ users: [...old, ...recent] });

    const result = await paginate<{ id: string }>(client, 'users', 'id', {
      dateColumn: 'created_at',
      cutoff: '2026-01-01',
    });

    expect(result.map((r) => r.id).sort()).toEqual(recent.map((r) => r.id).sort());
    for (const b of builders()) expect(b.gte).toHaveBeenCalledWith('created_at', '2026-01-01');
  });

  it('does not call gte when cutoff is missing', async () => {
    const { client, builders } = fakeAdmin({ users: [{ id: uuids(1)[0] }] });
    await paginate(client, 'users', 'id', { dateColumn: 'created_at' });
    expect(builders()[0].gte).not.toHaveBeenCalled();
  });

  it('pages a non-UUID key sequentially, each page after the last', async () => {
    const days = Array.from({ length: PAGE_SIZE * 2 + 3 }, (_, i) => ({ day: `2020-${String(i).padStart(5, '0')}` }));
    const { client, builders } = fakeAdmin({ platform_daily_stats: days });

    const result = await paginate<{ day: string }>(client, 'platform_daily_stats', 'day');

    expect(result).toEqual(days);
    const pages = builders();
    expect(pages).toHaveLength(3);
    expect(pages[0].gt).not.toHaveBeenCalled();
    expect(pages[1].gt).toHaveBeenCalledWith('day', days[PAGE_SIZE - 1].day);
    expect(pages[2].gt).toHaveBeenCalledWith('day', days[PAGE_SIZE * 2 - 1].day);
    for (const b of pages) {
      expect(b.lt).not.toHaveBeenCalled();
      expect(b.order).toHaveBeenCalledWith('day', { ascending: true });
      expect(b.range).toHaveBeenCalledWith(0, PAGE_SIZE - 1);
    }
  });

  it('throws when a later page fails', async () => {
    const fake = fakePostgrest({ sessions: uuids(PAGE_SIZE * 3).map((id) => ({ id })) });
    const realFrom = fake.from.getMockImplementation()!;
    let requests = 0;
    fake.from.mockImplementation((table: string) => {
      const builder = realFrom(table);
      if (++requests === 3) {
        (builder.range as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: new Error('database unavailable') });
      }
      return builder;
    });

    await expect(paginate(fake as unknown as AdminClient, 'sessions', 'id')).rejects.toThrow('database unavailable');
  });

  it('throws when the first page fails', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error: new Error('database unavailable') }),
    };
    const client = { from: vi.fn().mockReturnValue(builder) } as unknown as AdminClient;

    await expect(paginate(client, 'users', 'id')).rejects.toThrow('database unavailable');
  });

  it("names every table's primary key and its type, as declared in schema.sql", () => {
    // A non-unique key would let tied rows straddle a page boundary; a key
    // wrongly marked uuid would be split on UUID ranges that don't fit it.
    const schema = readFileSync(join(process.cwd(), 'supabase/schema.sql'), 'utf8');
    for (const [table, { column, type }] of Object.entries(PAGINATION_KEY)) {
      const body = schema.match(new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\n\\);`))?.[1];
      expect(body, table).toBeDefined();
      const decl = body!.match(new RegExp(`^\\s*${column} (\\w+)[^\\n]*PRIMARY KEY`, 'm'));
      expect(decl?.[1].toLowerCase(), `${table}.${column}`).toBe(type);
    }
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

describe('createSharedLoadCache', () => {
  function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
    return { promise, resolve, reject };
  }

  it('shares one in-flight load between concurrent callers', async () => {
    const cache = createSharedLoadCache<string>(1000);
    const d = deferred<string>();
    const load = vi.fn(() => d.promise);

    const a = cache.get('k', load);
    const b = cache.get('k', load);
    d.resolve('v');

    expect(await a).toBe('v');
    expect(await b).toBe('v');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reuses a resolved load until the TTL has passed since it began', async () => {
    vi.useFakeTimers();
    try {
      const cache = createSharedLoadCache<number>(1000);
      let n = 0;
      const load = vi.fn(async () => ++n);

      expect(await cache.get('k', load)).toBe(1);
      vi.advanceTimersByTime(999);
      expect(await cache.get('k', load)).toBe(1);
      vi.advanceTimersByTime(1);
      expect(await cache.get('k', load)).toBe(2);
      expect(load).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps sharing a load that outlasts the TTL', async () => {
    vi.useFakeTimers();
    try {
      const cache = createSharedLoadCache<string>(1000);
      const d = deferred<string>();
      const load = vi.fn(() => d.promise);

      const a = cache.get('k', load);
      vi.advanceTimersByTime(5000);
      const b = cache.get('k', load);
      d.resolve('v');

      expect(await a).toBe('v');
      expect(await b).toBe('v');
      expect(load).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never caches a failed load', async () => {
    const cache = createSharedLoadCache<string>(60_000);
    const d = deferred<string>();
    const failing = vi.fn(() => d.promise);

    const a = cache.get('k', failing);
    const b = cache.get('k', failing); // joins the in-flight load
    d.reject(new Error('boom'));
    await expect(a).rejects.toThrow('boom');
    await expect(b).rejects.toThrow('boom');
    expect(failing).toHaveBeenCalledTimes(1);

    const retry = vi.fn(async () => 'ok');
    expect(await cache.get('k', retry)).toBe('ok');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('turns a synchronous throw into a rejection that is not cached', async () => {
    const cache = createSharedLoadCache<string>(60_000);
    await expect(
      cache.get('k', () => {
        throw new Error('sync');
      })
    ).rejects.toThrow('sync');
    expect(await cache.get('k', async () => 'ok')).toBe('ok');
  });

  it('with a TTL of 0, shares only while in flight', async () => {
    const cache = createSharedLoadCache<number>(0);
    let n = 0;
    const load = vi.fn(async () => ++n);

    const [a, b] = await Promise.all([cache.get('k', load), cache.get('k', load)]);
    expect([a, b]).toEqual([1, 1]);
    expect(await cache.get('k', load)).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps keys apart', async () => {
    const cache = createSharedLoadCache<string>(1000);
    expect(await cache.get('a', async () => 'A')).toBe('A');
    expect(await cache.get('b', async () => 'B')).toBe('B');
  });
});
