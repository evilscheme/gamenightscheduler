// Canonical date <-> YYYY-MM-DD string helpers.
//
// Always use these instead of `new Date().toISOString().split('T')[0]`:
// toISOString() yields the UTC calendar date, which is the WRONG local date for
// users west of UTC in the evening (and east of UTC in the early morning).
// For "the date at an instant in a specific IANA timezone", use
// `getDateInTimezone` in `src/lib/timezone.ts` instead.

/** Format a Date as YYYY-MM-DD in local time (matches how session dates are stored). */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today's date as YYYY-MM-DD in the user's local timezone. */
export function getTodayLocalDate(): string {
  return toLocalDateString(new Date());
}
