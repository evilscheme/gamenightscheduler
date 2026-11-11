/**
 * Unwrap a Supabase `{ data, error }` list result for use inside a TanStack
 * Query `queryFn`.
 *
 * A queryFn must THROW on error. Returning `data ?? []` instead caches an
 * empty list as a successful read, and every mutation that decides what to
 * write from that cache ("fill the blanks", "is there already a session on
 * this date?") then acts on data that was never loaded.
 */
export function unwrapList<T>(result: {
  data: T[] | null;
  error: { message?: string } | null;
}): T[] {
  if (result.error) {
    throw new Error(result.error.message || 'Request failed');
  }
  return result.data ?? [];
}

/**
 * Guard for mutations that decide what to write from a cached list.
 *
 * A query that failed with nothing cached falls back to an EMPTY_* array in
 * its hook, which is indistinguishable from "the user has no rows"; a write
 * planned from it overwrites real data. Throws unless every source has real
 * data (`query.data !== undefined`). Callers report it like any other
 * mutation failure.
 */
export function requireLoaded(sources: { name: string; loaded: boolean }[]): void {
  const missing = sources.filter((s) => !s.loaded).map((s) => s.name);
  if (missing.length > 0) {
    throw new Error(
      `Your ${missing.join(' and ')} could not be loaded, so nothing was changed. Reload and try again.`,
    );
  }
}
