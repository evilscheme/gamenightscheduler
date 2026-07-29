'use client';

import { useSyncExternalStore } from 'react';

// The store never changes, so subscribing is a no-op.
const noopSubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` during SSR and the hydrating render, `true` afterwards.
 *
 * Use this to gate anything that must not run on the server (portals into
 * `document.body`, reading `window`) without the usual
 * `useState(false)` + `useEffect(() => setMounted(true))` pair, which sets
 * state in an effect and costs an extra render.
 *
 * Because React re-renders once when `getSnapshot()` disagrees with
 * `getServerSnapshot()` after hydration, this has the same semantics as the
 * effect version — but on a client-side navigation the component is mounting
 * into an already-hydrated tree, so it returns `true` on the very first
 * render and skips the placeholder flash.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, getSnapshot, getServerSnapshot);
}
