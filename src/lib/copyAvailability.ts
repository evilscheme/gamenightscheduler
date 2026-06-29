import { AvailabilityEntry } from "@/lib/availabilityStatus";
import type { AvailabilityStatus } from "@/types";

interface FilterAvailabilityForCopyParams {
  sourceAvailability: Record<string, AvailabilityEntry>;
  destinationAvailability: Record<string, AvailabilityEntry>;
  destinationPlayDays: number[];
  destinationExtraPlayDates: string[];
  today: Date;
  windowEndDate: Date;
  getDayOfWeek: (date: Date) => number;
  isBefore: (date: Date, dateToCompare: Date) => boolean;
  isAfter: (date: Date, dateToCompare: Date) => boolean;
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
  getDayOfWeek,
  isBefore,
  isAfter,
  parseDate,
}: FilterAvailabilityForCopyParams): CopyEntry[] {
  const result: CopyEntry[] = [];

  for (const [dateStr, entry] of Object.entries(sourceAvailability)) {
    // Skip dates already set in destination
    if (destinationAvailability[dateStr]) continue;

    const date = parseDate(dateStr);

    // Skip past dates
    if (isBefore(date, today)) continue;

    // Skip dates beyond the scheduling window
    if (isAfter(date, windowEndDate)) continue;

    // Must be a play day or extra play date in the destination
    const dayOfWeek = getDayOfWeek(date);
    const isDestPlayDay = destinationPlayDays.includes(dayOfWeek);
    const isDestExtra = destinationExtraPlayDates.includes(dateStr);
    if (!isDestPlayDay && !isDestExtra) continue;

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
  getDayOfWeek: (date: Date) => number;
  isBefore: (date: Date, dateToCompare: Date) => boolean;
  isAfter: (date: Date, dateToCompare: Date) => boolean;
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
  getDayOfWeek,
  isBefore,
  isAfter,
  parseDate,
}: FilterSessionConflictsParams): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const dateStr of conflictCandidateDates) {
    if (seen.has(dateStr)) continue;
    seen.add(dateStr);

    if (destinationAvailability[dateStr]) continue; // never overwrite

    const date = parseDate(dateStr);
    if (isBefore(date, today)) continue;
    if (isAfter(date, windowEndDate)) continue;

    const dayOfWeek = getDayOfWeek(date);
    const isPlayDay = destinationPlayDays.includes(dayOfWeek);
    const isExtra = destinationExtraPlayDates.includes(dateStr);
    if (!isPlayDay && !isExtra) continue;

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
