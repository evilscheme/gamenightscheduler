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
    // innerHeight is read live inside update() rather than captured once, but
    // that only matters on a resize if update() actually runs — and update()
    // only runs off a scroll event. So orientation changes and window resizes
    // are handled explicitly below, by listening for 'resize' too.
    let ticking = false;
    let frame = 0;

    const update = () => {
      ticking = false;
      setVisible(window.scrollY > VIEWPORTS_BEFORE_SHOWING * window.innerHeight);
    };

    // scroll (and resize) fire far more often than we need to re-render, so
    // coalesce to one update per frame. The guard is a separate boolean, not
    // the frame handle: when requestAnimationFrame runs synchronously,
    // update() would clear the handle before the assignment overwrote it,
    // wedging the guard forever.
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const handleClick = () => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    // Always mounted so the show/hide can be a transition rather than a mount.
    // `invisible` matters as much as `opacity-0`: opacity alone still counts as
    // visible to Playwright (and to the tab order), so visibility is what
    // actually takes the button out of play once it has faded.
    //
    // Inverted fill, deliberately: `bg-card`/`border-border` is the exact pair
    // Panel and RankedRow use, so a card-coloured button is invisible against
    // the surface it most often floats over. Any `*-foreground` token is by
    // definition picked to be legible against the surfaces, so it cannot
    // collide with one in any theme. muted-foreground rather than foreground
    // because foreground is the palette's extreme — near-white in dark mode,
    // which reads as untinted; muted-foreground is the same idea a step in,
    // carrying the theme's hue (sky, violet, green, slate, rose) instead.
    <button
      type="button"
      onClick={handleClick}
      aria-label="Back to top"
      aria-hidden={!visible}
      tabIndex={visible ? undefined : -1}
      data-testid="scroll-to-top"
      className={`fixed bottom-6 right-4 z-40 inline-flex size-11 items-center justify-center rounded-full bg-muted-foreground text-background shadow-lg motion-safe:transition-[opacity,visibility] motion-safe:duration-300 hover:bg-muted-foreground/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${
        visible ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'
      }`}
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </button>
  );
}
