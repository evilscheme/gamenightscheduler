/**
 * Timezone utilities for browser detection, display formatting, and conversion
 */

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
 * Validate that a timezone string is a valid IANA timezone
 * @param timezone - String to validate
 * @returns true if valid IANA timezone
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
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
 * @param userTz - User's IANA timezone (null = same as game)
 * @param use24h - Whether to format in 24h
 * @returns Object with formatted game time, user time (if different), and TZ abbreviations
 */
export function convertTimeForDisplay(
  dateStr: string,
  timeStr: string,
  gameTz: string,
  userTz: string | null,
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
 * Get the UTC offset in minutes for a timezone at a given moment.
 * Positive = ahead of UTC, negative = behind.
 */
function getTimezoneOffsetMinutes(utcDate: Date, timezone: string): number {
  // Format the date in both UTC and target timezone, then compute difference
  const utcStr = utcDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = utcDate.toLocaleString('en-US', { timeZone: timezone });
  const utcParsed = new Date(utcStr);
  const tzParsed = new Date(tzStr);
  return (tzParsed.getTime() - utcParsed.getTime()) / 60000;
}

/**
 * Format a UTC Date in a specific timezone
 */
function formatTimeInTz(utcDate: Date, timezone: string, use24h: boolean): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: !use24h,
  });
  return formatter.format(utcDate);
}
