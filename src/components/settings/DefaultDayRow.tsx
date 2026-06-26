'use client';

import { useRef, useState } from 'react';
import type { WeekdayDefault } from '@/lib/defaultAvailability';
import { getTimeOptions } from '@/lib/timeOptions';
import { TEXT_LIMITS } from '@/lib/constants';
import { StatusSelector, type DefaultStatus } from './StatusSelector';

interface DefaultDayRowProps {
  dayLabel: string;
  value: WeekdayDefault | undefined;
  use24h: boolean;
  onChange: (next: WeekdayDefault | undefined) => void;
}

const STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  unavailable: 'Unavailable',
  maybe: 'Maybe',
};

function summaryText(value: WeekdayDefault | undefined, use24h: boolean): string {
  if (!value) return 'No default';
  const opts = getTimeOptions(use24h);
  const labelFor = (hms: string | null) =>
    hms ? (opts.find((o) => o.value === hms.slice(0, 5))?.label ?? hms.slice(0, 5)) : null;
  const parts = [STATUS_LABEL[value.status]];
  const after = labelFor(value.available_after);
  const until = labelFor(value.available_until);
  if (after) parts.push(`after ${after}`);
  if (until) parts.push(`until ${until}`);
  return parts.join(' · ');
}

export function DefaultDayRow({ dayLabel, value, use24h, onChange }: DefaultDayRowProps) {
  const [expanded, setExpanded] = useState(false);

  // Sync local note text with external prop changes using the derived-state pattern:
  // track the last external value in a ref and reset local state inline during render
  // (avoids setState-in-effect cascading renders).
  const externalComment = value?.comment ?? '';
  const prevExternalCommentRef = useRef(externalComment);
  const [noteText, setNoteText] = useState(externalComment);

  let displayedNote = noteText;
  if (prevExternalCommentRef.current !== externalComment) {
    prevExternalCommentRef.current = externalComment;
    setNoteText(externalComment);
    displayedNote = externalComment;
  }

  const status: DefaultStatus = value ? value.status : 'none';
  const showTimes = status === 'available' || status === 'maybe';
  const timeOptions = getTimeOptions(use24h);

  const setStatus = (s: DefaultStatus) => {
    if (s === 'none') {
      onChange(undefined);
      return;
    }
    onChange({
      status: s,
      comment: value?.comment ?? null,
      available_after: value?.available_after ?? null,
      available_until: value?.available_until ?? null,
    });
  };

  const setTime = (field: 'available_after' | 'available_until', hhmm: string) => {
    if (!value) return;
    onChange({ ...value, [field]: hhmm ? `${hhmm}:00` : null });
  };

  const commitNote = () => {
    if (!value) return; // notes only attach to a set status
    const trimmed = displayedNote.trim();
    const next = trimmed.length ? trimmed : null;
    if (next !== (value.comment ?? null)) {
      onChange({ ...value, comment: next });
    }
  };

  // Shared controls used by both desktop and mobile-expanded layouts.
  const controls = (
    <>
      <StatusSelector value={status} onChange={setStatus} dayLabel={dayLabel} />
      {showTimes && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Available after <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <select
              value={value?.available_after ? value.available_after.slice(0, 5) : ''}
              onChange={(e) => setTime('available_after', e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={`${dayLabel} available after`}
            >
              <option value="">Any time</option>
              {timeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Until <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <select
              value={value?.available_until ? value.available_until.slice(0, 5) : ''}
              onChange={(e) => setTime('available_until', e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={`${dayLabel} available until`}
            >
              <option value="">Any time</option>
              {timeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {value && (
        <input
          type="text"
          value={displayedNote}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={commitNote}
          maxLength={TEXT_LIMITS.AVAILABILITY_COMMENT}
          placeholder="Add a note (optional)"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={`${dayLabel} note`}
        />
      )}
    </>
  );

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Desktop: inline row */}
      <div className="hidden items-start gap-4 py-3 sm:grid sm:grid-cols-[110px_1fr]">
        <div className="pt-1 text-sm font-semibold text-foreground">{dayLabel}</div>
        <div className="space-y-3">{controls}</div>
      </div>

      {/* Mobile: compact summary + tap to expand */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-3 py-3 text-left"
          aria-expanded={expanded}
        >
          <span className="text-sm font-semibold text-foreground">{dayLabel}</span>
          <span className="flex items-center gap-2 truncate text-xs text-muted-foreground">
            <span className="truncate">{summaryText(value, use24h)}</span>
            <span aria-hidden>{expanded ? '⌄' : '›'}</span>
          </span>
        </button>
        {expanded && <div className="space-y-3 pb-4">{controls}</div>}
      </div>
    </div>
  );
}
