import { format, isBefore, parseISO } from 'date-fns';
import type { AvailabilityStatus, GameSession } from '@/types';
import { getNextStatus, type AvailabilityEntry } from '@/lib/availability';
import { formatSessionTimeWindow, type OtherGameSessionInfo } from '@/lib/schedule';
import { formatTimeShort } from '@/lib/formatting';
import type { CalendarCellInputs } from './calendarCellState';

// One day cell's tooltip, derived once and rendered twice: visually by
// DayTooltip, and as text for the cell's aria-label. Deriving both from a
// single model is the point — the same reason calendarStyles.ts exports
// CELL_STYLES and LEGEND from shared constants.

export const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  available: 'Available',
  maybe: 'Maybe',
  unavailable: 'Unavailable',
};

export interface TooltipInputs extends CalendarCellInputs {
  /** `yyyy-MM-dd`. */
  date: string;
  /**
   * The current user's row for this date, if any. `status` (inherited from
   * CalendarCellInputs, where calendarCellState() also consumes it) must be
   * `entry?.status` — they are one fact carried in two places.
   */
  entry: AvailabilityEntry | undefined;
  session: GameSession | undefined;
  gmNote: string | undefined;
  otherSessions: OtherGameSessionInfo[];
  isExtraDate: boolean;
  isGmOrCoGm: boolean;
  /** Admin peek view: nothing here is clickable, so no hints. */
  readOnly: boolean;
  canAddAsExtra: boolean;
  windowStart: Date;
  windowEnd: Date;
  use24h: boolean;
}

export type BandTone =
  | 'available' | 'maybe' | 'unavailable' | 'unset'
  | 'non-play' | 'past' | 'out-of-range';

export interface TooltipRow {
  label: string;
  value: string;
}

export interface TooltipModel {
  dateLabel: string;
  badges: string[];
  isScheduled: boolean;
  band: { label: string; qualifier: string | null; tone: BandTone };
  rows: TooltipRow[];
  hints: string[];
}

/** Tones where the band states an answer the user gave (or didn't). */
const ANSWER_TONES: ReadonlySet<BandTone> = new Set<BandTone>([
  'available', 'maybe', 'unavailable', 'unset',
]);

/**
 * A time window qualifies "Available"/"Maybe" only. The data round-trips
 * through an unavailable toggle so it isn't lost, but the note editor hides
 * the time fields for unavailable — surfacing it would advertise a value the
 * user can't reach. Mirrors MonthCalendar's showTimeConstraint rule.
 */
function timeQualifier(entry: AvailabilityEntry | undefined, use24h: boolean): string | null {
  if (!entry || (entry.status !== 'available' && entry.status !== 'maybe')) return null;
  const after = formatTimeShort(entry.available_after, use24h);
  const until = formatTimeShort(entry.available_until, use24h);
  if (after && until) return `${after}–${until}`;
  if (after) return `after ${after}`;
  if (until) return `until ${until}`;
  return null;
}

function resolveBand(i: TooltipInputs): TooltipModel['band'] {
  // isPast is checked before isOutOfRange, which inverts calendarCellState's
  // ladder deliberately. getSchedulingWindow clamps windowStart to >= today,
  // so every past date is also "before the window" — checking out-of-range
  // first would make a past date claim "Before campaign start", which is
  // false about last Thursday. "Before campaign start" is only ever true of a
  // future date waiting on a campaign that hasn't begun.
  if (i.isPast) {
    const answered = i.status ? STATUS_LABEL[i.status] : null;
    return {
      label: answered ? `Past · you were ${answered}` : 'Past date',
      qualifier: null,
      tone: 'past',
    };
  }
  if (i.isOutOfRange) {
    const beforeStart = isBefore(parseISO(i.date), i.windowStart);
    return {
      label: beforeStart ? 'Before campaign start' : 'After campaign end',
      qualifier: null,
      tone: 'out-of-range',
    };
  }
  if (!i.isPlayDay) {
    return { label: 'Not a play day', qualifier: null, tone: 'non-play' };
  }
  const qualifier = timeQualifier(i.entry, i.use24h);
  if (!i.status) return { label: 'Not set', qualifier, tone: 'unset' };
  return { label: STATUS_LABEL[i.status], qualifier, tone: i.status };
}

function buildRows(i: TooltipInputs): TooltipRow[] {
  const rows: TooltipRow[] = [];

  if (i.isConfirmed && i.session) {
    const when = formatSessionTimeWindow(i.session.start_time, i.session.end_time, i.use24h);
    rows.push({ label: 'Session', value: when || 'Time TBD' });
  }
  if (i.entry?.comment) rows.push({ label: 'Note', value: i.entry.comment });
  if (i.gmNote) rows.push({ label: 'GM', value: i.gmNote });

  for (const other of i.otherSessions) {
    const when = formatSessionTimeWindow(other.startTime, other.endTime, i.use24h);
    rows.push({ label: 'Also', value: when ? `${other.gameName}, ${when}` : other.gameName });
  }

  // Only the bound that was actually crossed — naming both is noise.
  // Past dates are out-of-range by construction (windowStart is clamped to
  // today), so gate on !isPast or every past cell gains a bogus campaign row.
  if (i.isOutOfRange && !i.isPast) {
    rows.push(
      isBefore(parseISO(i.date), i.windowStart)
        ? { label: 'Campaign starts', value: format(i.windowStart, 'MMM d') }
        : { label: 'Campaign ends', value: format(i.windowEnd, 'MMM d') },
    );
  }

  return rows;
}

function buildHints(i: TooltipInputs): string[] {
  // Nothing here responds to a click, so promising one would be a lie.
  if (i.readOnly || i.isPast || i.isOutOfRange) return [];

  const hints: string[] = [];
  if (i.isPlayDay) {
    hints.push(`Click to mark ${STATUS_LABEL[getNextStatus(i.entry)]}`);
    // The pencil is a click target inside the cell button, so it can't be a
    // real <button> and its aria-label isn't exposed on a generic span.
    // The hint is the only place this affordance is named.
    hints.push(i.entry?.comment ? 'Click the note icon to edit your note' : 'Click the note icon to add a note or time window');
  }
  if (i.isGmOrCoGm && i.canAddAsExtra) {
    hints.push('GM · click + to add as an extra date');
  }
  if (i.isGmOrCoGm && i.isExtraDate) {
    hints.push('GM · click ✕ to remove this extra date');
  }
  return hints;
}

export function describeCalendarCell(i: TooltipInputs): TooltipModel {
  const badges: string[] = [];
  if (i.isConfirmed) badges.push('Scheduled');
  if (i.isExtraDate && !i.isPast) badges.push('Extra date');
  if (i.isToday) badges.push('Today');

  return {
    dateLabel: format(parseISO(i.date), 'EEEE, MMM d'),
    badges,
    isScheduled: i.isConfirmed,
    band: resolveBand(i),
    rows: buildRows(i),
    hints: buildHints(i),
  };
}

export function tooltipModelToText(model: TooltipModel): string {
  const lines = [model.dateLabel];

  if (model.isScheduled) {
    const session = model.rows.find((r) => r.label === 'Session');
    // Deliberately NOT the word "Scheduled": this string becomes the day cell's
    // accessible name, and ~94 E2E assertions use getByRole('button', { name:
    // /schedule/i }), which substring-matches. "Scheduled" would make every
    // confirmed cell collide with the Schedule tab button.
    lines.push(session ? `Session confirmed: ${session.value}` : 'Session confirmed');
  }

  const { label, qualifier, tone } = model.band;
  const stated = qualifier ? `${label} ${qualifier}` : label;
  lines.push(ANSWER_TONES.has(tone) ? `Your status: ${stated}` : stated);

  for (const row of model.rows) {
    if (row.label === 'Session') continue;
    // "GM note:" verbatim — several E2E assertions match that exact prefix.
    lines.push(row.label === 'GM' ? `GM note: ${row.value}` : `${row.label}: ${row.value}`);
  }

  return lines.join('\n');
}
