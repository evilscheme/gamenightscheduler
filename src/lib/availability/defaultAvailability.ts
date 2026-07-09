import type { AvailabilityStatus } from "@/types";
import type { AvailabilityEntry } from "./availabilityStatus";
import { isEligiblePlayDate } from "./eligibleDates";

/** A user's standing default for one weekday. Mirrors a per-date entry minus the date. */
export interface WeekdayDefault {
  status: AvailabilityStatus;
  comment: string | null;
  available_after: string | null; // HH:MM:SS
  available_until: string | null; // HH:MM:SS
}

/** A single per-date availability row the apply action will write. */
export interface DefaultEntryToWrite {
  date: string; // YYYY-MM-DD
  status: AvailabilityStatus;
  comment: string | null;
  available_after: string | null;
  available_until: string | null;
}

interface ComputeDefaultEntriesParams {
  /** User's weekday defaults keyed by day_of_week (0=Sun…6=Sat). Missing key = no default. */
  defaults: Record<number, WeekdayDefault>;
  /** Every calendar date in the scheduling window (e.g. eachDayOfInterval(start, end)). */
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
 * Compute the per-date entries to write when applying a user's default availability
 * to a game. Non-destructive: only blank, future, play/extra dates whose weekday has a
 * configured default are returned.
 */
export function computeDefaultEntries({
  defaults,
  dates,
  playDays,
  extraPlayDates,
  existingAvailability,
  today,
  formatDate,
  getDayOfWeek,
}: ComputeDefaultEntriesParams): DefaultEntryToWrite[] {
  const entries: DefaultEntryToWrite[] = [];

  for (const date of dates) {
    // Must be play-day-or-extra, not past, and blank in the destination
    // (non-destructive: leave already-set dates alone).
    if (!isEligiblePlayDate({ date, playDays, extraPlayDates, today, existingAvailability })) {
      continue;
    }

    // The weekday must have a configured default.
    const dayOfWeek = getDayOfWeek(date);
    const def = defaults[dayOfWeek];
    if (!def) continue;

    entries.push({
      date: formatDate(date),
      status: def.status,
      comment: def.comment,
      available_after: def.available_after,
      available_until: def.available_until,
    });
  }

  return entries;
}
