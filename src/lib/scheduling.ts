import {
  startOfDay,
  lastDayOfMonth,
  addMonths,
  max,
  min,
  parseISO,
} from "date-fns";
import { SchedulingWindowMonths } from "./constants";

interface SchedulingWindowGame {
  scheduling_window_months: SchedulingWindowMonths;
  campaign_start_date: string | null;
  campaign_end_date: string | null;
}

/**
 * Calculates the visible scheduling window for a game.
 *
 * The window is: max(campaign_start, today) -> min(campaign_end, today + N months).
 * When start > end, the range is empty (no valid dates).
 */
export function getSchedulingWindow(
  game: SchedulingWindowGame,
  referenceDate: Date = new Date()
): { start: Date; end: Date } {
  const today = startOfDay(referenceDate);
  const windowEnd = lastDayOfMonth(addMonths(today, game.scheduling_window_months));

  const start = game.campaign_start_date
    ? max([today, parseISO(game.campaign_start_date)])
    : today;

  const end = game.campaign_end_date
    ? min([windowEnd, parseISO(game.campaign_end_date)])
    : windowEnd;

  return { start, end };
}
