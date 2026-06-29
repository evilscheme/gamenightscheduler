'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal, Button, EyebrowLabel } from '@/components/ui';
import type { AvailabilityStatus } from '@/types';

interface CopyConflictModalProps {
  sourceGameName: string;
  conflictDates: string[];
  onConfirm: (status: AvailabilityStatus) => void;
  onCancel: () => void;
}

const OPTIONS: { value: AvailabilityStatus; label: string; swatch: string }[] = [
  { value: 'unavailable', label: 'Unavailable', swatch: 'bg-cal-unavailable-bg' },
  { value: 'maybe', label: 'Maybe', swatch: 'bg-cal-maybe-bg' },
  { value: 'available', label: 'Available', swatch: 'bg-cal-available-bg' },
];

export function CopyConflictModal({
  sourceGameName,
  conflictDates,
  onConfirm,
  onCancel,
}: CopyConflictModalProps) {
  const [status, setStatus] = useState<AvailabilityStatus>('unavailable');
  const n = conflictDates.length;

  return (
    <Modal
      open
      onClose={onCancel}
      eyebrow={<EyebrowLabel variant="muted">Copy from {sourceGameName}</EyebrowLabel>}
      title={`${n} scheduled session${n !== 1 ? 's' : ''} in this range`}
      data-testid="copy-conflict-modal"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(status)} data-testid="copy-conflict-confirm">
            Copy
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary">
          <strong>{sourceGameName}</strong> has {n} scheduled session{n !== 1 ? 's' : ''} in
          this date range — you&apos;re already scheduled to play those nights. How should they
          show up in this game?
        </div>

        <div className="flex flex-wrap gap-1.5" data-testid="copy-conflict-dates">
          {conflictDates.map((d) => (
            <span
              key={d}
              className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-xs text-foreground"
            >
              {format(parseISO(d), 'EEE MMM d')}
            </span>
          ))}
        </div>

        <fieldset>
          <legend className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Mark those nights as
          </legend>
          <div className="flex flex-col gap-2">
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                data-testid={`copy-conflict-status-${opt.value}`}
                aria-pressed={status === opt.value}
                className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                  status === opt.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:bg-secondary'
                }`}
              >
                <span
                  className={`size-4 flex-none rounded-full border-2 ${
                    status === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}
                />
                <span className={`size-3.5 flex-none rounded-sm ${opt.swatch}`} />
                <span className="font-medium text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <p className="text-xs text-muted-foreground">
          Your other availability from {sourceGameName} will still be copied to open dates.
        </p>
      </div>
    </Modal>
  );
}
