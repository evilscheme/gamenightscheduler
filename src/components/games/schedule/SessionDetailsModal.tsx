'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal, Button, Input, Textarea, EyebrowLabel } from '@/components/ui';
import type { DateSuggestion, GameSession } from '@/types';
import { computeDefaultSessionTimes } from '@/lib/scheduleView';
import { SESSION_DEFAULTS, TEXT_LIMITS } from '@/lib/constants';

export type SessionDetailsMode = 'schedule' | 'edit';

interface SessionDetailsModalProps {
  open: boolean;
  date: string | null;
  mode: SessionDetailsMode;
  // schedule-mode inputs:
  suggestion?: DateSuggestion;
  gameDefaultStart?: string | null;
  gameDefaultEnd?: string | null;
  // edit-mode input:
  session?: GameSession;
  onClose: () => void;
  onSubmit: (values: {
    start: string;
    end: string;
    location: string | null;
    notes: string | null;
  }) => Promise<{ success: boolean; error?: string }>;
}

const LOCATION_MAX = TEXT_LIMITS.SESSION_LOCATION;
const NOTES_MAX = TEXT_LIMITS.SESSION_NOTES;
const LOCATION_WARN = 150;
const NOTES_WARN = 400;

function normalize(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function SessionDetailsModal({
  open, date, mode, suggestion, gameDefaultStart, gameDefaultEnd, session, onClose, onSubmit,
}: SessionDetailsModalProps) {
  const [start, setStart] = useState<string>(SESSION_DEFAULTS.START_TIME);
  const [end, setEnd] = useState<string>(SESSION_DEFAULTS.END_TIME);
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute initial values whenever the modal opens or its key inputs change.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || !date) return;
    if (mode === 'edit' && session) {
      setStart((session.start_time ?? SESSION_DEFAULTS.START_TIME).slice(0, 5));
      setEnd((session.end_time ?? SESSION_DEFAULTS.END_TIME).slice(0, 5));
      setLocation(session.location ?? '');
      setNotes(session.notes ?? '');
    } else {
      const defaults = computeDefaultSessionTimes({
        earliestStartTime: suggestion?.earliestStartTime ?? null,
        latestEndTime: suggestion?.latestEndTime ?? null,
        gameDefaultStart: gameDefaultStart?.slice(0, 5) || SESSION_DEFAULTS.START_TIME,
        gameDefaultEnd: gameDefaultEnd?.slice(0, 5) || SESSION_DEFAULTS.END_TIME,
      });
      setStart(defaults.start);
      setEnd(defaults.end);
      setLocation('');
      setNotes('');
    }
    setError(null);
  }, [open, date, mode, session, suggestion, gameDefaultStart, gameDefaultEnd]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // In edit mode, the submit button is disabled until at least one field differs.
  const hasChanges = useMemo(() => {
    if (mode !== 'edit' || !session) return true;
    const startChanged = start !== (session.start_time ?? SESSION_DEFAULTS.START_TIME).slice(0, 5);
    const endChanged = end !== (session.end_time ?? SESSION_DEFAULTS.END_TIME).slice(0, 5);
    const locationChanged = normalize(location) !== (session.location ?? null);
    const notesChanged = normalize(notes) !== (session.notes ?? null);
    return startChanged || endChanged || locationChanged || notesChanged;
  }, [mode, session, start, end, location, notes]);

  if (!date) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await onSubmit({
      start,
      end,
      location: normalize(location),
      notes: normalize(notes),
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error ?? 'Failed to save session');
      return;
    }
    onClose();
  };

  const isSchedule = mode === 'schedule';
  const title = format(parseISO(date), 'EEEE, MMMM d, yyyy');
  const eyebrow = isSchedule ? 'Schedule session' : 'Edit session details';
  const submitLabel = isSchedule
    ? busy ? 'Confirming…' : 'Confirm session'
    : busy ? 'Saving…' : 'Save changes';

  const locationCounterClass =
    location.length > LOCATION_MAX ? 'text-destructive'
      : location.length >= LOCATION_WARN ? 'text-primary'
      : 'text-muted-foreground';
  const notesCounterClass =
    notes.length > NOTES_MAX ? 'text-destructive'
      : notes.length >= NOTES_WARN ? 'text-primary'
      : 'text-muted-foreground';

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={<EyebrowLabel>{eyebrow}</EyebrowLabel>}
      title={title}
      data-testid="session-details-modal"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={busy}
            title="Close this dialog without saving"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy || !hasChanges}
            data-testid="session-details-submit"
            title={isSchedule ? 'Schedule a session on this date' : 'Save changes to this session'}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="sd-start" className="mb-1 block text-sm font-medium text-card-foreground">Start</label>
          <Input id="sd-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="sd-end" className="mb-1 block text-sm font-medium text-card-foreground">End</label>
          <Input id="sd-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor="sd-location" className="mb-1 block text-sm font-medium text-card-foreground">
          Location <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="sd-location"
          type="text"
          maxLength={LOCATION_MAX}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Tom's basement, online (Discord), 123 Main St"
          data-testid="session-details-location"
        />
        {location.length >= LOCATION_WARN && (
          <p className={`mt-1 text-right text-[11px] ${locationCounterClass}`}>
            {location.length} / {LOCATION_MAX}
          </p>
        )}
      </div>

      <div className="mt-3">
        <label htmlFor="sd-notes" className="mb-1 block text-sm font-medium text-card-foreground">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="sd-notes"
          rows={3}
          maxLength={NOTES_MAX}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional: bring snacks, character sheets, this week we're starting Chapter 5"
          data-testid="session-details-notes"
        />
        {notes.length >= NOTES_WARN && (
          <p className={`mt-1 text-right text-[11px] ${notesCounterClass}`}>
            {notes.length} / {NOTES_MAX}
          </p>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </Modal>
  );
}
