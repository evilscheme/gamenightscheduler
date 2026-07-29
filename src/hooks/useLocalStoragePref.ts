'use client';

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';

/**
 * The native `storage` event only fires in *other* tabs, so same-tab writes
 * would go unnoticed. Each key therefore keeps its own subscriber set, which
 * `setPersisted` notifies directly.
 */
const localListeners = new Map<string, Set<() => void>>();

/**
 * Values whose `localStorage` write failed (private browsing, quota). Reads
 * prefer this layer so the UI still reflects the user's choice for the
 * lifetime of the page, matching the behaviour of a plain `useState`.
 */
const memoryFallback = new Map<string, string>();

function subscribeToKey(key: string, onChange: () => void): () => void {
  let subs = localListeners.get(key);
  if (!subs) {
    subs = new Set();
    localListeners.set(key, subs);
  }
  subs.add(onChange);

  // `e.key === null` means the whole store was cleared.
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) onChange();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    subs.delete(onChange);
    if (subs.size === 0) localListeners.delete(key);
    window.removeEventListener('storage', onStorage);
  };
}

function readRaw(key: string): string | null {
  const pending = memoryFallback.get(key);
  if (pending !== undefined) return pending;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage unavailable — fall back to the default.
    return null;
  }
}

/**
 * SSR-safe localStorage-backed React state.
 *
 * Backed by `useSyncExternalStore`: the server (and the hydrating client
 * render) sees `defaultValue`, so markup always matches; React then re-reads
 * from storage once hydration completes. Because storage is modelled as a
 * proper external store, changes made in another tab propagate here too.
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
  // Frozen on first render. A `defaultValue` whose identity changed between
  // renders would make getSnapshot return a fresh reference each call, which
  // useSyncExternalStore treats as a never-settling store.
  const [initialDefault] = useState(defaultValue);

  // getSnapshot must be referentially stable while the raw string is
  // unchanged, so the last parse is memoized.
  const cacheRef = useRef<{ key: string; raw: string; value: T } | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => subscribeToKey(key, onChange),
    [key]
  );

  const getSnapshot = useCallback((): T => {
    const raw = readRaw(key);
    if (raw === null) return initialDefault;

    const cached = cacheRef.current;
    if (cached && cached.key === key && cached.raw === raw) return cached.value;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Not JSON — treat as a bare string value (legacy or hook-written string).
      parsed = raw;
    }
    const value = isValid(parsed) ? parsed : initialDefault;
    cacheRef.current = { key, raw, value };
    return value;
  }, [key, initialDefault, isValid]);

  const getServerSnapshot = useCallback(() => initialDefault, [initialDefault]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setPersisted = useCallback((next: T) => {
    const encoded = typeof next === 'string' ? next : JSON.stringify(next);
    try {
      window.localStorage.setItem(key, encoded);
      memoryFallback.delete(key);
    } catch {
      // Write failed — keep the value in memory so the UI still updates.
      memoryFallback.set(key, encoded);
    }
    const subs = localListeners.get(key);
    if (subs) for (const cb of subs) cb();
  }, [key]);

  return [value, setPersisted];
}
