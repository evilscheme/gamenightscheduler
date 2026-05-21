'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * SSR-safe localStorage-backed React state.
 *
 * Returns `defaultValue` on first render so the server and the initial client
 * render match. After mount, hydrates from `localStorage[key]` if the stored
 * value passes `isValid`. The setter updates both state and storage.
 */
export function useLocalStoragePref<T>(
  key: string,
  defaultValue: T,
  isValid: (v: unknown) => v is T
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return;
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) {
        setValue(parsed);
      }
    } catch {
      // Ignore: localStorage may be unavailable or contain invalid JSON.
    }
    // We intentionally read storage once on mount and don't track key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setPersisted = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Ignore write failures (private browsing, quota, etc.).
      }
    },
    [key]
  );

  return [value, setPersisted];
}
