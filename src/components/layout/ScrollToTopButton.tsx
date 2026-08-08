'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * Two full screens. The game page's ranked list starts roughly 1200-1400px down
 * on a phone, so the button first appears just as you enter the list — the point
 * where the trip back becomes annoying. Showing it early costs a small icon in a
 * corner; showing it late means the user has already started flinging and never
 * learns it exists.
 */
const VIEWPORTS_BEFORE_SHOWING = 2;

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // innerHeight is read on every update rather than captured once, so
    // orientation changes and window resizes need no separate listener.
    let ticking = false;
    let frame = 0;

    const update = () => {
      ticking = false;
      setVisible(window.scrollY > VIEWPORTS_BEFORE_SHOWING * window.innerHeight);
    };

    // scroll fires far more often than we need to re-render, so coalesce to one
    // update per frame. The guard is a separate boolean, not the frame handle:
    // when requestAnimationFrame runs synchronously, update() would clear the
    // handle before the assignment overwrote it, wedging the guard forever.
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!visible) return null;

  const handleClick = () => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Back to top"
      data-testid="scroll-to-top"
      className="fixed bottom-6 right-4 z-40 inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </button>
  );
}
