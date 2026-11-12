'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { PageError } from '@/components/ui';

/**
 * App-wide render-error boundary. Catches anything thrown while rendering a
 * page below the root layout, so one bad row (an unparseable stored timezone,
 * say) shows a recoverable message instead of a blank screen. Errors in the
 * root layout itself fall through to global-error.tsx.
 */
export default function Error({
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
    <PageError
      message="This page hit an unexpected error. Trying again usually fixes it; if it keeps happening, reload the page."
      onRetry={() => retry()}
    />
  );
}
