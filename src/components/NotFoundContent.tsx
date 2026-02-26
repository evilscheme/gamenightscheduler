'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Tabletop-themed messages indexed by d20 roll result (1-20)
const ROLL_MESSAGES: Record<number, string> = {
  1: 'Critical fail! You wandered into a page that doesn\'t exist.',
  2: 'You rolled poorly. This page has been banished to another dimension.',
  3: 'The dungeon master says this page was never written.',
  4: 'Your navigation check failed. This isn\'t the page you\'re looking for.',
  5: 'The page you seek has been claimed by a mimic.',
  6: 'You fell into a pit trap. There\'s no page down here.',
  7: 'A wandering monster ate this page before you got here.',
  8: 'Your torch went out. You can\'t find this page in the dark.',
  9: 'The tavern keeper has no knowledge of this page.',
  10: 'You reached a dead end in the dungeon. Turn back.',
  11: 'Not bad, but this page still doesn\'t exist.',
  12: 'Decent roll, but this page is in another castle.',
  13: 'Unlucky thirteen. This page has been cursed.',
  14: 'Close, but the page dodged your attempt to find it.',
  15: 'Solid roll! Too bad the page made its saving throw.',
  16: 'Good effort, but this page has resistance to being found.',
  17: 'Almost heroic, yet the page remains elusive.',
  18: 'Impressive roll! But even heroes can\'t find pages that don\'t exist.',
  19: 'So close to a crit! The page was here but just teleported away.',
  20: 'Natural 20! ...but even a crit can\'t conjure a page from nothing.',
};

export function NotFoundContent() {
  const [rollResult, setRollResult] = useState(
    () => Math.ceil(Math.random() * 20)
  );
  const [rollKey, setRollKey] = useState(0);
  const [showMessage, setShowMessage] = useState(false);

  const reroll = useCallback(() => {
    setShowMessage(false);
    setRollResult(Math.ceil(Math.random() * 20));
    setRollKey((k) => k + 1);
  }, []);

  const handleRollComplete = useCallback(() => {
    setShowMessage(true);
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-8">Page not found</p>

        {/* suppressHydrationWarning: random rollResult differs between SSR and client */}
        <div className="flex justify-center mb-6" suppressHydrationWarning>
          <LoadingSpinner
            key={rollKey}
            size="xl"
            rollResult={rollResult}
            onRollComplete={handleRollComplete}
          />
        </div>

        <div className="min-h-16 mb-8" suppressHydrationWarning>
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
