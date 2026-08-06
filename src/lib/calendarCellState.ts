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
  /** Tailwind fill-* class for the scheduled-session star, '' when not scheduled. */
  starFill: string;
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
  let starFill = '';

  // Confirmed sessions show a solid star colored by the player's own
  // response, with the background left transparent so the star carries the
  // color (so players can see + change their status even after a session is
  // confirmed).
  if (isConfirmed && !isPast) {
    cursor = CLICKABLE;
    if (status === 'available') {
      bgColor = '';
      textColor = 'text-cal-available-text font-semibold';
      starFill = 'fill-cal-available-bg';
    } else if (status === 'maybe') {
      bgColor = 'border-2 border-dashed border-cal-available-ink';
      textColor = 'text-cal-available-text font-semibold';
      starFill = 'fill-cal-available-bg';
    } else if (status === 'unavailable') {
      bgColor = '';
      textColor = 'text-cal-unavailable-text font-semibold';
      starFill = 'fill-cal-unavailable-bg';
    } else {
      // Unset - invert the usual pairing: a light-grey star on a near-white
      // card is nearly invisible (1.53:1), and "scheduled but you haven't
      // answered" is exactly the case that should be noticeable. So the star
      // takes the dark ink (7.58:1 against the card) and the number takes
      // the light fill (5.10:1 against the star).
      bgColor = '';
      textColor = 'text-cal-empty-bg font-semibold';
      starFill = 'fill-cal-empty-text';
    }
  } else if (isConfirmed && isPast) {
    if (status === 'available') {
      bgColor = '';
      starFill = 'fill-cal-available-bg';
    } else if (status === 'maybe') {
      bgColor = 'border-2 border-dashed border-cal-available-ink';
      starFill = 'fill-cal-available-bg';
    } else if (status === 'unavailable') {
      bgColor = '';
      starFill = 'fill-cal-unavailable-bg';
    } else {
      bgColor = '';
      starFill = 'fill-cal-empty-text';
    }
    textColor = 'text-cal-disabled-text/50 font-semibold';
  } else if (isPlayDay && !isPast) {
    cursor = CLICKABLE;
    if (status === 'available') {
      bgColor = 'bg-cal-available-bg';
      textColor = 'text-cal-available-text font-medium';
    } else if (status === 'maybe') {
      bgColor = 'border-2 border-dashed border-cal-available-ink';
      textColor = 'text-cal-available-ink font-medium';
    } else if (status === 'unavailable') {
      bgColor = 'bg-cal-unavailable-bg';
      textColor = 'text-cal-unavailable-text font-medium';
    } else {
      // Unset play day
      bgColor = 'bg-cal-empty-bg';
      textColor = 'text-cal-empty-text';
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

  return { bgColor, textColor, cursor, todayStyles, starFill, dataStatus };
}
