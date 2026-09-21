'use client';

import { format, parseISO } from 'date-fns';
import { Modal, Button, EyebrowLabel } from '@/components/ui';

interface ReplaceDefaultsModalProps {
  /** Eligible dates already answered with something other than the user's defaults. */
  mismatchedDates: string[];
  /** Blank dates the apply just filled, reported here so there's no competing toast. */
  filled: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReplaceDefaultsModal({
  mismatchedDates,
  filled,
  busy,
  onConfirm,
  onCancel,
}: ReplaceDefaultsModalProps) {
  const n = mismatchedDates.length;

  return (
    <Modal
      open
      onClose={onCancel}
      eyebrow={<EyebrowLabel variant="muted">Your defaults</EyebrowLabel>}
      title={
        n === 1
          ? "1 date doesn't match your defaults"
          : `${n} dates don't match your defaults`
      }
      data-testid="replace-defaults-modal"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Keep them
          </Button>
          <Button onClick={onConfirm} disabled={busy} data-testid="replace-defaults-confirm">
            {busy ? 'Replacing…' : `Replace ${n} date${n !== 1 ? 's' : ''}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {filled > 0 && (
          <p className="text-muted-foreground" data-testid="replace-defaults-filled">
            Filled in {filled} blank {filled === 1 ? 'date' : 'dates'}.
          </p>
        )}

        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary">
          {n === 1 ? 'This date is' : 'These dates are'} already marked differently from your
          saved defaults. Replacing {n === 1 ? 'it' : 'them'} overwrites what you have now.
        </div>

        <div className="flex flex-wrap gap-1.5" data-testid="replace-defaults-dates">
          {mismatchedDates.map((d) => (
            <span
              key={d}
              className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-xs text-foreground"
            >
              {format(parseISO(d), 'EEE MMM d')}
            </span>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Keeping them leaves every date exactly as it is — you can still change any of them on
          the calendar.
        </p>
      </div>
    </Modal>
  );
}
