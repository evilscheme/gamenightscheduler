import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Supabase/PostgREST silently caps every `.select()` at `max_rows` (1000 in
 * this project — see supabase/config.toml). A query with no `.range()` returns
 * only the first page and drops the rest with NO error, which quietly loses
 * data once a table exceeds the cap for a given filter.
 *
 * Two pagers read every matching row, both ending on the first short page:
 *  - `fetchAllPages` pages by offset (`.range(from, to)`). It works under any
 *    stable, total ordering, composite ones included, but every page re-walks
 *    the rows before its offset, so a whole-table scan costs O(n²).
 *  - `fetchAllByKey` pages by keyset (`key > last`) on one unique column. Each
 *    page is an index seek, and the key space can be split into ranges that are
 *    read concurrently. Use it for whole-table scans.
 *
 * Page-size contract: a short page is read as end-of-data, which is only true
 * while PAGE_SIZE <= the server's `max_rows`. A lower cap would return short
 * pages that look final and end the scan early, with no error. paginate.test.ts
 * pins PAGE_SIZE to config.toml; a hosted project's API setting must not go
 * below it either (and `max_rows` can't be raised past it to save requests:
 * PAGE_SIZE is what is asked for). This is the only page size in the app — don't
 * add another.
 */
export const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: PostgrestError | null };

/**
 * Offset pager. `buildPage(from, to)` MUST apply a stable, total ordering (e.g.
 * `.order('date').order('id')`) so pages don't skip or duplicate rows. Ordering
 * makes pages consistent, not a snapshot: a row inserted mid-scan can still
 * shift later offsets.
 */
export async function fetchAllPages<T>(
  buildPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<PageResult<T>> {
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

/**
 * Bounds on the key for one keyset page; every bound that is set applies (AND).
 * Values are passed to PostgREST as strings and compared by Postgres in the
 * column's own type.
 */
export interface KeyBounds {
  /** key > after */
  after?: string;
  /** key >= from */
  from?: string;
  /** key < before */
  before?: string;
}

/**
 * Keyset pager. `buildPage(bounds)` MUST filter on the bounds it is given,
 * order by the key ascending, and ask for PAGE_SIZE rows; `keyOf` reads the key
 * back from a row. The key must be unique, or rows tied on it straddling a page
 * boundary would be skipped.
 *
 * The first page is read on its own, so a table that fits in one page costs one
 * request. If it comes back full and `splitPoints` are given, the rest of the
 * key space is split at those points into contiguous ranges — [−∞, p₀),
 * [p₀, p₁), …, [pₙ, +∞) — and every range not already covered by the first
 * page is keyset-paged concurrently, each starting after the first page's last
 * key. Ranges partition the key space and each starts strictly after what was
 * already read, so every row is read exactly once.
 *
 * Rows come back in ascending key order: the first page, then each range in
 * key order. `splitPoints` must be ascending, and comparable with the key as
 * JS strings (true of lowercase hex UUIDs, which is how Postgres prints them).
 *
 * Any page's error fails the whole read (no partial result); the other ranges
 * stop at their next page.
 */
export async function fetchAllByKey<T>(
  buildPage: (bounds: KeyBounds) => PromiseLike<PageResult<T>>,
  keyOf: (row: T) => string,
  opts: { splitPoints?: readonly string[] } = {}
): Promise<PageResult<T>> {
  const first = await buildPage({});
  if (first.error) return { data: null, error: first.error };
  const firstRows = first.data ?? [];
  if (firstRows.length < PAGE_SIZE) return { data: firstRows, error: null };

  const last = keyOf(firstRows[firstRows.length - 1]);
  const points = opts.splitPoints ?? [];
  const ranges = [undefined, ...points]
    .map((from, i) => ({ from, before: points[i] as string | undefined }))
    // Everything below `last` was on the first page.
    .filter((r) => r.before === undefined || r.before > last);

  const failure: { error: PostgrestError | null } = { error: null };
  const readRange = async ({ from, before }: { from?: string; before?: string }): Promise<T[]> => {
    const rows: T[] = [];
    let after = last;
    // `after` already implies `from` in the range that holds `last`.
    const lower = from !== undefined && from > last ? from : undefined;
    for (;;) {
      if (failure.error) return rows;
      const { data, error } = await buildPage({ after, from: lower, before });
      if (error) {
        failure.error ??= error;
        return rows;
      }
      const page = data ?? [];
      for (const row of page) rows.push(row);
      if (page.length < PAGE_SIZE) return rows;
      after = keyOf(page[page.length - 1]);
    }
  };

  const parts = await Promise.all(ranges.map(readRange));
  if (failure.error) return { data: null, error: failure.error };
  return { data: firstRows.concat(...parts), error: null };
}

/**
 * `count - 1` ascending UUIDs that split the UUID space into `count` equal
 * ranges by their leading 32 bits. Random (v4) ids spread evenly across them.
 */
export function uuidSplitPoints(count: number): string[] {
  return Array.from({ length: count - 1 }, (_, i) => {
    const prefix = Math.floor(((i + 1) * 0x1_0000_0000) / count).toString(16).padStart(8, '0');
    return `${prefix}-0000-0000-0000-000000000000`;
  });
}
