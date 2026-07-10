import { AvailabilityEntry } from "./availabilityStatus";
import type { AvailabilityStatus } from "@/types";
import { isEligiblePlayDate } from "./eligibleDates";

interface FilterAvailabilityForCopyParams {
  sourceAvailability: Record<string, AvailabilityEntry>;
  destinationAvailability: Record<string, AvailabilityEntry>;
  destinationPlayDays: number[];
  destinationExtraPlayDates: string[];
  today: Date;
  windowEndDate: Date;
  /**
   * @deprecated no longer used — the play-day/not-past/window-end check now
   * lives in `eligibleDates.ts`. Kept optional so existing callers/tests can
   * still pass it.
   */
  getDayOfWeek?: (date: Date) => number;
  /** @deprecated see `getDayOfWeek` above. */
  isBefore?: (date: Date, dateToCompare: Date) => boolean;
  /** @deprecated see `getDayOfWeek` above. */
  isAfter?: (date: Date, dateToCompare: Date) => boolean;
  parseDate: (dateStr: string) => Date;
}

export interface CopyEntry {
  date: string;
  entry: AvailabilityEntry;
}

/**
 * Filter source availability entries that can be copied to the destination game.
 *
 * Only includes dates that are:
 * (a) blank in destination (never overwrites existing entries)
 * (b) a play day or extra play date in the destination game
 * (c) not in the past
 * (d) within the destination scheduling window
 *
 * @returns Array of { date, entry } to copy
 */
export function filterAvailabilityForCopy({
  sourceAvailability,
  destinationAvailability,
  destinationPlayDays,
  destinationExtraPlayDates,
  today,
  windowEndDate,
  parseDate,
}: FilterAvailabilityForCopyParams): CopyEntry[] {
  const result: CopyEntry[] = [];

  for (const [dateStr, entry] of Object.entries(sourceAvailability)) {
    const date = parseDate(dateStr);

    // Blank in destination, a destination play-day/extra-date, not past,
    // and within the destination scheduling window.
    if (
      !isEligiblePlayDate({
        date,
        playDays: destinationPlayDays,
        extraPlayDates: destinationExtraPlayDates,
        today,
        windowEnd: windowEndDate,
        existingAvailability: destinationAvailability,
      })
    ) {
      continue;
    }

    result.push({ date: dateStr, entry });
  }

  // Sort by date for deterministic order
  result.sort((a, b) => a.date.localeCompare(b.date));

  return result;
}

export interface CopyConflict {
  dates: string[];
  status: AvailabilityStatus;
}

interface FilterSessionConflictsParams {
  /** Candidate dates (the source game's confirmed-session dates). */
  conflictCandidateDates: string[];
  destinationAvailability: Record<string, AvailabilityEntry>;
  destinationPlayDays: number[];
  destinationExtraPlayDates: string[];
  today: Date;
  windowEndDate: Date;
  /**
   * @deprecated no longer used — the play-day/not-past/window-end check now
   * lives in `eligibleDates.ts`. Kept optional so existing callers/tests can
   * still pass it.
   */
  getDayOfWeek?: (date: Date) => number;
  /** @deprecated see `getDayOfWeek` above. */
  isBefore?: (date: Date, dateToCompare: Date) => boolean;
  /** @deprecated see `getDayOfWeek` above. */
  isAfter?: (date: Date, dateToCompare: Date) => boolean;
  parseDate: (dateStr: string) => Date;
}

/**
 * From a set of candidate dates (a source game's confirmed sessions), keep those
 * that are valid copy targets in the destination — i.e. the same rules
 * `filterAvailabilityForCopy` applies: blank in destination, a destination
 * play-day or extra play-date, not past, and within the scheduling window.
 *
 * @returns sorted, de-duplicated date strings
 */
export function filterSessionConflictsForCopy({
  conflictCandidateDates,
  destinationAvailability,
  destinationPlayDays,
  destinationExtraPlayDates,
  today,
  windowEndDate,
  parseDate,
}: FilterSessionConflictsParams): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const dateStr of conflictCandidateDates) {
    if (seen.has(dateStr)) continue;
    seen.add(dateStr);

    const date = parseDate(dateStr);
    if (
      !isEligiblePlayDate({
        date,
        playDays: destinationPlayDays,
        extraPlayDates: destinationExtraPlayDates,
        today,
        windowEnd: windowEndDate,
        existingAvailability: destinationAvailability,
      })
    ) {
      continue;
    }

    result.push(dateStr);
  }

  result.sort((a, b) => a.localeCompare(b));
  return result;
}

/**
 * Merge availability copy entries with session-conflict overrides.
 *
 * Conflict dates are written status-only (no comment/time) using `conflictStatus`,
 * replacing any copied entry on the same date and adding entries for conflict
 * dates that had no copied availability. Result is sorted by date.
 */
export function applyCopyConflicts(
  toCopy: CopyEntry[],
  conflictDates: string[],
  conflictStatus: AvailabilityStatus,
): CopyEntry[] {
  const conflictSet = new Set(conflictDates);
  const base = toCopy.filter((e) => !conflictSet.has(e.date));
  const overrides: CopyEntry[] = conflictDates.map((date) => ({
    date,
    entry: { status: conflictStatus, comment: null, available_after: null, available_until: null },
  }));
  return [...base, ...overrides].sort((a, b) => a.date.localeCompare(b.date));
}
