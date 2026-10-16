import { startOfDay, differenceInCalendarDays, subDays, format } from 'date-fns';

export interface EngagementBucket {
  windowEnd: string; // ISO date (yyyy-MM-dd) for the last day of the 7-day window
  newUsers: number;
  newGames: number;
  sessionsConfirmed: number;
  /** Sessions whose play date fell in the window — when the game actually happened. */
  sessionsPlayed: number;
  activeUsers: number;
}

export interface EngagementInputs {
  users: { created_at: string }[];
  games: { created_at: string }[];
  sessions: { created_at: string; date: string; status: string }[];
  availability: { user_id: string; updated_at: string }[];
}

/**
 * Rolling 7-day bucket index for a row, or null if the row falls on the current
 * (incomplete) day or in the future.
 *
 * Buckets are discrete, non-overlapping 7-day windows anchored on `endExclusive`
 * (midnight of the current day). Index 0 is the most recent complete window —
 * yesterday back through 7 days ago — and each higher index steps back another
 * 7 days. Because the anchor is "today", the newest window advances every day, so
 * fresh data shows up within a day instead of waiting for a calendar week to close.
 */
export function getBucketIndex(date: string | Date, endExclusive: Date): number | null {
  const d = typeof date === 'string' ? new Date(date) : date;
  // Whole days between the row's day and today. 1 = yesterday, 7 = a week ago.
  // <= 0 means today or the future — incomplete, so excluded.
  const daysAgo = differenceInCalendarDays(endExclusive, d);
  if (daysAgo <= 0) return null;
  return Math.floor((daysAgo - 1) / 7);
}

/** Last day (yyyy-MM-dd) of the rolling window at `index`. Index 0 ends yesterday. */
export function windowEndKey(index: number, endExclusive: Date): string {
  return format(subDays(endExclusive, 7 * index + 1), 'yyyy-MM-dd');
}

/**
 * Rolling 7-day bucket key (last day of the window) for a row, or null if the
 * row falls on the current incomplete day or in the future. Thin wrapper over the
 * index math — handy for callers that just need the key.
 */
export function getRollingBucketKey(date: string | Date, endExclusive: Date): string | null {
  const index = getBucketIndex(date, endExclusive);
  return index === null ? null : windowEndKey(index, endExclusive);
}

/** The ranges the admin charts offer, in weeks, besides "all time". */
export const WEEK_RANGES = [8, 12, 26] as const;
const DEFAULT_WEEKS = 12;

/** A `weeks` query param: one of WEEK_RANGES, null for 'all', else the default. */
export function parseWeeks(param: string | null): number | null {
  if (param === 'all') return null;
  const weeks = Number(param);
  return (WEEK_RANGES as readonly number[]).includes(weeks) ? weeks : DEFAULT_WEEKS;
}

/** Window-end keys for the last `count` windows, oldest first. */
export function windowEnds(count: number, endExclusive: Date): string[] {
  return Array.from({ length: count }, (_, i) => windowEndKey(count - 1 - i, endExclusive));
}

/** The tally entry for the window holding `date`, created from `empty` on first
 *  use; null for today or the future, which no window includes. */
export function tallyAt<T>(tally: Map<number, T>, date: string | Date, endExclusive: Date, empty: () => T): T | null {
  const index = getBucketIndex(date, endExclusive);
  if (index === null) return null;
  let t = tally.get(index);
  if (!t) {
    t = empty();
    tally.set(index, t);
  }
  return t;
}

/**
 * Emit a tally as a dense series, oldest window first, zero-filling empty
 * windows from `empty` so charts draw a continuous line. Bounded ranges emit
 * exactly `windows`; without it ("all time") the series runs from the oldest
 * window that has data, and is empty when nothing does.
 */
export function rollingSeries<T>(
  tally: Map<number, T>,
  endExclusive: Date,
  windows: number | undefined,
  empty: () => T
): (T & { windowEnd: string })[] {
  const count = windows ?? (tally.size ? Math.max(...tally.keys()) + 1 : 0);
  return windowEnds(count, endExclusive).map((windowEnd, i) => ({
    windowEnd,
    ...(tally.get(count - 1 - i) ?? empty()),
  }));
}

/**
 * Aggregate raw engagement rows into discrete rolling 7-day windows, sorted
 * chronologically (oldest first). The current day is excluded as incomplete, so
 * no window is ever built from partial data.
 *
 * The output is dense — every window in the range is emitted, empty ones as
 * zeros — so the charts render a continuous line rather than skipping gaps.
 *
 * @param inputs  Raw rows fetched from the database.
 * @param now     Reference "current time" used to anchor the rolling windows.
 * @param windows Number of trailing windows to emit (windows 0..windows-1). When
 *                omitted ("all time"), spans from window 0 through the oldest
 *                window that contains data.
 */
export function buildRollingEngagement(
  inputs: EngagementInputs,
  now: Date,
  windows?: number
): EngagementBucket[] {
  const { users, games, sessions, availability } = inputs;
  const endExclusive = startOfDay(now); // midnight today — today itself is incomplete

  const empty = () => ({
    newUsers: 0,
    newGames: 0,
    sessionsConfirmed: 0,
    sessionsPlayed: 0,
    activeUsers: new Set<string>(),
  });
  const tally = new Map<number, ReturnType<typeof empty>>();
  const at = (date: string) => tallyAt(tally, date, endExclusive, empty);

  for (const u of users) {
    const t = at(u.created_at);
    if (t) t.newUsers++;
  }
  for (const g of games) {
    const t = at(g.created_at);
    if (t) t.newGames++;
  }
  for (const s of sessions) {
    if (s.status !== 'confirmed') continue;
    const booked = at(s.created_at);
    if (booked) booked.sessionsConfirmed++;
    // Bucketed by play date, not booking date. A bare yyyy-MM-dd parses as UTC
    // midnight, so anchor it to local midnight to land on the right day.
    const played = at(`${s.date}T00:00:00`);
    if (played) played.sessionsPlayed++;
  }
  for (const a of availability) {
    const t = at(a.updated_at);
    if (t) t.activeUsers.add(a.user_id);
  }

  return rollingSeries(tally, endExclusive, windows, empty).map(({ activeUsers, ...rest }) => ({
    ...rest,
    activeUsers: activeUsers.size,
  }));
}
