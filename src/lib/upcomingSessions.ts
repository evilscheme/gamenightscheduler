import type { GameSession } from '@/types';

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
 * @param sessions Raw session rows (assumed already filtered to date >= today).
 * @param games    Map of game_id -> { name, timezone }.
 * @param today    YYYY-MM-DD reference for "today" (local). Drives the today/tomorrow highlight.
 */
export function buildUpcomingSessionRows(
  sessions: GameSession[],
  games: Map<string, GameDisplayInfo>,
  today: string
): UpcomingSessionRow[] {
  const tomorrow = addOneDay(today);

  return [...sessions]
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      // Same date: order by start_time, nulls last, then game name.
      const at = a.start_time ?? '99:99';
      const bt = b.start_time ?? '99:99';
      if (at !== bt) return at.localeCompare(bt);
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
