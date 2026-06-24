'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { ApplyDefaultsResult } from '@/hooks/useAvailability';

interface ApplyDefaultsButtonProps {
  onApplyDefaults: () => Promise<ApplyDefaultsResult>;
}

export function ApplyDefaultsButton({ onApplyDefaults }: ApplyDefaultsButtonProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

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
    <div className="flex items-center gap-3">
      <Button size="sm" variant="secondary" onClick={handleClick} disabled={busy}>
        {busy ? 'Applying…' : 'Apply my default availability'}
      </Button>
      <Link
        href="/settings/default-availability"
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Edit defaults
      </Link>
    </div>
  );
}
