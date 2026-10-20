import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PostgrestError } from '@supabase/supabase-js';
import { fetchAllPages } from '@/lib/data/paginate';
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
 * The unique column each table is paged in. Offset pages are only consistent
 * under a total order — without one Postgres may hand back overlapping pages
 * that skip rows, and the cron would store the result as a daily stat. A
 * Record (not a lookup with a default) so adding a table forces a choice here.
 * The ordered column needn't appear in the selected columns.
 */
export const PAGINATION_ORDER_KEY: Record<TableName, string> = {
  users: 'id',
  games: 'id',
  game_memberships: 'id',
  availability: 'id',
  user_availability_defaults: 'id',
  sessions: 'id',
  game_play_dates: 'id',
  platform_daily_stats: 'day',
  deletion_log: 'id',
};

interface PaginateOptions {
  /** Optional column to filter on with a `gte` cutoff. */
  dateColumn?: string;
  /** Cutoff value (typically a date string) used with `dateColumn`. */
  cutoff?: string;
}

/**
 * Read every row of a table, paged under its unique order key (see
 * `fetchAllPages` for the page-size contract). Optionally filters by a date
 * column with a `gte` cutoff. Throws on any page's error.
 */
export async function paginate<T>(
  client: AdminClient,
  table: TableName,
  columns: string,
  opts: PaginateOptions = {}
): Promise<T[]> {
  const { data, error } = await fetchAllPages<T>((from, to) => {
    let query = client.from(table).select(columns);
    if (opts.dateColumn && opts.cutoff) {
      query = query.gte(opts.dateColumn, opts.cutoff);
    }
    return query
      .order(PAGINATION_ORDER_KEY[table], { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
  });
  if (error) throw error;
  return data ?? [];
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
