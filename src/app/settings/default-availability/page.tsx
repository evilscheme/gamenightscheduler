'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { safeCallbackUrl } from '@/lib/url';
import { DefaultAvailabilityEditor } from '@/components/settings/DefaultAvailabilityEditor';

function DefaultAvailabilityContent() {
  useAuthRedirect();
  const searchParams = useSearchParams();
  // Return to wherever the user came from (e.g. a game's Availability tab),
  // falling back to Settings. safeCallbackUrl guards against open redirects.
  const backHref = safeCallbackUrl(searchParams.get('returnTo'), '/settings');
  const backLabel = backHref.startsWith('/games/') ? 'Back to game' : 'Back to Settings';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
          ← {backLabel}
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-foreground">Default availability</h1>
      <p className="mb-8 text-muted-foreground">
        Set your usual weekly availability. You can apply it to pre-fill any game&apos;s calendar
        from that game&apos;s <span className="font-medium text-foreground">Availability</span> tab.
        Applying never overwrites dates you&apos;ve already set.
      </p>

      <DefaultAvailabilityEditor />
    </div>
  );
}

export default function DefaultAvailabilityPage() {
  return (
    <Suspense>
      <DefaultAvailabilityContent />
    </Suspense>
  );
}
