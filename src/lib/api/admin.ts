import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

const DEFAULT_PAGE_SIZE = 1000;

interface PaginateOptions {
  pageSize?: number;
  /** Optional column to filter on with a `gte` cutoff. */
  dateColumn?: string;
  /** Cutoff value (typically a date string) used with `dateColumn`. */
  cutoff?: string;
}

/**
 * Paginate through all rows of a table, working around Supabase's default
 * 1000-row limit. Optionally filters by a date column with a `gte` cutoff.
 */
export async function paginate<T>(
  client: AdminClient,
  table: string,
  columns: string,
  opts: PaginateOptions = {}
): Promise<T[]> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const all: T[] = [];
  let offset = 0;

  for (;;) {
    let query = client.from(table).select(columns);
    if (opts.dateColumn && opts.cutoff) {
      query = query.gte(opts.dateColumn, opts.cutoff);
    }
    const { data } = await query.range(offset, offset + pageSize - 1);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}
