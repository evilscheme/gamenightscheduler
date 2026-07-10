import {
  addMonths,
  endOfMonth,
  eachDayOfInterval,
  format,
  isBefore,
  startOfDay,
} from "date-fns";
import { getSchedulingWindow } from "../schedule";
import { isEligiblePlayDate } from "./eligibleDates";
import type { SchedulingWindowMonths } from "../constants";

export interface AvailabilityRecord {
  user_id: string;
  date: string;
}

export interface PlayerCompletionParams {
  playerIds: string[];
  playDays: number[];
  schedulingWindowMonths: number;
  extraPlayDates: string[];
  availabilityRecords: AvailabilityRecord[];
  referenceDate?: Date;
  windowStart?: Date;
  windowEnd?: Date;
}

/**
 * Calculate the percentage of play dates each player has filled in their availability for.
 * Only counts future dates (today or later) that match play days or extra play dates.
 *
 * @returns A record mapping player IDs to their completion percentage (0-100)
 */
export function calculatePlayerCompletionPercentages({
  playerIds,
  playDays,
  schedulingWindowMonths,
  extraPlayDates,
  availabilityRecords,
  referenceDate = new Date(),
  windowStart,
  windowEnd,
}: PlayerCompletionParams): Record<string, number> {
  const today = startOfDay(referenceDate);
  const start = windowStart ?? today;
  const end = windowEnd ?? endOfMonth(addMonths(today, schedulingWindowMonths));

  if (isBefore(end, start)) return {};

  // Get all future play dates within the window
  const playDates = eachDayOfInterval({ start, end })
    .filter((date) => isEligiblePlayDate({ date, playDays, extraPlayDates, today }))
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

export interface GameFillRateParams {
  playerIds: string[];
  playDays: number[];
  schedulingWindowMonths: number;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
  extraPlayDates: string[];
  availabilityRecords: AvailabilityRecord[];
  referenceDate?: Date;
}

/**
 * Calculate a game's overall availability fill rate: the average completion
 * percentage across all players (0-100).
 *
 * The scheduling window is bounded by the game's campaign dates via
 * `getSchedulingWindow`, matching what players actually see in the app. Without
 * this bounding, games whose campaign ends before the full N-month window would
 * be scored against play dates beyond the campaign end, deflating the rate.
 */
export function calculateGameFillRate({
  playerIds,
  playDays,
  schedulingWindowMonths,
  campaignStartDate,
  campaignEndDate,
  extraPlayDates,
  availabilityRecords,
  referenceDate = new Date(),
}: GameFillRateParams): number {
  const { start, end } = getSchedulingWindow(
    {
      scheduling_window_months: schedulingWindowMonths as SchedulingWindowMonths,
      campaign_start_date: campaignStartDate,
      campaign_end_date: campaignEndDate,
    },
    referenceDate
  );

  const completionPercentages = calculatePlayerCompletionPercentages({
    playerIds,
    playDays,
    schedulingWindowMonths,
    extraPlayDates,
    availabilityRecords,
    referenceDate,
    windowStart: start,
    windowEnd: end,
  });

  const values = Object.values(completionPercentages);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, p) => sum + p, 0) / values.length);
}

/**
 * Get all play dates within the scheduling window.
 * Useful for determining the total number of dates a player should fill in.
 *
 * Note: This function is exported primarily for testing purposes, to enable
 * deterministic tests of calculatePlayerCompletionPercentages by providing
 * the expected play dates for a given reference date.
 */
export function getPlayDatesInWindow({
  playDays,
  schedulingWindowMonths,
  extraPlayDates,
  referenceDate = new Date(),
  windowStart,
  windowEnd,
}: Omit<PlayerCompletionParams, "playerIds" | "availabilityRecords">): string[] {
  const today = startOfDay(referenceDate);
  const start = windowStart ?? today;
  const end = windowEnd ?? endOfMonth(addMonths(today, schedulingWindowMonths));

  if (isBefore(end, start)) return [];

  return eachDayOfInterval({ start, end })
    .filter((date) => isEligiblePlayDate({ date, playDays, extraPlayDates, today }))
    .map((date) => format(date, "yyyy-MM-dd"));
}
