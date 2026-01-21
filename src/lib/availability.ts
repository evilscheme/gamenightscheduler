import {
  addMonths,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  isAfter,
  startOfDay,
} from "date-fns";

export interface AvailabilityRecord {
  user_id: string;
  date: string;
}

export interface PlayerCompletionParams {
  playerIds: string[];
  playDays: number[];
  schedulingWindowMonths: number;
  specialPlayDates: string[];
  availabilityRecords: AvailabilityRecord[];
  referenceDate?: Date;
}

/**
 * Calculate the percentage of play dates each player has filled in their availability for.
 * Only counts future dates (today or later) that match play days or special play dates.
 *
 * @returns A record mapping player IDs to their completion percentage (0-100)
 */
export function calculatePlayerCompletionPercentages({
  playerIds,
  playDays,
  schedulingWindowMonths,
  specialPlayDates,
  availabilityRecords,
  referenceDate = new Date(),
}: PlayerCompletionParams): Record<string, number> {
  const today = startOfDay(referenceDate);
  const endDate = endOfMonth(addMonths(today, schedulingWindowMonths));

  // Get all future play dates within the window
  const playDates = eachDayOfInterval({ start: today, end: endDate })
    .filter((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return playDays.includes(getDay(date)) || specialPlayDates.includes(dateStr);
    })
    .filter(
      (date) =>
        isAfter(date, today) ||
        format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
    )
    .map((date) => format(date, "yyyy-MM-dd"));

  const totalDates = playDates.length;
  if (totalDates === 0) return {};

  const percentages: Record<string, number> = {};
  playerIds.forEach((playerId) => {
    const playerAvailDates = new Set(
      availabilityRecords
        .filter((a) => a.user_id === playerId)
        .map((a) => a.date)
    );
    const filledCount = playDates.filter((d) => playerAvailDates.has(d)).length;
    percentages[playerId] = Math.round((filledCount / totalDates) * 100);
  });

  return percentages;
}

/**
 * Get all play dates within the scheduling window.
 * Useful for determining the total number of dates a player should fill in.
 */
export function getPlayDatesInWindow({
  playDays,
  schedulingWindowMonths,
  specialPlayDates,
  referenceDate = new Date(),
}: Omit<PlayerCompletionParams, "playerIds" | "availabilityRecords">): string[] {
  const today = startOfDay(referenceDate);
  const endDate = endOfMonth(addMonths(today, schedulingWindowMonths));

  return eachDayOfInterval({ start: today, end: endDate })
    .filter((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return playDays.includes(getDay(date)) || specialPlayDates.includes(dateStr);
    })
    .filter(
      (date) =>
        isAfter(date, today) ||
        format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
    )
    .map((date) => format(date, "yyyy-MM-dd"));
}
