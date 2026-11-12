/**
 * Timezone utilities for browser detection, display formatting, and conversion
 */
import { toLocalDateString } from './date';

/**
 * Get the user's browser timezone
 * @returns IANA timezone identifier or null if unavailable
 */
export function getBrowserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/**
 * Format a timezone for display (e.g., "Los Angeles (PST)")
 * @param timezone - IANA timezone identifier
 * @returns Human-readable timezone string with abbreviation
 */
export function formatTimezoneDisplay(timezone: string | null): string {
  if (!timezone) return '';

  try {
    // Handle Etc/GMT offset timezones (signs are inverted: Etc/GMT+5 = UTC-5)
    if (timezone === 'Etc/GMT0') {
      return 'UTC+0';
    }
    const etcGmtMatch = timezone.match(/^Etc\/GMT([+-]\d+)$/);
    if (etcGmtMatch) {
      const etcOffset = parseInt(etcGmtMatch[1], 10);
      const utcOffset = -etcOffset;
      return utcOffset >= 0 ? `UTC+${utcOffset}` : `UTC${utcOffset}`;
    }

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(now);
    const abbrev = parts.find((p) => p.type === 'timeZoneName')?.value || '';

    // Create a friendly name from the timezone
    const cityName = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;
    return `${cityName} (${abbrev})`;
  } catch {
    return timezone;
  }
}

/**
 * The conservative shape every stored timezone must have: IANA names only use
 * letters, digits, `_`, `+`, `-` and `/` (`America/Argentina/Buenos_Aires`,
 * `America/Port-au-Prince`, `Etc/GMT+5`, `UTC`). Mirrors the
 * `games_timezone_shape` and `users_timezone_shape` CHECK constraints in
 * supabase/schema.sql — keep the two in sync.
 *
 * It is a shape check, not a zone lookup: it is what makes a value safe to
 * interpolate (no CR/LF, `:` or `;`), and `isValidTimezone` adds the lookup.
 */
export const TIMEZONE_SHAPE = /^[A-Za-z0-9_+/-]{1,64}$/;

// Distinct strings are few (one per game/user zone), but they arrive per row,
// and constructing an Intl.DateTimeFormat is expensive. The cap only matters if
// something feeds in unbounded garbage.
const validityCache = new Map<string, boolean>();
const VALIDITY_CACHE_MAX = 500;

/**
 * Validate that a timezone string is a well-shaped IANA timezone the runtime
 * recognises. Results are cached per distinct string.
 * @param timezone - String to validate
 * @returns true if valid IANA timezone
 */
export function isValidTimezone(timezone: string): boolean {
  if (typeof timezone !== 'string') return false;
  const cached = validityCache.get(timezone);
  if (cached !== undefined) return cached;

  let valid = TIMEZONE_SHAPE.test(timezone);
  if (valid) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      valid = false;
    }
  }
  if (validityCache.size >= VALIDITY_CACHE_MAX) validityCache.clear();
  validityCache.set(timezone, valid);
  return valid;
}

/**
 * A stored timezone if it is usable, otherwise null. Stored zones come from
 * the database, where a GM can write any well-shaped string, and an unknown
 * zone makes Intl throw a RangeError mid-render. Every helper below that takes
 * a stored zone passes it through here and treats an unusable one exactly as
 * it treats "no timezone".
 */
export function usableTimezone(timezone: string | null | undefined): string | null {
  return timezone && isValidTimezone(timezone) ? timezone : null;
}

/**
 * Get the timezone abbreviation for a given date and timezone
 * @param date - Date to check (affects DST)
 * @param timezone - IANA timezone identifier
 * @returns Short timezone abbreviation (e.g., "PST", "GMT", "EST")
 */
export function getTimezoneAbbreviation(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(date);
    return parts.find((p) => p.type === 'timeZoneName')?.value || timezone;
  } catch {
    return timezone;
  }
}

/**
 * Convert a time from one timezone to another for display.
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timeStr - Time in HH:MM or HH:MM:SS format (in gameTz)
 * @param gameTz - Game's IANA timezone
 * @param rawUserTz - User's IANA timezone (null or unusable = same as game)
 * @param use24h - Whether to format in 24h
 * @returns Object with formatted game time, user time (if different), and TZ abbreviations
 */
export function convertTimeForDisplay(
  dateStr: string,
  timeStr: string,
  gameTz: string,
  rawUserTz: string | null,
  use24h: boolean
): {
  gameTime: string;
  gameTzAbbrev: string;
  userTime: string | null;
  userTzAbbrev: string | null;
  isDifferentTz: boolean;
} {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);

  // Build a UTC date by probing the game timezone's offset
  const probeUtc = new Date(Date.UTC(y, mo - 1, d, h, m, 0));

  // An unusable game zone gives nothing to convert from: show the stored
  // wall-clock time as-is, with no abbreviation and no "for you" conversion.
  if (!usableTimezone(gameTz)) {
    return {
      gameTime: formatTimeInTz(probeUtc, 'UTC', use24h),
      gameTzAbbrev: '',
      userTime: null,
      userTzAbbrev: null,
      isDifferentTz: false,
    };
  }
  // An unusable viewer zone is treated like "no viewer zone".
  const userTz = usableTimezone(rawUserTz);
  const gameOffset = getTimezoneOffsetMinutes(probeUtc, gameTz);
  // The actual UTC moment: local time in gameTz minus the offset
  const actualUtc = new Date(probeUtc.getTime() - gameOffset * 60000);

  // Format in game timezone
  const gameTime = formatTimeInTz(actualUtc, gameTz, use24h);
  const gameTzAbbrev = getTimezoneAbbreviation(actualUtc, gameTz);

  // If user has no timezone or it's the same, skip conversion
  if (!userTz || userTz === gameTz) {
    return {
      gameTime,
      gameTzAbbrev,
      userTime: null,
      userTzAbbrev: null,
      isDifferentTz: false,
    };
  }

  // Check if same offset (e.g., Europe/London and Europe/Dublin are the same)
  const userOffset = getTimezoneOffsetMinutes(actualUtc, userTz);
  if (gameOffset === userOffset) {
    return {
      gameTime,
      gameTzAbbrev,
      userTime: null,
      userTzAbbrev: null,
      isDifferentTz: false,
    };
  }

  const userTime = formatTimeInTz(actualUtc, userTz, use24h);
  const userTzAbbrev = getTimezoneAbbreviation(actualUtc, userTz);

  return {
    gameTime,
    gameTzAbbrev,
    userTime,
    userTzAbbrev,
    isDifferentTz: true,
  };
}

/**
 * Resolve the absolute UTC instant (epoch ms) of a session given its local
 * date/time in a game's timezone. Used to order sessions chronologically across
 * games in different timezones, where raw HH:MM comparison would be wrong.
 *
 * @param dateStr  Session date in YYYY-MM-DD (interpreted in `timezone`)
 * @param timeStr  Time in HH:MM[:SS] (interpreted in `timezone`); null → 00:00
 * @param rawTimezone IANA timezone, or null (or unusable) to interpret the
 *                    local time as UTC
 * @returns UTC epoch milliseconds
 */
export function getSessionInstantMs(
  dateStr: string,
  timeStr: string | null,
  rawTimezone: string | null
): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, m] = (timeStr ?? '00:00').split(':').map(Number);
  const probeUtc = new Date(Date.UTC(y, mo - 1, d, h, m || 0, 0));
  const timezone = usableTimezone(rawTimezone);
  if (!timezone) return probeUtc.getTime();
  const offset = getTimezoneOffsetMinutes(probeUtc, timezone);
  return probeUtc.getTime() - offset * 60000;
}

/**
 * Get the calendar date (YYYY-MM-DD) at a given instant, as observed in a
 * specific timezone. Used to decide whether a session is still "upcoming" in
 * its own game's timezone rather than the viewer's.
 *
 * @param ms       UTC epoch milliseconds
 * @param rawTimezone IANA timezone, or null (or unusable) to use the runtime's
 *                    local date
 */
export function getDateInTimezone(ms: number, rawTimezone: string | null): string {
  const date = new Date(ms);
  const timezone = usableTimezone(rawTimezone);
  if (!timezone) {
    return toLocalDateString(date);
  }
  // en-CA formats as YYYY-MM-DD, which sorts lexicographically.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Get the UTC offset in minutes for a timezone at a given moment.
 * Positive = ahead of UTC, negative = behind. An unusable zone reads as UTC (0).
 */
function getTimezoneOffsetMinutes(utcDate: Date, timezone: string): number {
  if (!usableTimezone(timezone)) return 0;
  // Format the date in both UTC and target timezone, then compute difference
  const utcStr = utcDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = utcDate.toLocaleString('en-US', { timeZone: timezone });
  const utcParsed = new Date(utcStr);
  const tzParsed = new Date(tzStr);
  return (tzParsed.getTime() - utcParsed.getTime()) / 60000;
}

/**
 * Format a UTC Date in a specific timezone (an unusable zone formats as UTC)
 */
function formatTimeInTz(utcDate: Date, timezone: string, use24h: boolean): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: usableTimezone(timezone) ?? 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: !use24h,
  });
  return formatter.format(utcDate);
}
