import { AvailabilityEntry } from "./availabilityStatus";
import type { AvailabilityStatus } from "@/types";
import { isEligiblePlayDate } from "./eligibleDates";

interface FilterDatesParams {
  filter: string; // "remaining" or day number "0"-"6"
  dates: Date[];
  playDays: number[];
  extraPlayDates: string[];
  existingAvailability: Record<string, AvailabilityEntry>;
  today: Date;
  formatDate: (date: Date) => string;
  getDayOfWeek: (date: Date) => number;
  /**
   * @deprecated no longer used — the past/eligibility check now lives in
   * `eligibleDates.ts`. Kept optional so existing callers/tests can still
   * pass it.
   */
  isBefore?: (date: Date, dateToCompare: Date) => boolean;
}

/**
 * Filter dates for bulk availability setting.
 *
 * @param filter - "remaining" to get only unset dates, or a day number "0"-"6" for specific weekday
 * @param dates - All dates in the scheduling window
 * @param playDays - Array of play day numbers (0=Sun, 1=Mon, etc.)
 * @param extraPlayDates - Array of extra play date strings (YYYY-MM-DD)
 * @param existingAvailability - Map of date strings to availability entries
 * @param today - Today's date for excluding past dates
 * @param formatDate - Function to format Date to "YYYY-MM-DD" string
 * @param getDayOfWeek - Function to get day of week (0-6) from Date
 * @param isBefore - Function to check if date is before another date
 * @returns Array of date strings that match the filter criteria
 */
export function filterDatesForBulkSet({
  filter,
  dates,
  playDays,
  extraPlayDates,
  existingAvailability,
  today,
  formatDate,
  getDayOfWeek,
}: FilterDatesParams): string[] {
  return dates
    .filter((date) => {
      if (filter === "remaining") {
        // Only dates without availability set
        return isEligiblePlayDate({
          date,
          playDays,
          extraPlayDates,
          today,
          existingAvailability,
        });
      }

      // Specific day of week — still must be an eligible (play/extra, not
      // past) date, but existing availability doesn't disqualify it.
      if (!isEligiblePlayDate({ date, playDays, extraPlayDates, today })) {
        return false;
      }
      return getDayOfWeek(date) === parseInt(filter, 10);
    })
    .map((date) => formatDate(date));
}

/**
 * Build the full availability entries for a bulk status change, preserving any
 * existing comment and time constraints on dates that already have an entry
 * (matches the single-date toggle behavior, where only the status cycles).
 */
export function buildBulkUpsertEntries(
  dates: string[],
  status: AvailabilityStatus,
  existingAvailability: Record<string, AvailabilityEntry>
): { date: string; entry: AvailabilityEntry }[] {
  return dates.map((date) => {
    const existing = existingAvailability[date];
    return {
      date,
      entry: {
        status,
        comment: existing?.comment ?? null,
        available_after: existing?.available_after ?? null,
        available_until: existing?.available_until ?? null,
      },
    };
  });
}
