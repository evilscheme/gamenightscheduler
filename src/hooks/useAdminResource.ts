import { useCallback, useEffect, useState } from 'react';

export interface UseAdminResourceResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch/loading/error triad shared by the admin dashboard's self-fetching
 * tabs (e.g. "Upcoming Games"). Deliberately not React Query: these are
 * simple, single-shot admin GETs with no cross-tab cache sharing, so a
 * lightweight `useEffect` + cancellation flag is enough.
 *
 * Pass `enabled: false` to defer the fetch (e.g. until an auth check
 * resolves) — while disabled, `loading` stays `true` and nothing fetches.
 */
export function useAdminResource<T>(url: string, enabled = true): UseAdminResourceResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ${url}`);
        const json = (await res.json()) as T;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [url, enabled, reloadToken]);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  return { data, loading, error, refetch };
}
