'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal, Button, Input, EyebrowLabel } from '@/components/ui';
import type { DateSuggestion } from '@/types';
import { computeDefaultSessionTimes } from '@/lib/scheduleView';
import { SESSION_DEFAULTS } from '@/lib/constants';

interface ScheduleSessionModalProps {
  open: boolean;
  date: string | null;
  suggestion: DateSuggestion | undefined;
  gameDefaultStart: string | null | undefined;
  gameDefaultEnd: string | null | undefined;
  onClose: () => void;
  onConfirm: (date: string, start: string, end: string) => Promise<{ success: boolean; error?: string }>;
}

export function ScheduleSessionModal({
  open, date, suggestion, gameDefaultStart, gameDefaultEnd, onClose, onConfirm,
}: ScheduleSessionModalProps) {
  const [start, setStart] = useState<string>(SESSION_DEFAULTS.START_TIME);
  const [end, setEnd] = useState<string>(SESSION_DEFAULTS.END_TIME);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || !date) return;
    const defaults = computeDefaultSessionTimes({
      earliestStartTime: suggestion?.earliestStartTime ?? null,
      latestEndTime: suggestion?.latestEndTime ?? null,
      gameDefaultStart: gameDefaultStart?.slice(0, 5) || SESSION_DEFAULTS.START_TIME,
      gameDefaultEnd: gameDefaultEnd?.slice(0, 5) || SESSION_DEFAULTS.END_TIME,
    });
    setStart(defaults.start);
    setEnd(defaults.end);
    setError(null);
  }, [open, date, suggestion, gameDefaultStart, gameDefaultEnd]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!date) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await onConfirm(date, start, end);
    setBusy(false);
    if (!res.success) {
      setError(res.error ?? 'Failed to schedule session');
      return;
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={<EyebrowLabel>Schedule session</EyebrowLabel>}
      title={format(parseISO(date), 'EEEE, MMMM d, yyyy')}
      data-testid="schedule-session-modal"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={busy}
            title="Close this dialog without scheduling"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            data-testid="confirm-session-submit"
            title="Schedule a session on this date"
          >
            {busy ? 'Confirming…' : '★ Confirm session'}
          </Button>
        </>
      }
    >
      <div>
        <label htmlFor="sch-start" className="mb-1 block text-sm font-medium text-card-foreground">Start time</label>
        <Input id="sch-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
      </div>
      <div>
        <label htmlFor="sch-end" className="mb-1 block text-sm font-medium text-card-foreground">End time</label>
        <Input id="sch-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
