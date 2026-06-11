'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Tabletop-themed messages indexed by d20 roll result (1-20).
// The tone tracks the roll: low rolls fail embarrassingly, mid rolls fail
// competently, high rolls almost succeed — but the page never exists.
const ROLL_MESSAGES: Record<number, string> = {
  1: 'Critical failure. Not only is the page missing, you dropped your torch, and something in the dark just noticed you.',
  2: 'You trip over your own boots and faceplant in the dungeon. The page was never even here.',
  3: 'The trail goes cold immediately, you will never find this page ever again',
  4: 'You search confidently in entirely the wrong direction.',
  5: 'A goblin watches you hunt for a page that doesn\'t exist. He says nothing.',
  6: 'You kick over some rubble. No page. Just rubble.',
  7: 'You found a page! No, wait — that\'s a mimic.',
  8: 'The map says the page should be right here. The map is wrong.',
  9: 'You ask around the tavern. Nobody\'s heard of this page, and one patron is pretty sure you made it up.',
  10: 'A perfectly average roll. The page remains perfectly missing.',
  11: 'Solid effort. The dungeon is unmoved.',
  12: 'You search the room thoroughly and find everything except the page.',
  13: 'Good instincts, wrong dungeon.',
  14: 'The page dodges. Nimble little thing.',
  15: 'A strong roll, but the page made its saving throw.',
  16: 'Impressive. If this page existed, you absolutely would have found it.',
  17: 'Your tracking is flawless. The trail simply ends at a cliff.',
  18: 'A heroic effort. The bards will sing of the page you almost found.',
  19: 'One short of glory. The page was here moments ago — you can still smell the ink.',
  20: 'Natural 20! Alas, even a critical success can\'t find a page that was never written. Take inspiration as consolation.',
};

const noopSubscribe = () => () => {};

// ?roll=N forces every roll while present (handy for trying the nat-20
// celebration, and for tests). Client-only: the die never renders during SSR.
function nextRoll(): number {
  if (typeof window !== 'undefined') {
    const forced = Number(
      new URLSearchParams(window.location.search).get('roll')
    );
    if (Number.isInteger(forced) && forced >= 1 && forced <= 20) {
      return forced;
    }
  }
  return Math.ceil(Math.random() * 20);
}

export function NotFoundContent() {
  // The die only renders client-side: rollResult is random, so anything
  // derived from it in SSR HTML would mismatch on hydration
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  const [rollResult, setRollResult] = useState(nextRoll);
  const [rollKey, setRollKey] = useState(0);
  const [showMessage, setShowMessage] = useState(false);

  const reroll = useCallback(() => {
    setShowMessage(false);
    setRollResult(nextRoll());
    setRollKey((k) => k + 1);
  }, []);

  const handleRollComplete = useCallback(() => {
    setShowMessage(true);
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      {/* w-full: a definite width so the roll canvas (width:100%) doesn't
          collapse to its intrinsic size while the message text is hidden */}
      <div className="w-full max-w-md text-center">
        <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-8">Page not found</p>

        {/* aspect-16/10 reserves the canvas's space before the client roll starts */}
        <div className="w-full aspect-16/10 mb-6">
          {isClient && (
            <LoadingSpinner
              key={rollKey}
              rollResult={rollResult}
              onRollComplete={handleRollComplete}
            />
          )}
        </div>

        <div className="min-h-16 mb-8">
          {showMessage && (
            <p className="text-muted-foreground animate-in fade-in duration-500">
              <span className="font-semibold text-foreground">
                You rolled a {rollResult}!
              </span>{' '}
              {ROLL_MESSAGES[rollResult]}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go Home
          </Link>
          <button
            onClick={reroll}
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent transition-colors"
          >
            Roll Again
          </button>
        </div>
      </div>
    </div>
  );
}
