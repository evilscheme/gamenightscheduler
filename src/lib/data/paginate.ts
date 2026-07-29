import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Supabase/PostgREST silently caps every `.select()` at `max_rows` (1000 in
 * this project — see supabase/config.toml). A query with no `.range()` returns
 * only the first page and drops the rest with NO error, which quietly loses
 * data once a table exceeds the cap for a given filter.
 *
 * `fetchAllPages` reads every matching row by paging through `.range()` until a
 * short page arrives. `buildPage(from, to)` MUST apply a stable, total ordering
 * (e.g. `.order('date').order('id')`) so pages don't skip or duplicate rows.
 */
export const PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  buildPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  const all: T[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await buildPage(offset, offset + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    if (data && data.length > 0) all.push(...data);
    // A short (or empty) page means we've read the last one.
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { data: all, error: null };
}
