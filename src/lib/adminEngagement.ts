import { startOfDay, differenceInCalendarDays, subDays, format } from 'date-fns';

export interface EngagementBucket {
  windowEnd: string; // ISO date (yyyy-MM-dd) for the last day of the 7-day window
  newUsers: number;
  newGames: number;
  sessionsConfirmed: number;
  activeUsers: number;
}

export interface EngagementInputs {
  users: { created_at: string }[];
  games: { created_at: string }[];
  sessions: { created_at: string; status: string }[];
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
function getBucketIndex(date: string | Date, endExclusive: Date): number | null {
  const d = typeof date === 'string' ? new Date(date) : date;
  // Whole days between the row's day and today. 1 = yesterday, 7 = a week ago.
  // <= 0 means today or the future — incomplete, so excluded.
  const daysAgo = differenceInCalendarDays(endExclusive, d);
  if (daysAgo <= 0) return null;
  return Math.floor((daysAgo - 1) / 7);
}

/** Last day (yyyy-MM-dd) of the rolling window at `index`. Index 0 ends yesterday. */
function windowEndKey(index: number, endExclusive: Date): string {
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

interface BucketTally {
  newUsers: number;
  newGames: number;
  sessionsConfirmed: number;
  activeUsers: Set<string>;
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

  // Tally each metric by window index.
  const tally = new Map<number, BucketTally>();
  function ensure(index: number): BucketTally {
    let t = tally.get(index);
    if (!t) {
      t = { newUsers: 0, newGames: 0, sessionsConfirmed: 0, activeUsers: new Set() };
      tally.set(index, t);
    }
    return t;
  }

  for (const u of users) {
    const i = getBucketIndex(u.created_at, endExclusive);
    if (i !== null) ensure(i).newUsers++;
  }
  for (const g of games) {
    const i = getBucketIndex(g.created_at, endExclusive);
    if (i !== null) ensure(i).newGames++;
  }
  for (const s of sessions) {
    if (s.status !== 'confirmed') continue;
    const i = getBucketIndex(s.created_at, endExclusive);
    if (i !== null) ensure(i).sessionsConfirmed++;
  }
  for (const a of availability) {
    const i = getBucketIndex(a.updated_at, endExclusive);
    if (i !== null) ensure(i).activeUsers.add(a.user_id);
  }

  // Decide how many windows to emit. Bounded ranges emit exactly `windows`;
  // "all time" spans from window 0 through the oldest window that has data.
  let count: number;
  if (windows != null) {
    count = windows;
  } else {
    const maxIndex = tally.size ? Math.max(...tally.keys()) : -1;
    if (maxIndex < 0) return [];
    count = maxIndex + 1;
  }

  // Emit every window, zero-filling gaps. Chronological order (oldest first) is
  // descending index, since higher index = further in the past.
  const result: EngagementBucket[] = [];
  for (let index = count - 1; index >= 0; index--) {
    const t = tally.get(index);
    result.push({
      windowEnd: windowEndKey(index, endExclusive),
      newUsers: t?.newUsers ?? 0,
      newGames: t?.newGames ?? 0,
      sessionsConfirmed: t?.sessionsConfirmed ?? 0,
      activeUsers: t?.activeUsers.size ?? 0,
    });
  }
  return result;
}
