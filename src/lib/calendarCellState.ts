import type { AvailabilityStatus } from '@/types';

// Pure styling/state derivation for one AvailabilityCalendar day cell.
// Extracted verbatim from the MonthCalendar render loop so every branch is
// unit-testable without rendering the calendar. The class strings ARE the
// contract — tests pin them exactly; change them only intentionally.

export interface CalendarCellInputs {
  /** Outside the scheduling window (before start or after end). */
  isOutOfRange: boolean;
  /** A session is confirmed on this date. */
  isConfirmed: boolean;
  /** Before today (local). */
  isPast: boolean;
  /** Regular play day or extra play date, in range. */
  isPlayDay: boolean;
  /** This cell is today. */
  isToday: boolean;
  /** The current user's availability status for this date, if any. */
  status: AvailabilityStatus | undefined;
}

export type CalendarCellDataStatus =
  | 'out-of-range'
  | 'scheduled'
  | 'past'
  | 'disabled'
  | 'available'
  | 'unavailable'
  | 'maybe'
  | 'unset';

export interface CalendarCellState {
  bgColor: string;
  textColor: string;
  cursor: string;
  todayStyles: string;
  /** Test hook: the cell's state as exposed via data-status. */
  dataStatus: CalendarCellDataStatus;
}

const CLICKABLE =
  'cursor-pointer hover:ring-2 hover:ring-primary/50 hover:scale-105 transition-transform';

export function calendarCellState({
  isOutOfRange,
  isConfirmed,
  isPast,
  isPlayDay,
  isToday,
  status,
}: CalendarCellInputs): CalendarCellState {
  // Non-play day in-range: diagonal stripes (matches schedule mini-calendar).
  // Out-of-range: dimmer stripe utility class. Both override below for play/scheduled cells.
  let bgColor = isOutOfRange
    ? 'cal-out-of-range'
    : 'bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,var(--muted)_3px,var(--muted)_5px)]';
  let textColor = 'text-cal-disabled-text';
  let cursor = 'cursor-default';

  // Confirmed sessions show availability color with star overlay
  // (so players can see + change their status even after a session is confirmed)
  if (isConfirmed && !isPast) {
    cursor = CLICKABLE;
    if (status === 'available') {
      bgColor = 'bg-cal-available-bg';
      textColor = 'text-cal-available-text font-semibold';
    } else if (status === 'maybe') {
      bgColor = 'bg-cal-maybe-bg';
      textColor = 'text-cal-maybe-text font-semibold';
    } else if (status === 'unavailable') {
      bgColor = 'bg-cal-unavailable-bg/60';
      textColor = 'text-cal-unavailable-text font-semibold';
    } else {
      // Unset - use unset styling so player knows they haven't responded
      if (isToday) {
        bgColor = 'bg-cal-unset-bg';
      } else {
        bgColor = 'bg-cal-unset-bg border-2 border-dashed border-cal-unset-border';
      }
      textColor = 'text-cal-unset-text font-semibold';
    }
  } else if (isConfirmed && isPast) {
    if (status === 'available') {
      bgColor = 'bg-cal-available-bg';
    } else if (status === 'maybe') {
      bgColor = 'bg-cal-maybe-bg';
    } else if (status === 'unavailable') {
      bgColor = 'bg-cal-unavailable-bg/60';
    } else {
      bgColor = 'bg-cal-unset-bg';
    }
    textColor = 'text-cal-disabled-text/50 font-semibold';
  } else if (isPlayDay && !isPast) {
    cursor = CLICKABLE;
    if (status === 'available') {
      bgColor = 'bg-cal-available-bg';
      textColor = 'text-cal-available-text font-medium';
    } else if (status === 'maybe') {
      bgColor = 'bg-cal-maybe-bg';
      textColor = 'text-cal-maybe-text font-medium';
    } else if (status === 'unavailable') {
      bgColor = 'bg-cal-unavailable-bg/60';
      textColor = 'text-cal-unavailable-text font-medium';
    } else {
      // Unset play day - but not if it's today (today gets solid styling)
      if (isToday) {
        bgColor = 'bg-cal-unset-bg';
      } else {
        bgColor = 'bg-cal-unset-bg border-2 border-dashed border-cal-unset-border';
      }
      textColor = 'text-cal-unset-text';
    }
  } else if (isPast) {
    textColor = 'text-cal-disabled-text/50';
  }

  // Today indicator - bold shadow ring effect (doesn't conflict with borders)
  const todayStyles = isToday ? 'shadow-[0_0_0_3px_var(--primary)] font-bold z-10' : '';

  const dataStatus: CalendarCellDataStatus = isOutOfRange
    ? 'out-of-range'
    : isConfirmed
      ? 'scheduled'
      : isPast
        ? 'past'
        : !isPlayDay
          ? 'disabled'
          : status === 'available'
            ? 'available'
            : status === 'unavailable'
              ? 'unavailable'
              : status === 'maybe'
                ? 'maybe'
                : 'unset';

  return { bgColor, textColor, cursor, todayStyles, dataStatus };
}
