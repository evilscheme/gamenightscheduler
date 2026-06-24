'use client';

import Link from 'next/link';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { DefaultAvailabilityEditor } from '@/components/settings/DefaultAvailabilityEditor';

export default function DefaultAvailabilityPage() {
  useAuthRedirect();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Settings
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
