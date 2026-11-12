import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PostgrestError } from '@supabase/supabase-js';
import { fetchAllByKey, PAGE_SIZE, uuidSplitPoints } from '@/lib/data/paginate';
import type { Database } from '@/types/database';

export type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Verifies the request is from an authenticated admin user.
 * Returns either an admin client (on success) or a NextResponse (on failure).
 *
 * Usage:
 *   const result = await requireAdmin();
 *   if (result instanceof NextResponse) return result;
 *   const { admin } = result;
 */
export async function requireAdmin(): Promise<{ admin: AdminClient } | NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  return { admin };
}

type TableName = keyof Database['public']['Tables'] & string;

/**
 * The unique column each table is keyset-paged on, and its type (schema.sql).
 * Unique, because rows tied on a non-unique key that straddle a page boundary
 * would be skipped, and the cron would store the result as a daily stat. `uuid`
 * keys (random v4 ids, so evenly spread) are split into ranges read in
 * parallel; other keys are paged sequentially. A Record (not a lookup with a
 * default) so adding a table forces a choice here. The key needn't appear in
 * the selected columns.
 */
export const PAGINATION_KEY: Record<TableName, { column: string; type: 'uuid' | 'bigint' | 'date' }> = {
  users: { column: 'id', type: 'uuid' },
  games: { column: 'id', type: 'uuid' },
  game_memberships: { column: 'id', type: 'uuid' },
  availability: { column: 'id', type: 'uuid' },
  user_availability_defaults: { column: 'id', type: 'uuid' },
  sessions: { column: 'id', type: 'uuid' },
  game_play_dates: { column: 'id', type: 'uuid' },
  platform_daily_stats: { column: 'day', type: 'date' },
  deletion_log: { column: 'id', type: 'bigint' },
};

/** How many key ranges a large UUID-keyed table is read in at once. */
export const PAGINATION_FAN_OUT = 8;

/** The page key is selected under this alias, so it can be read back whatever
 *  `columns` the caller asked for, and removed before rows are returned. */
const PAGE_KEY_ALIAS = '_page_key';

interface PaginateOptions {
  /** Optional column to filter on with a `gte` cutoff. */
  dateColumn?: string;
  /** Cutoff value (typically a date string) used with `dateColumn`. */
  cutoff?: string;
}

/**
 * Read every row of a table, keyset-paged on its unique key (see
 * `fetchAllByKey` for the page-size contract and the parallel ranges).
 * Optionally filters by a date column with a `gte` cutoff. Throws on any page's
 * error.
 *
 * Rows have exactly the shape `columns` selects (any column list, `*` and
 * embedded joins included), in ascending key order.
 */
export async function paginate<T>(
  client: AdminClient,
  table: TableName,
  columns: string,
  opts: PaginateOptions = {}
): Promise<T[]> {
  const { column, type } = PAGINATION_KEY[table];
  type KeyedRow = Record<string, unknown>;
  const { data, error } = await fetchAllByKey<KeyedRow>(
    ({ after, from, before }) => {
      let query = client.from(table).select(`${PAGE_KEY_ALIAS}:${column}, ${columns}`);
      if (opts.dateColumn && opts.cutoff) query = query.gte(opts.dateColumn, opts.cutoff);
      if (after !== undefined) query = query.gt(column, after);
      if (from !== undefined) query = query.gte(column, from);
      if (before !== undefined) query = query.lt(column, before);
      return query
        .order(column, { ascending: true })
        .range(0, PAGE_SIZE - 1) as unknown as PromiseLike<{ data: KeyedRow[] | null; error: PostgrestError | null }>;
    },
    (row) => String(row[PAGE_KEY_ALIAS]),
    { splitPoints: type === 'uuid' ? uuidSplitPoints(PAGINATION_FAN_OUT) : undefined }
  );
  if (error) throw error;
  const rows = data ?? [];
  // In place: these are fresh objects, and a whole-table scan is too big to copy.
  for (const row of rows) delete row[PAGE_KEY_ALIAS];
  return rows as T[];
}

/**
 * Best-effort per-instance cache for expensive admin reads. In serverless it only
 * helps when an instance is reused across requests (Fluid Compute); cold starts
 * miss silently, which is fine.
 */
export function createTtlCache<T>(ttlMs: number) {
  const entries = new Map<string, { data: T; storedAt: number }>();
  return {
    get(key: string): T | undefined {
      const entry = entries.get(key);
      return entry && Date.now() - entry.storedAt < ttlMs ? entry.data : undefined;
    },
    set(key: string, data: T): void {
      entries.set(key, { data, storedAt: Date.now() });
    },
  };
}

/**
 * Like createTtlCache, but holds the in-flight promise: callers that ask while a
 * load is running share it instead of starting their own, and later callers
 * get the result until `ttlMs` after the load began. A load that rejects is
 * dropped as soon as it settles, so the next caller retries instead of being
 * handed the failure. A TTL of 0 keeps only the sharing of in-flight loads.
 */
export function createSharedLoadCache<T>(ttlMs: number) {
  const entries = new Map<string, { promise: Promise<T>; startedAt: number; settled: boolean }>();
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const entry = entries.get(key);
      if (entry && (!entry.settled || Date.now() - entry.startedAt < ttlMs)) return entry.promise;

      const created = { promise: (async () => load())(), startedAt: Date.now(), settled: false };
      entries.set(key, created);
      created.promise.then(
        () => {
          created.settled = true;
          if (ttlMs <= 0 && entries.get(key) === created) entries.delete(key);
        },
        () => {
          if (entries.get(key) === created) entries.delete(key);
        }
      );
      return created.promise;
    },
  };
}
