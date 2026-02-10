import { AvailabilityEntry } from "@/lib/availabilityStatus";

interface FilterAvailabilityForCopyParams {
  sourceAvailability: Record<string, AvailabilityEntry>;
  destinationAvailability: Record<string, AvailabilityEntry>;
  destinationPlayDays: number[];
  destinationSpecialPlayDates: string[];
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
 * (b) a play day or special play date in the destination game
 * (c) not in the past
 * (d) within the destination scheduling window
 *
 * @returns Array of { date, entry } to copy
 */
export function filterAvailabilityForCopy({
  sourceAvailability,
  destinationAvailability,
  destinationPlayDays,
  destinationSpecialPlayDates,
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

    // Must be a play day or special play date in the destination
    const dayOfWeek = getDayOfWeek(date);
    const isDestPlayDay = destinationPlayDays.includes(dayOfWeek);
    const isDestSpecial = destinationSpecialPlayDates.includes(dateStr);
    if (!isDestPlayDay && !isDestSpecial) continue;

    result.push({ date: dateStr, entry });
  }

  // Sort by date for deterministic order
  result.sort((a, b) => a.date.localeCompare(b.date));

  return result;
}
