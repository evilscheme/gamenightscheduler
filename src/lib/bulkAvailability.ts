import { AvailabilityEntry } from "@/lib/availabilityStatus";

interface FilterDatesParams {
  filter: string; // "remaining" or day number "0"-"6"
  dates: Date[];
  playDays: number[];
  specialPlayDates: string[];
  existingAvailability: Record<string, AvailabilityEntry>;
  today: Date;
  formatDate: (date: Date) => string;
  getDayOfWeek: (date: Date) => number;
  isBefore: (date: Date, dateToCompare: Date) => boolean;
}

/**
 * Filter dates for bulk availability setting.
 *
 * @param filter - "remaining" to get only unset dates, or a day number "0"-"6" for specific weekday
 * @param dates - All dates in the scheduling window
 * @param playDays - Array of play day numbers (0=Sun, 1=Mon, etc.)
 * @param specialPlayDates - Array of special play date strings (YYYY-MM-DD)
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
  specialPlayDates,
  existingAvailability,
  today,
  formatDate,
  getDayOfWeek,
  isBefore,
}: FilterDatesParams): string[] {
  return dates
    .filter((date) => {
      const dayOfWeek = getDayOfWeek(date);
      const dateStr = formatDate(date);
      const isSpecialPlayDate = specialPlayDates.includes(dateStr);

      // Must be a play day or special play date
      if (!playDays.includes(dayOfWeek) && !isSpecialPlayDate) {
        return false;
      }

      // Can't set past dates
      if (isBefore(date, today)) {
        return false;
      }

      if (filter === "remaining") {
        // Only dates without availability set
        return !existingAvailability[dateStr];
      } else {
        // Specific day of week
        return dayOfWeek === parseInt(filter, 10);
      }
    })
    .map((date) => formatDate(date));
}
