import { useMemo } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { Availability, DateSuggestion, GameWithMembers } from '@/types';
import { getPlayDatesInWindow } from '@/lib/availability';
import { calculateDateSuggestions, getSchedulingWindow } from '@/lib/schedule';

export interface GameDerivedState {
  playDateEntries: { date: string; note: string | null }[];
  /** Dates that are true extra dates (not regular play days with notes) */
  extraDateStrings: string[];
  playDateNotes: Map<string, string>;
  specialPlayDatesSet: Set<string>;
  windowStart: Date;
  windowEnd: Date;
  completionByUserId: Map<string, { answered: number; total: number }>;
  suggestions: DateSuggestion[];
}

/**
 * Pure derived state for a game's scheduling views: play-date entries, the
 * scheduling window, per-player completion, and ranked date suggestions.
 * Shared by the game detail page and the admin read-only peek page so the
 * computation exists in one place.
 */
export function useGameDerivedState(
  game: GameWithMembers | null,
  allAvailability: Availability[],
  gamePlayDates: Array<{ date: string; note: string | null }>
): GameDerivedState {
  const playDateEntries = useMemo(() => {
    return gamePlayDates
      .map((r) => ({ date: r.date, note: r.note }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [gamePlayDates]);

  const extraDateStrings = useMemo(() => {
    const regularDays = new Set(game?.play_days ?? []);
    return playDateEntries
      .filter((d) => !regularDays.has(getDay(parseISO(d.date))))
      .map((d) => d.date);
  }, [playDateEntries, game?.play_days]);

  const playDateNotes = useMemo(
    () =>
      new Map(
        playDateEntries
          .filter((d) => d.note)
          .map((d) => [d.date, d.note!])
      ),
    [playDateEntries]
  );

  // `getSchedulingWindow` reads exactly these three fields (see its
  // SchedulingWindowGame parameter). Depending on them rather than the whole
  // `game` object keeps windowStart/windowEnd referentially stable across
  // refetches — they're passed as props deep into the calendar, so churning
  // them on every `game` identity change would cascade re-renders.
  const schedulingWindowMonths = game?.scheduling_window_months;
  const campaignStartDate = game?.campaign_start_date ?? null;
  const campaignEndDate = game?.campaign_end_date ?? null;

  const { start: windowStart, end: windowEnd } = useMemo(
    () =>
      schedulingWindowMonths !== undefined
        ? getSchedulingWindow({
            scheduling_window_months: schedulingWindowMonths,
            campaign_start_date: campaignStartDate,
            campaign_end_date: campaignEndDate,
          })
        : { start: startOfDay(new Date()), end: endOfMonth(addMonths(new Date(), 2)) },
    [schedulingWindowMonths, campaignStartDate, campaignEndDate]
  );

  const specialPlayDatesSet = useMemo(
    () => new Set(extraDateStrings),
    [extraDateStrings]
  );

  const completionByUserId = useMemo(() => {
    const map = new Map<string, { answered: number; total: number }>();
    if (!game) return map;
    const playDates = getPlayDatesInWindow({
      playDays: game.play_days,
      schedulingWindowMonths: game.scheduling_window_months,
      extraPlayDates: extraDateStrings,
      windowStart,
      windowEnd,
    });
    const total = playDates.length;
    const playDateSet = new Set(playDates);
    const allPlayers = [game.gm, ...game.members];
    for (const p of allPlayers) {
      const answered = allAvailability.filter(
        (a) => a.user_id === p.id && playDateSet.has(a.date)
      ).length;
      map.set(p.id, { answered, total });
    }
    return map;
  }, [game, allAvailability, extraDateStrings, windowStart, windowEnd]);

  const suggestions = useMemo(() => {
    if (!game) return [];

    const allPlayers = [game.gm, ...game.members];
    const today = startOfDay(new Date());

    // Get play dates within the scheduling window
    const playDates = isBefore(windowEnd, windowStart)
      ? []
      : eachDayOfInterval({ start: windowStart, end: windowEnd })
          .filter((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            return game.play_days.includes(getDay(date)) || extraDateStrings.includes(dateStr);
          })
          .filter(
            (date) =>
              isAfter(date, today) ||
              format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
          );

    return calculateDateSuggestions({
      playDates,
      players: allPlayers,
      availability: allAvailability,
      getDayOfWeek: getDay,
      formatDate: (date) => format(date, 'yyyy-MM-dd'),
      minPlayersNeeded: game.min_players_needed || 0,
    });
  }, [game, allAvailability, extraDateStrings, windowStart, windowEnd]);

  return {
    playDateEntries,
    extraDateStrings,
    playDateNotes,
    specialPlayDatesSet,
    windowStart,
    windowEnd,
    completionByUserId,
    suggestions,
  };
}
