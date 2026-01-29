/**
 * Timezone utilities for browser detection and display formatting
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
