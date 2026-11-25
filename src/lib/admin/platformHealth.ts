import { addDays, differenceInCalendarDays, eachDayOfInterval, format, max, min, parseISO, startOfDay, subDays } from 'date-fns';
import { isEligiblePlayDate } from '@/lib/availability';
import { effectiveThreshold, getSchedulingWindow } from '@/lib/schedule';
import type { SchedulingWindowMonths } from '@/lib/constants';
import { getBucketIndex, rollingSeries, tallyAt } from './adminEngagement';

// ── Inputs ─────────────────────────────────────────────────

/**
 * Every row needed to rebuild the platform's state as of any past day. Each row
 * carries the timestamp it came into existence, so "as of day D" is just a
 * created-before filter. Deleted rows are gone, which is why reconstructed
 * history undercounts and live snapshots are preferred going forward.
 */
export interface PlatformInputs {
  users: { id: string; created_at: string }[];
  games: {
    id: string;
    gm_id: string;
    created_at: string;
    play_days: number[] | null;
    scheduling_window_months: number | null;
    campaign_start_date: string | null;
    campaign_end_date: string | null;
    min_players_needed: number | null;
  }[];
  memberships: { game_id: string; user_id: string; joined_at: string }[];
  sessions: { game_id: string; date: string; created_at: string; status: string }[];
  availability: { game_id: string; user_id: string; date: string; status: string; created_at: string; updated_at: string }[];
  playDates: { game_id: string; date: string; created_at: string }[];
}

/** How long a new user, or a game with nothing booked, gets before counting as unhealthy. */
export const GRACE_DAYS = 7;

/** A game with nothing booked and no activity for this long is dormant, and a
 *  user with no non-dormant game this long after signing up has churned. Both
 *  leave the health counts, so abandoned data doesn't pile up as permanent
 *  "unhealthy" rows. */
export const DORMANT_AFTER_DAYS = 60;

/** How far ahead a viable date still makes a game healthy. A booked session
 *  counts however far out it is; dates players filled in are a weaker
 *  commitment, so stale far-ahead entries shouldn't keep a game alive. */
export const VIABLE_DATE_WEEKS = 6;

// ── Indexing ───────────────────────────────────────────────

interface GameRows {
  game: PlatformInputs['games'][number];
  memberships: PlatformInputs['memberships'];
  sessions: PlatformInputs['sessions'];
  availability: PlatformInputs['availability'];
  playDates: PlatformInputs['playDates'];
  /** Every moment something touched the game, as epoch ms, ascending. */
  activity: number[];
  /** The game's 'available' answers by date, so checking a date reads that
   *  date's rows instead of rescanning the whole game's availability. */
  availableOn: Map<string, PlatformInputs['availability']>;
  /** The keys of availableOn, ascending. */
  availableDates: string[];
}

export interface IndexedPlatform {
  users: PlatformInputs['users'];
  games: GameRows[];
}

function groupBy<T extends { game_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(r.game_id);
    if (list) list.push(r);
    else map.set(r.game_id, [r]);
  }
  return map;
}

/**
 * What counts as activity on a game: creation, a player joining, a session
 * booked, availability entered or edited, an extra date added. Availability
 * edits overwrite updated_at, so only a row's first and latest touch are visible.
 * log_deletion() in supabase/schema.sql reads the same timestamps for a deleted
 * game's last_activity — change them together.
 */
function gameActivity(rows: Omit<GameRows, 'activity' | 'availableOn' | 'availableDates'>): number[] {
  const times = [Date.parse(rows.game.created_at)];
  for (const m of rows.memberships) times.push(Date.parse(m.joined_at));
  for (const s of rows.sessions) times.push(Date.parse(s.created_at));
  for (const a of rows.availability) {
    times.push(Date.parse(a.created_at));
    if (a.updated_at !== a.created_at) times.push(Date.parse(a.updated_at));
  }
  for (const p of rows.playDates) times.push(Date.parse(p.created_at));
  return times.sort((a, b) => a - b);
}

/** Group rows by game once, so a multi-day backfill doesn't rescan every table per day. */
export function indexPlatform(inputs: PlatformInputs): IndexedPlatform {
  const memberships = groupBy(inputs.memberships);
  const sessions = groupBy(inputs.sessions);
  const availability = groupBy(inputs.availability);
  const playDates = groupBy(inputs.playDates);

  return {
    users: inputs.users,
    games: inputs.games.map((game) => {
      const rows = {
        game,
        memberships: memberships.get(game.id) ?? [],
        sessions: sessions.get(game.id) ?? [],
        availability: availability.get(game.id) ?? [],
        playDates: playDates.get(game.id) ?? [],
      };
      const availableOn = new Map<string, PlatformInputs['availability']>();
      for (const a of rows.availability) {
        if (a.status !== 'available') continue;
        const list = availableOn.get(a.date);
        if (list) list.push(a);
        else availableOn.set(a.date, [a]);
      }
      return {
        ...rows,
        activity: gameActivity(rows),
        availableOn,
        availableDates: [...availableOn.keys()].sort(),
      };
    }),
  };
}

// ── Health buckets ─────────────────────────────────────────

/**
 * Every game is in exactly one bucket, healthiest first:
 * - healthyBooked: at least one player besides the host, and a session on an
 *   upcoming date. However quiet the app gets in between — usage is bursty:
 *   everyone enters dates far ahead, the GM books a batch, then nobody visits
 *   until the next batch — a game with sessions on the books is healthy.
 * - healthyViable: at least one player besides the host, nothing booked, but an
 *   eligible play date within VIABLE_DATE_WEEKS that enough players
 *   (effectiveThreshold, as on the calendar) are marked available for. Many
 *   groups find their date here and confirm it in Discord without booking; they
 *   keep coming back week after week, like booked groups do.
 * - gettingGoing: neither, but activity within GRACE_DAYS.
 * - unhealthy: neither, quiet for GRACE_DAYS up to DORMANT_AFTER_DAYS.
 * - dormant: neither, quiet for DORMANT_AFTER_DAYS or more.
 *
 * A user is in the best bucket of their games (as host or player), so a player
 * in a healthy game is healthy whether or not they've entered dates — they have
 * a game to go to. A user with no game counts as gettingGoing for GRACE_DAYS
 * after signing up, unhealthy until DORMANT_AFTER_DAYS, then churned; a user
 * whose games are all dormant is churned once past DORMANT_AFTER_DAYS too.
 */
export const HEALTH_BUCKET_ORDER = ['healthyBooked', 'healthyViable', 'gettingGoing', 'unhealthy', 'dormant'] as const;
export type HealthBucket = (typeof HEALTH_BUCKET_ORDER)[number];

export const isHealthy = (bucket: HealthBucket) => bucket === 'healthyBooked' || bucket === 'healthyViable';

const rank = (bucket: HealthBucket) => HEALTH_BUCKET_ORDER.indexOf(bucket);

/** The earliest upcoming date enough players can make. */
export interface ViableDate {
  date: string; // yyyy-MM-dd
  available: number;
  needed: number;
}

export interface GameStatus {
  bucket: HealthBucket;
  /** Set when bucket is 'healthyViable'. */
  viableDate: ViableDate | null;
  /** Latest activity of any kind (see gameActivity), epoch ms. */
  lastActivity: number;
}

/** The moment a classification is made, precomputed once so per-game checks stay cheap. */
interface Moment {
  day: string; // yyyy-MM-dd
  /** Rows count if created before this, epoch ms. */
  cutoff: number;
  /** First date that counts as upcoming. */
  firstUpcoming: string;
  /** Last date (inclusive) a viable date can fall on. */
  viableThrough: string;
  graceSince: number;
  dormantSince: number;
}

/** `reference` is both the cutoff and the first upcoming day. */
function momentAt(day: string, reference: Date): Moment {
  return {
    day,
    cutoff: reference.getTime(),
    firstUpcoming: format(reference, 'yyyy-MM-dd'),
    viableThrough: format(addDays(reference, VIABLE_DATE_WEEKS * 7 - 1), 'yyyy-MM-dd'),
    graceSince: subDays(reference, GRACE_DAYS).getTime(),
    dormantSince: subDays(reference, DORMANT_AFTER_DAYS).getTime(),
  };
}

/** The end of `day`, as if it were midnight the next morning: "upcoming" means after `day`. */
const endOfDay = (day: string) => momentAt(day, startOfDay(addDays(parseISO(day), 1)));

/** Right now: a session later today still counts as upcoming. */
const rightNow = (now: Date) => momentAt(format(now, 'yyyy-MM-dd'), now);

const before = (ts: string, cutoffMs: number) => Date.parse(ts) < cutoffMs;

/** Host first, then members who had joined by the cutoff. */
function playersAt(rows: GameRows, cutoff: number): string[] {
  const players = [rows.game.gm_id];
  for (const m of rows.memberships) if (before(m.joined_at, cutoff)) players.push(m.user_id);
  return players;
}

/**
 * The earliest date from `from` through `through` (yyyy-MM-dd, inclusive) that
 * was workable as of `cutoff`: an eligible play date on the game's calendar as
 * seen from `from` — its scheduling window, campaign bounds included, and the
 * play days or extra dates added by then — on which at least effectiveThreshold
 * of `players` were marked available. Only 'available' counts — not 'maybe' —
 * matching the calendar's rule that a positive claim reads confirmed yeses
 * alone. Status is the row's current value (edits aren't versioned), so rebuilt
 * history is approximate for rows changed since.
 *
 * The one "could this date happen" rule: the health buckets ask it of the next
 * VIABLE_DATE_WEEKS, the game-nights chart of a single past day.
 */
function firstWorkableDate(
  rows: GameRows,
  players: string[],
  from: string,
  through: string,
  cutoff: number
): ViableDate | null {
  const { game } = rows;
  const needed = effectiveThreshold(game.min_players_needed ?? 0, players.length);
  const playerSet = new Set(players);
  const calendar = getSchedulingWindow(
    { ...game, scheduling_window_months: (game.scheduling_window_months ?? 2) as SchedulingWindowMonths },
    parseISO(from)
  );
  const horizon = parseISO(through);
  let extraPlayDates: string[] | null = null;

  // First answered date on or after `from` (availableDates is ascending).
  const dates = rows.availableDates;
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] < from) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < dates.length && dates[i] <= through; i++) {
    const date = dates[i];
    let available = 0;
    for (const a of rows.availableOn.get(date) ?? []) {
      if (playerSet.has(a.user_id) && before(a.created_at, cutoff)) available++;
    }
    if (available < needed) continue;
    extraPlayDates ??= rows.playDates.filter((p) => before(p.created_at, cutoff)).map((p) => p.date.substring(0, 10));
    const eligible = isEligiblePlayDate({
      date: parseISO(date),
      playDays: game.play_days ?? [],
      extraPlayDates,
      today: calendar.start,
      windowEnd: calendar.end < horizon ? calendar.end : horizon,
    });
    if (eligible) return { date, available, needed };
  }
  return null;
}

/** The earliest upcoming date, within VIABLE_DATE_WEEKS, that enough current players can make. */
const firstViableDate = (rows: GameRows, players: string[], at: Moment) =>
  firstWorkableDate(rows, players, at.firstUpcoming, at.viableThrough, at.cutoff);

function classifyAt(rows: GameRows, at: Moment): GameStatus {
  let lastActivity = Date.parse(rows.game.created_at);
  for (let i = rows.activity.length - 1; i >= 0; i--) {
    if (rows.activity[i] < at.cutoff) {
      lastActivity = rows.activity[i];
      break;
    }
  }

  const players = playersAt(rows, at.cutoff);
  if (players.length > 1) {
    if (rows.sessions.some((s) => s.date >= at.firstUpcoming && before(s.created_at, at.cutoff))) {
      return { bucket: 'healthyBooked', viableDate: null, lastActivity };
    }
    const viableDate = firstViableDate(rows, players, at);
    if (viableDate) return { bucket: 'healthyViable', viableDate, lastActivity };
  }
  const bucket = lastActivity >= at.graceSince ? 'gettingGoing' : lastActivity >= at.dormantSince ? 'unhealthy' : 'dormant';
  return { bucket, viableDate: null, lastActivity };
}

/** Every game's status right now — what the admin games list, Overview tiles
 *  and distribution bars show, classified exactly as the trend charts are. */
export function currentGameStatuses(data: IndexedPlatform, now: Date): Map<string, GameStatus> {
  const at = rightNow(now);
  return new Map(data.games.map((rows) => [rows.game.id, classifyAt(rows, at)]));
}

// ── Counts ─────────────────────────────────────────────────

/** How many users or games are in each tracked bucket. The rest of `total` is
 *  left out of the health counts: dormant games, churned users. */
export interface StateCounts {
  total: number;
  healthyBooked: number;
  healthyViable: number;
  gettingGoing: number;
  unhealthy: number;
}

export interface PlatformCounts {
  users: StateCounts;
  games: StateCounts;
}

export interface DailyPlatformStats extends PlatformCounts {
  day: string; // yyyy-MM-dd
}

/** Users or games still in play: everything but dormant games / churned users. */
export const liveCount = (c: StateCounts) => c.healthyBooked + c.healthyViable + c.gettingGoing + c.unhealthy;

/** Percent of live users or games that are healthy, or null when none are live. */
export function healthyShare(c: StateCounts): number | null {
  const live = liveCount(c);
  return live > 0 ? Math.round(((c.healthyBooked + c.healthyViable) / live) * 100) : null;
}

function emptyCounts(): StateCounts {
  return { total: 0, healthyBooked: 0, healthyViable: 0, gettingGoing: 0, unhealthy: 0 };
}

function countAt(data: IndexedPlatform, at: Moment): DailyPlatformStats {
  const games = emptyCounts();
  const bestByUser = new Map<string, HealthBucket>();
  for (const rows of data.games) {
    if (!before(rows.game.created_at, at.cutoff)) continue;
    games.total++;
    const { bucket } = classifyAt(rows, at);
    if (bucket !== 'dormant') games[bucket]++;
    for (const id of playersAt(rows, at.cutoff)) {
      const prev = bestByUser.get(id);
      if (!prev || rank(bucket) < rank(prev)) bestByUser.set(id, bucket);
    }
  }

  const users = emptyCounts();
  for (const u of data.users) {
    const created = Date.parse(u.created_at);
    if (created >= at.cutoff) continue;
    users.total++;
    const best = bestByUser.get(u.id) ?? 'dormant';
    if (isHealthy(best)) users[best]++;
    else if (best === 'gettingGoing' || created >= at.graceSince) users.gettingGoing++;
    else if (best === 'unhealthy' || created >= at.dormantSince) users.unhealthy++;
  }

  return { day: at.day, users, games };
}

/** The platform at the end of `day` (server-local day, UTC in production). */
export const computeDailyStats = (data: IndexedPlatform, day: string) => countAt(data, endOfDay(day));

/** The same counts right now, for the admin Overview tiles. */
export const computeCurrentStats = (data: IndexedPlatform, now: Date) => countAt(data, rightNow(now));

// ── Bucket timeline ────────────────────────────────────────

/**
 * Every game's bucket at the end of each day, through yesterday. The charts that
 * walk history (dormancy, the funnel) read it, so a request classifies each
 * game-day once however many charts ask.
 */
export interface BucketTimeline {
  /** The days classified, yyyy-MM-dd, consecutive and ascending. */
  days: string[];
  /** Per game id, its bucket at the end of each of `days`; null before it existed. */
  buckets: Map<string, (HealthBucket | null)[]>;
}

/** Position of `day` in the timeline's days; out of range when it isn't covered. */
const dayIndex = (timeline: BucketTimeline, day: string) =>
  timeline.days.length ? differenceInCalendarDays(parseISO(day), parseISO(timeline.days[0])) : -1;

/** The bucket game `gameId` was in at the end of `day`, or null before the game
 *  existed or outside the timeline's range. */
export function bucketOn(timeline: BucketTimeline, gameId: string, day: string): HealthBucket | null {
  return timeline.buckets.get(gameId)?.[dayIndex(timeline, day)] ?? null;
}

/**
 * Classify every game at the end of every day its consumers read. Each day is
 * classified from scratch, so a bounded range needs only those days, not all of
 * history: dormancy reads from the day before its range (for the starting
 * state), the funnel from the first signup day of its earliest pooled cohort.
 * Without `windows` ("all time") it covers every day since the first game.
 */
export function buildBucketTimeline(data: IndexedPlatform, now: Date, windows?: number): BucketTimeline {
  const endExclusive = startOfDay(now);
  const yesterday = subDays(endExclusive, 1);

  const firstCreated = data.games.reduce<string | null>(
    (first, g) => (first === null || g.game.created_at < first ? g.game.created_at : first),
    null
  );
  const firstDay = firstCreated ? startOfDay(new Date(firstCreated)) : null;
  const rangeStart = windows != null
    ? min([subDays(endExclusive, windows * 7 + 1), subDays(endExclusive, (windows + FUNNEL_POOL_WEEKS - 1) * 7)])
    : null;
  const start = firstDay && rangeStart ? max([firstDay, rangeStart]) : firstDay;
  const days = start && start <= yesterday
    ? eachDayOfInterval({ start, end: yesterday }).map((d) => format(d, 'yyyy-MM-dd'))
    : [];
  const moments = days.map(endOfDay);

  const buckets = new Map<string, (HealthBucket | null)[]>();
  for (const rows of data.games) {
    buckets.set(
      rows.game.id,
      moments.map((at) => (before(rows.game.created_at, at.cutoff) ? classifyAt(rows, at).bucket : null))
    );
  }
  return { days, buckets };
}

// ── Activation funnel ──────────────────────────────────────

/** How long after signing up a funnel step still counts. A fixed window, so a
 *  cohort's numbers stop moving once it has had the whole of it, and an old
 *  cohort isn't credited for something that happened months later. */
export const FUNNEL_WINDOW_DAYS = 21;

/** How many weekly signup cohorts each funnel point pools. A single week's
 *  handful of signups swings too far to read; the point still advances weekly. */
export const FUNNEL_POOL_WEEKS = 4;

export interface FunnelCohort {
  windowEnd: string;
  /** Signups in the FUNNEL_POOL_WEEKS rolling windows ending at windowEnd. */
  signups: number;
  /** Joined someone's game or created their own. */
  joinedGame: number;
  enteredAvailability: number;
  /** In a game that was healthy — booked or with a date found — while they were in it. */
  foundGameNight: number;
  /** In a game with a session booked, or played, while they were in it. Never more than foundGameNight. */
  bookedGameNight: number;
  /** Every signup in the point has had its full FUNNEL_WINDOW_DAYS; until then the counts can still rise. */
  mature: boolean;
}

/**
 * Activation funnel by signup cohort, on the engagement charts' rolling windows.
 * Each point pools the FUNNEL_POOL_WEEKS windows ending there, and each step
 * counts only if reached within FUNNEL_WINDOW_DAYS of signing up — so a cohort's
 * numbers settle once it is `mature`, instead of reading low until they do. A
 * game night is read off the same buckets the health charts use: found when the
 * user's game was healthy on a day they were in it, booked when it was
 * healthyBooked, so the funnel and the health charts agree on what "working" is.
 * A session played on a day they were in the game counts as booked too, as it
 * does on the Game Nights chart.
 */
export function buildFunnelCohorts(
  data: IndexedPlatform,
  now: Date,
  windows?: number,
  timeline: BucketTimeline = buildBucketTimeline(data, now, windows)
): FunnelCohort[] {
  const endExclusive = startOfDay(now);
  const yesterday = format(subDays(endExclusive, 1), 'yyyy-MM-dd');
  const dayOf = (ts: string) => format(new Date(ts), 'yyyy-MM-dd');

  // Each user's games, with when they came into each (created it, or joined),
  // and when they first entered availability anywhere.
  const gamesByUser = new Map<string, { rows: GameRows; since: number; sinceDay: string }[]>();
  const firstAnswer = new Map<string, number>();
  for (const rows of data.games) {
    const entries = [
      { userId: rows.game.gm_id, at: rows.game.created_at },
      ...rows.memberships.map((m) => ({ userId: m.user_id, at: m.joined_at })),
    ];
    for (const { userId, at } of entries) {
      const entry = { rows, since: Date.parse(at), sinceDay: dayOf(at) };
      const list = gamesByUser.get(userId);
      if (list) list.push(entry);
      else gamesByUser.set(userId, [entry]);
    }
    for (const a of rows.availability) {
      const created = Date.parse(a.created_at);
      const prev = firstAnswer.get(a.user_id);
      if (prev === undefined || created < prev) firstAnswer.set(a.user_id, created);
    }
  }

  // A bounded range tallies FUNNEL_POOL_WEEKS - 1 extra windows, so even its
  // first point is fully pooled.
  const weeks = windows != null ? windows + FUNNEL_POOL_WEEKS - 1 : undefined;
  const empty = () => ({ signups: 0, joinedGame: 0, enteredAvailability: 0, foundGameNight: 0, bookedGameNight: 0 });
  const tally = new Map<number, ReturnType<typeof empty>>();
  for (const u of data.users) {
    const index = getBucketIndex(u.created_at, endExclusive);
    if (index === null || (weeks != null && index >= weeks)) continue;
    const t = tallyAt(tally, u.created_at, endExclusive, empty);
    if (!t) continue;
    t.signups++;

    const signupDay = startOfDay(new Date(u.created_at));
    const signup = format(signupDay, 'yyyy-MM-dd');
    const lastDay = format(addDays(signupDay, FUNNEL_WINDOW_DAYS), 'yyyy-MM-dd');
    const deadline = startOfDay(addDays(signupDay, FUNNEL_WINDOW_DAYS + 1)).getTime();

    const games = (gamesByUser.get(u.id) ?? []).filter((g) => g.since < deadline);
    if (games.length) t.joinedGame++;
    if ((firstAnswer.get(u.id) ?? Infinity) < deadline) t.enteredAvailability++;

    // A game night counts on a day they were in the game: from the day they came
    // in (never before signing up) through the window's last day, and only days
    // already over — today's bucket isn't settled yet.
    const through = lastDay < yesterday ? lastDay : yesterday;
    let found = false;
    let booked = false;
    for (const { rows, sinceDay } of games) {
      const from = sinceDay > signup ? sinceDay : signup;
      // A session played on one of those days is a booked game night whatever the
      // buckets say. An end-of-day bucket only sees sessions still ahead, so it
      // misses one booked and played the same day, and one played the day they joined.
      const played = rows.sessions.some(
        (s) => s.date >= from && s.date <= through && playersAt(rows, endOfDay(s.date).cutoff).length > 1
      );
      if (played) {
        found = booked = true;
        break;
      }
      const buckets = timeline.buckets.get(rows.game.id);
      if (!buckets) continue;
      for (let i = Math.max(0, dayIndex(timeline, from)); i < timeline.days.length && timeline.days[i] <= through; i++) {
        const bucket = buckets[i];
        if (bucket === 'healthyBooked') booked = true;
        if (bucket && isHealthy(bucket)) found = true;
        if (booked) break;
      }
      if (booked) break;
    }
    if (found) t.foundGameNight++;
    if (booked) t.bookedGameNight++;
  }

  const weekly = rollingSeries(tally, endExclusive, weeks, empty);
  const first = windows != null ? weekly.length - windows : 0;
  return weekly.slice(first).map((point, j) => {
    // All time pools whatever windows exist before the earliest points.
    const i = first + j;
    const pooled = weekly.slice(Math.max(0, i - FUNNEL_POOL_WEEKS + 1), i + 1);
    const sum = (key: keyof ReturnType<typeof empty>) => pooled.reduce((n, w) => n + w[key], 0);
    return {
      windowEnd: point.windowEnd,
      signups: sum('signups'),
      joinedGame: sum('joinedGame'),
      enteredAvailability: sum('enteredAvailability'),
      foundGameNight: sum('foundGameNight'),
      bookedGameNight: sum('bookedGameNight'),
      // The newest signups in the point joined on windowEnd.
      mature: format(addDays(parseISO(point.windowEnd), FUNNEL_WINDOW_DAYS), 'yyyy-MM-dd') <= yesterday,
    };
  });
}

// ── Game nights ────────────────────────────────────────────

export interface GameNightsBucket {
  windowEnd: string;
  /** People in a game with a session whose play date fell in the window. */
  booked: number;
  /** People not in `booked` whose game had, that window, a date enough of them could make. */
  dateFound: number;
}

/**
 * How many people had a game night each week, on the engagement charts' rolling
 * windows. Distinct people per window, so someone in two games counts once:
 * - booked: each session played in the window, its game's roster as of the end
 *   of the play date (host plus members who had joined by then).
 * - dateFound: a game with no session counted that window, its roster as of the
 *   end of a day in the window that was workable by the calendar's rule
 *   (firstWorkableDate, as of that day) — groups that settle the date in the app
 *   and confirm it elsewhere. Someone already booked that window isn't counted again.
 * A host alone is nobody's game night.
 */
export function buildGameNights(data: IndexedPlatform, now: Date, windows?: number): GameNightsBucket[] {
  const endExclusive = startOfDay(now);
  const empty = () => ({ booked: new Set<string>(), dateFound: new Set<string>() });
  const tally = new Map<number, ReturnType<typeof empty>>();
  // Bounded ranges skip work on windows rollingSeries would drop anyway.
  const inRange = (index: number | null): index is number => index !== null && (windows == null || index < windows);

  for (const rows of data.games) {
    const bookedWindows = new Set<number>();
    for (const s of rows.sessions) {
      if (s.status !== 'confirmed') continue;
      // A bare yyyy-MM-dd parses as UTC midnight; anchor it to local midnight.
      const day = `${s.date}T00:00:00`;
      const index = getBucketIndex(day, endExclusive);
      if (!inRange(index)) continue;
      const players = playersAt(rows, endOfDay(s.date).cutoff);
      if (players.length < 2) continue;
      bookedWindows.add(index);
      const t = tallyAt(tally, day, endExclusive, empty);
      if (t) for (const id of players) t.booked.add(id);
    }

    // Only a date someone answered 'available' to can be workable.
    for (const date of rows.availableDates) {
      const day = `${date}T00:00:00`;
      const index = getBucketIndex(day, endExclusive);
      if (!inRange(index) || bookedWindows.has(index)) continue;
      const { cutoff } = endOfDay(date);
      if (!before(rows.game.created_at, cutoff)) continue;
      const players = playersAt(rows, cutoff);
      if (players.length < 2 || !firstWorkableDate(rows, players, date, date, cutoff)) continue;
      const t = tallyAt(tally, day, endExclusive, empty);
      if (t) for (const id of players) t.dateFound.add(id);
    }
  }

  return rollingSeries(tally, endExclusive, windows, empty).map(({ windowEnd, booked, dateFound }) => ({
    windowEnd,
    booked: booked.size,
    dateFound: [...dateFound].filter((id) => !booked.has(id)).length,
  }));
}

// ── Dormancy ───────────────────────────────────────────────

export interface DormancyBucket {
  windowEnd: string;
  /** Games that became dormant during the window. */
  wentDormant: number;
  /** Dormant games that saw activity again during the window. */
  revived: number;
}

/**
 * Games going dormant and coming back. Walks each game's bucket day by day with
 * the same classification the daily counts use, so a game this chart calls
 * dormant is exactly one the health charts stopped counting — and a quiet game
 * with a game night on the horizon never goes dormant. `timeline` must reach
 * back to the day before the range (buildBucketTimeline's does).
 */
export function buildDormancy(
  data: IndexedPlatform,
  now: Date,
  windows?: number,
  timeline: BucketTimeline = buildBucketTimeline(data, now, windows)
): DormancyBucket[] {
  const endExclusive = startOfDay(now);
  const empty = () => ({ wentDormant: 0, revived: 0 });
  const tally = new Map<number, ReturnType<typeof empty>>();
  // Days before the range only set the starting state.
  const rangeStart = windows != null ? format(subDays(endExclusive, windows * 7), 'yyyy-MM-dd') : null;

  for (const rows of data.games) {
    const buckets = timeline.buckets.get(rows.game.id) ?? [];
    let wasDormant = false;
    timeline.days.forEach((day, i) => {
      const bucket = buckets[i];
      if (bucket == null) return;
      const dormant = bucket === 'dormant';
      if (dormant !== wasDormant && (rangeStart === null || day >= rangeStart)) {
        const t = tallyAt(tally, `${day}T00:00:00`, endExclusive, empty);
        if (t) t[dormant ? 'wentDormant' : 'revived']++;
      }
      wasDormant = dormant;
    });
  }
  return rollingSeries(tally, endExclusive, windows, empty);
}

// ── Deletions ──────────────────────────────────────────────

const DELETED_ENTITIES = ['user', 'game', 'session', 'membership'] as const;
export type DeletedEntity = (typeof DELETED_ENTITIES)[number];

export type DeletionBucket = { windowEnd: string } & Record<DeletedEntity, number>;

/**
 * Deliberate deletions per rolling window. Cascaded rows (a deleted game's
 * sessions) are dropped, so one action counts once.
 */
export function buildDeletions(
  rows: { entity: string; cascaded: boolean; deleted_at: string }[],
  now: Date,
  windows: number
): DeletionBucket[] {
  const endExclusive = startOfDay(now);
  const empty = () => ({ user: 0, game: 0, session: 0, membership: 0 });
  const tally = new Map<number, Record<DeletedEntity, number>>();
  for (const r of rows) {
    if (r.cascaded || !(DELETED_ENTITIES as readonly string[]).includes(r.entity)) continue;
    const t = tallyAt(tally, r.deleted_at, endExclusive, empty);
    if (t) t[r.entity as DeletedEntity]++;
  }
  // Windows past the requested range are dropped by rollingSeries' fixed count.
  return rollingSeries(tally, endExclusive, windows, empty);
}
