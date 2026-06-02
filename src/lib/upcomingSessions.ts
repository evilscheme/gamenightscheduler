import type { GameSession } from '@/types';
import { getSessionInstantMs, getDateInTimezone } from './timezone';

export type DayHighlight = 'today' | 'tomorrow' | null;

export interface GameDisplayInfo {
  name: string;
  timezone: string | null;
}

export interface UpcomingSessionRow {
  session: GameSession;
  gameId: string;
  gameName: string;
  gameTimezone: string | null;
  dayHighlight: DayHighlight;
}

/** Format a Date as YYYY-MM-DD in local time (matches how session dates are stored). */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today's date as YYYY-MM-DD in the user's local timezone. */
export function getTodayLocalDate(): string {
  return toLocalDateString(new Date());
}

/** Add one calendar day to a YYYY-MM-DD string, handling month/year rollover. */
function addOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 1);
  return toLocalDateString(date);
}

/**
 * Build sorted, game-named rows from raw sessions.
 *
 * Sessions are filtered to those still upcoming **in each game's own timezone**
 * (so a westward game's evening session isn't dropped once the viewer's local
 * date rolls over) and sorted by their true UTC instant (so cross-timezone
 * sessions read in real chronological order rather than by raw clock time).
 *
 * @param sessions Raw session rows (fetched with a one-day buffer below `today`).
 * @param games    Map of game_id -> { name, timezone }.
 * @param today    YYYY-MM-DD viewer-local date. Drives the today/tomorrow highlight.
 * @param nowMs    Current instant (epoch ms). Used to compute each game's local
 *                 "today" for the upcoming cutoff.
 */
export function buildUpcomingSessionRows(
  sessions: GameSession[],
  games: Map<string, GameDisplayInfo>,
  today: string,
  nowMs: number
): UpcomingSessionRow[] {
  const tomorrow = addOneDay(today);
  // Start-less sessions sort after timed ones on the same date.
  const instantOf = (s: GameSession, tz: string | null) =>
    getSessionInstantMs(s.date, s.start_time ?? '23:59:59', tz);

  return [...sessions]
    .filter((session) => {
      const tz = games.get(session.game_id)?.timezone ?? null;
      // A session is upcoming if its date is today-or-later in the game's tz.
      const gameToday = tz ? getDateInTimezone(nowMs, tz) : today;
      return session.date >= gameToday;
    })
    .sort((a, b) => {
      const tzA = games.get(a.game_id)?.timezone ?? null;
      const tzB = games.get(b.game_id)?.timezone ?? null;
      const ia = instantOf(a, tzA);
      const ib = instantOf(b, tzB);
      if (ia !== ib) return ia - ib;
      return (games.get(a.game_id)?.name ?? '').localeCompare(games.get(b.game_id)?.name ?? '');
    })
    .map((session) => ({
      session,
      gameId: session.game_id,
      gameName: games.get(session.game_id)?.name ?? 'Unknown game',
      gameTimezone: games.get(session.game_id)?.timezone ?? null,
      dayHighlight:
        session.date === today ? 'today' : session.date === tomorrow ? 'tomorrow' : null,
    }));
}
