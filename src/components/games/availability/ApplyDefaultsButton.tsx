'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { ApplyDefaultsResult } from '@/hooks/useAvailability';

interface ApplyDefaultsButtonProps {
  onApplyDefaults: () => Promise<ApplyDefaultsResult>;
  /** Whether the user has any default availability saved. `null` while still loading. */
  hasDefaults: boolean | null;
}

export function ApplyDefaultsButton({ onApplyDefaults, hasDefaults }: ApplyDefaultsButtonProps) {
  const toast = useToast();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  // Send the editor's back link here, so "← Back" returns to this game's
  // Availability tab (this button only renders on that tab).
  const editHref = `/settings/default-availability?returnTo=${encodeURIComponent(
    `${pathname}?tab=availability`,
  )}`;

  const handleClick = async () => {
    setBusy(true);
    try {
      const { hadDefaults, filled } = await onApplyDefaults();
      if (!hadDefaults) {
        toast.show('Set up your default availability first.');
        return;
      }
      if (filled === 0) {
        toast.show('Your defaults are already applied — nothing to fill.');
        return;
      }
      toast.show(`Filled in ${filled} ${filled === 1 ? 'date' : 'dates'}.`);
    } catch {
      toast.show('Could not apply your defaults. Please try again.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="h-8"
        onClick={handleClick}
        disabled={busy || hasDefaults === false}
      >
        {busy ? 'Applying…' : 'Apply my default availability'}
      </Button>
      <Link
        href={editHref}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {hasDefaults === false ? 'Set up defaults' : 'Edit defaults'}
      </Link>
    </div>
  );
}
