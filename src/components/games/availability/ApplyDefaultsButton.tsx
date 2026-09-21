'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { ApplyDefaultsResult } from '@/hooks/useAvailability';
import { ReplaceDefaultsModal } from './ReplaceDefaultsModal';

interface ApplyDefaultsButtonProps {
  /**
   * Applies the user's defaults. Called with no argument to fill blank dates
   * only; called with the dates a previous run reported as `mismatchedDates`
   * to also overwrite those, once the user has confirmed.
   */
  onApplyDefaults: (replaceDates?: string[]) => Promise<ApplyDefaultsResult>;
  /** Whether the user has any default availability saved. `null` while still loading. */
  hasDefaults: boolean | null;
}

export function ApplyDefaultsButton({ onApplyDefaults, hasDefaults }: ApplyDefaultsButtonProps) {
  const toast = useToast();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  // Dates the first pass refused to overwrite, plus how many blanks it did
  // fill — held so the confirmation dialog can report both without a toast
  // firing underneath it.
  const [pending, setPending] = useState<{ dates: string[]; filled: number } | null>(null);
  // Send the editor's back link here, so "← Back" returns to this game's
  // Availability tab (this button only renders on that tab).
  const editHref = `/settings/default-availability?returnTo=${encodeURIComponent(
    `${pathname}?tab=availability`,
  )}`;

  const handleClick = async () => {
    setBusy(true);
    try {
      const { hadDefaults, filled, mismatchedDates } = await onApplyDefaults();
      if (!hadDefaults) {
        toast.show('Set up your default availability first.');
        return;
      }
      // Dates that disagree with the (possibly just-edited) defaults are never
      // overwritten silently — ask, and report the fill count in the dialog.
      if (mismatchedDates.length > 0) {
        setPending({ dates: mismatchedDates, filled });
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

  const handleConfirmReplace = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const { replaced } = await onApplyDefaults(pending.dates);
      setPending(null);
      toast.show(`Replaced ${replaced} ${replaced === 1 ? 'date' : 'dates'}.`);
    } catch {
      toast.show('Could not apply your defaults. Please try again.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelReplace = () => {
    const filled = pending?.filled ?? 0;
    setPending(null);
    if (filled > 0) {
      toast.show(`Filled in ${filled} ${filled === 1 ? 'date' : 'dates'}.`);
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
        {busy && !pending ? 'Applying…' : 'Apply my default availability'}
      </Button>
      <Link
        href={editHref}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {hasDefaults === false ? 'Set up defaults' : 'Edit defaults'}
      </Link>

      {pending && (
        <ReplaceDefaultsModal
          mismatchedDates={pending.dates}
          filled={pending.filled}
          busy={busy}
          onConfirm={handleConfirmReplace}
          onCancel={handleCancelReplace}
        />
      )}
    </div>
  );
}
