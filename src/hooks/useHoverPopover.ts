'use client';

import { useLayoutEffect, useState, useSyncExternalStore } from 'react';

export interface HoverPopoverCoords {
  x: number;
  y: number;
  /** True when the cell sits too near the viewport top to place the popover above it. */
  placeBelow: boolean;
}

// Lazily created so it's only constructed in browser environments (and once
// per module load, not per component instance).
let hoverCapableMql: MediaQueryList | null | undefined;

function getHoverCapableMql(): MediaQueryList | null {
  if (hoverCapableMql === undefined) {
    hoverCapableMql =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(hover: hover) and (pointer: fine)')
        : null;
  }
  return hoverCapableMql;
}

function subscribeHoverCapable(onChange: () => void): () => void {
  const mql = getHoverCapableMql();
  if (!mql) return () => {};
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getHoverCapableSnapshot(): boolean {
  return getHoverCapableMql()?.matches ?? false;
}

function getHoverCapableServerSnapshot(): boolean {
  return false;
}

const DEFAULT_HEIGHT_HINT = 140;
const defaultSelector = (date: string) => `[data-date="${date}"]`;

/**
 * Anchors a hover popover to a calendar cell.
 *
 * Returns `hoverCapable: false` on touch devices, where a hover popover has no
 * dismissal gesture and would sit stuck under a thumb.
 */
export function useHoverPopover(
  activeDate: string | null,
  opts: { heightHint?: number; selector?: (date: string) => string } = {},
): { coords: HoverPopoverCoords | null; hoverCapable: boolean } {
  const { heightHint = DEFAULT_HEIGHT_HINT, selector = defaultSelector } = opts;
  const hoverCapable = useSyncExternalStore(
    subscribeHoverCapable,
    getHoverCapableSnapshot,
    getHoverCapableServerSnapshot,
  );
  const [coords, setCoords] = useState<HoverPopoverCoords | null>(null);

  // A selector passed inline gets a fresh identity every render, so depending
  // on the function itself would re-fire this effect forever (it setStates a
  // new object each run). The resolved string is a primitive and compares by
  // value, so the effect settles after one pass.
  const query = activeDate ? selector(activeDate) : null;

  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (!activeDate || !query) {
      setCoords(null);
      return;
    }
    // Responsive layouts render the same date more than once (a mobile
    // <details> block and a desktop <aside>, say), so several nodes can share
    // one data-date. Take the first that's actually laid out.
    const candidates = document.querySelectorAll<HTMLElement>(query);
    const el = Array.from(candidates).find((node) => node.offsetParent !== null);
    if (!el) {
      setCoords(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const placeBelow = rect.top < heightHint;
    setCoords({
      x: rect.left + rect.width / 2,
      y: placeBelow ? rect.bottom + 6 : rect.top - 6,
      placeBelow,
    });
  }, [activeDate, query, heightHint]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { coords, hoverCapable };
}
