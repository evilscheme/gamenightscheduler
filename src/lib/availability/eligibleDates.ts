import { format, getDay, isAfter, isBefore } from "date-fns";

/**
 * Inputs for the shared "eligible play date" rule. Extracted from six call
 * sites (bulkAvailability, defaultAvailability, copyAvailability x2,
 * availability x2) that each re-implemented a slightly different version of
 * the same test: "this date is a regular play day OR an extra play date,
 * it is not in the past (today itself counts), and — where relevant — it is
 * not beyond a scheduling-window end and/or not already set at the
 * destination."
 */
export interface EligibleDateOptions {
  /** The calendar date being evaluated. */
  date: Date;
  /** Regular play weekdays (0=Sun … 6=Sat). */
  playDays: number[];
  /** One-off play dates as "YYYY-MM-DD" strings — eligible regardless of weekday. */
  extraPlayDates: string[];
  /** Dates before this are ineligible; `today` itself IS eligible. */
  today: Date;
  /** Optional inclusive upper bound — dates after this are ineligible. */
  windowEnd?: Date;
  /**
   * Optional "already written" map keyed by "YYYY-MM-DD". When provided, a
   * date with an existing entry is ineligible — this is the non-destructive
   * rule used by bulk "remaining", defaults, and copy-availability, which
   * never overwrite an existing entry. Omit it for callers that don't filter
   * on existing entries (e.g. the completion-percentage calculators).
   */
  existingAvailability?: Record<string, unknown>;
}

/**
 * The single shared "eligible play date" predicate. A date is eligible when
 * it is a regular play day or an extra play date, it's today or later, it's
 * on/before an optional window end, and (when checked) it's blank in the
 * destination.
 */
export function isEligiblePlayDate({
  date,
  playDays,
  extraPlayDates,
  today,
  windowEnd,
  existingAvailability,
}: EligibleDateOptions): boolean {
  const dateStr = format(date, "yyyy-MM-dd");

  if (!playDays.includes(getDay(date)) && !extraPlayDates.includes(dateStr)) {
    return false;
  }

  if (isBefore(date, today)) {
    return false;
  }

  if (windowEnd && isAfter(date, windowEnd)) {
    return false;
  }

  if (existingAvailability && existingAvailability[dateStr]) {
    return false;
  }

  return true;
}
