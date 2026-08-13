import { convertTimeForDisplay } from "./timezone";

/**
 * Format a 24-hour time string to 12-hour format with AM/PM, or keep as 24h
 * @param time - Time in "HH:MM" or "HH:MM:SS" format
 * @param use24h - If true, return 24-hour format instead of 12-hour
 * @returns Formatted time like "2:30 PM" or "14:30", or empty string if null/empty
 */
export function formatTime(time: string | null, use24h: boolean = false): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  if (use24h) {
    return `${h}:${minutes}`;
  }
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

/**
 * Format a time string to compact display (e.g., "7pm", "7:30pm" or "19:00", "19:30")
 * Omits minutes when they are :00
 * @param time - Time in "HH:MM" or "HH:MM:SS" format
 * @param use24h - If true, return 24-hour format
 * @returns Compact formatted time, or empty string if null/empty
 */
export function formatTimeShort(time: string | null, use24h: boolean = false): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);
  if (use24h) {
    return m === 0 ? `${h}:00` : `${h}:${String(m).padStart(2, "0")}`;
  }
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${minutes}${ampm}`;
}

/**
 * The parts of a session's time range, ready to lay out in whatever shape a
 * view needs (one line, two lines, a table cell).
 *
 * `gameTzAbbrev` and the viewer fields are non-null only when the viewer is in
 * a genuinely different *offset* from the game. Equal-offset zones (Amsterdam
 * vs Berlin) show the same wall clock, so labelling them would be noise.
 */
export interface SessionTimeRange {
  /** Compact game-local range, e.g. "8:30am–11:30am". */
  gameTime: string;
  /** Game timezone abbreviation, or null when there is nothing to disambiguate. */
  gameTzAbbrev: string | null;
  /** The same range in the viewer's timezone, or null when it matches the game's. */
  viewerTime: string | null;
  viewerTzAbbrev: string | null;
}

/**
 * Resolve a session's start/end into game-local and viewer-local parts.
 *
 * Views that list sessions from several games order them by absolute instant
 * (see `buildUpcomingSessionRows`), which reads as scrambled if each row only
 * shows a bare wall clock: 8:30am in Tokyo really does precede 6pm the previous
 * day in Los Angeles. Rendering the returned abbreviation is what makes that
 * ordering legible.
 *
 * @param date           Session date in YYYY-MM-DD (game-local)
 * @param start          Start time HH:MM[:SS] (game-local); null → no range
 * @param end            End time HH:MM[:SS] (game-local), or null
 * @param gameTimezone   The game's IANA timezone, or null if unrecorded
 * @param viewerTimezone The viewer's IANA timezone, or null if unknown
 * @param use24h         Viewer's 12/24-hour preference
 * @returns The range parts, or null when the session has no start time.
 */
export function buildSessionTimeRange(
  date: string,
  start: string | null,
  end: string | null,
  gameTimezone: string | null,
  viewerTimezone: string | null,
  use24h: boolean
): SessionTimeRange | null {
  if (!start) return null;

  const gameTime = end
    ? `${formatTimeShort(start, use24h)}–${formatTimeShort(end, use24h)}`
    : formatTimeShort(start, use24h);
  const bare: SessionTimeRange = {
    gameTime,
    gameTzAbbrev: null,
    viewerTime: null,
    viewerTzAbbrev: null,
  };

  // No game timezone recorded: nothing to convert against.
  if (!gameTimezone) return bare;

  const startConv = convertTimeForDisplay(date, start, gameTimezone, viewerTimezone, use24h);
  if (!startConv.isDifferentTz) return bare;

  const endConv = end ? convertTimeForDisplay(date, end, gameTimezone, viewerTimezone, use24h) : null;
  // startConv.userTime is non-null whenever isDifferentTz is true.
  return {
    gameTime,
    gameTzAbbrev: startConv.gameTzAbbrev,
    viewerTime:
      endConv?.userTime != null
        ? `${startConv.userTime} – ${endConv.userTime}`
        : startConv.userTime,
    viewerTzAbbrev: startConv.userTzAbbrev,
  };
}
