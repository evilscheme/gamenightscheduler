'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * SSR-safe localStorage-backed React state.
 *
 * Returns `defaultValue` on first render so the server and the initial client
 * render match. After mount, hydrates from `localStorage[key]` if the stored
 * value passes `isValid`. The setter updates both state and storage.
 *
 * Storage format: strings are stored raw (no JSON quoting); all other values
 * are JSON-encoded. On read, JSON.parse is attempted first and falls back to
 * the raw string if parsing fails. This makes the hook safely retrofittable
 * over legacy localStorage code that stored bare strings, and keeps the
 * stored format human-readable for the common case.
 */
export function useLocalStoragePref<T>(
  key: string,
  defaultValue: T,
  isValid: (v: unknown) => v is T
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Not JSON — treat as a bare string value (legacy or hook-written string).
        parsed = raw;
      }
      if (isValid(parsed)) {
        setValue(parsed);
      }
    } catch {
      // Ignore: localStorage may be unavailable.
    }
    // We intentionally read storage once on mount and don't track key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPersisted = useCallback(
    (next: T) => {
      setValue(next);
      try {
        const encoded = typeof next === 'string' ? next : JSON.stringify(next);
        window.localStorage.setItem(key, encoded);
      } catch {
        // Ignore write failures (private browsing, quota, etc.).
      }
    },
    [key]
  );

  return [value, setPersisted];
}
