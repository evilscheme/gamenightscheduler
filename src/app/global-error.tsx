'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { PageError } from '@/components/ui';
import './globals.css';

/**
 * Last-resort boundary for errors thrown by the root layout itself (providers,
 * navbar), which error.tsx cannot catch. It replaces the root layout while
 * active, so it renders its own <html>/<body> and pulls in the global styles
 * for the semantic tokens. The saved color theme isn't re-applied here; the
 * default theme follows the OS color scheme.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground">
        <title>Something went wrong | Can We Play?</title>
        <PageError
          message="The app hit an unexpected error. Trying again usually fixes it; if it keeps happening, reload the page."
          onRetry={() => retry()}
        />
      </body>
    </html>
  );
}
