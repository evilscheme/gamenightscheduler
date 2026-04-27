'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal, Button, EyebrowLabel } from '@/components/ui';

interface CancelSessionModalProps {
  open: boolean;
  date: string | null;
  onClose: () => void;
  onConfirm: (date: string) => Promise<{ success: boolean; error?: string }>;
}

export function CancelSessionModal({ open, date, onClose, onConfirm }: CancelSessionModalProps) {
  const [busy, setBusy] = useState(false);
  if (!date) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await onConfirm(date);
      if (res.success) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={<EyebrowLabel variant="danger">Cancel session</EyebrowLabel>}
      title={format(parseISO(date), 'EEEE, MMMM d, yyyy')}
      data-testid="cancel-session-modal"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={busy}
            title="Keep this scheduled session and close the dialog"
          >
            Keep session
          </Button>
          <Button
            variant="danger"
            onClick={submit}
            disabled={busy}
            data-testid="cancel-session-submit"
            title="Cancel this scheduled session"
          >
            {busy ? 'Cancelling…' : 'Cancel session'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        This session will be removed from the schedule. You can re-schedule this date again later.
      </p>
    </Modal>
  );
}
