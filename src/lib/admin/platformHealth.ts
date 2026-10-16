import { addDays, eachDayOfInterval, format, parseISO, startOfDay, subDays } from 'date-fns';
import { isEligiblePlayDate } from '@/lib/availability';
import { effectiveThreshold } from '@/lib/schedule';
import { rollingSeries, tallyAt } from './adminEngagement';

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
  sessions: { game_id: string; date: string; created_at: string }[];
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
 */
function gameActivity(rows: Omit<GameRows, 'activity'>): number[] {
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
      return { ...rows, activity: gameActivity(rows) };
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
 * The earliest eligible play date from firstUpcoming through viableThrough on
 * which at least effectiveThreshold current players are marked available. Only
 * 'available' counts — not 'maybe' — matching the calendar's rule that a
 * positive claim reads confirmed yeses alone. Status is the row's current value
 * (edits aren't versioned), so rebuilt history is approximate for rows changed since.
 */
function firstViableDate(rows: GameRows, players: string[], at: Moment): ViableDate | null {
  const { game } = rows;
  const needed = effectiveThreshold(game.min_players_needed ?? 0, players.length);
  const playerSet = new Set(players);
  const counts = new Map<string, number>();
  for (const a of rows.availability) {
    if (a.status !== 'available' || a.date < at.firstUpcoming || a.date > at.viableThrough) continue;
    if (!playerSet.has(a.user_id) || !before(a.created_at, at.cutoff)) continue;
    counts.set(a.date, (counts.get(a.date) ?? 0) + 1);
  }

  const extraPlayDates = rows.playDates.filter((p) => before(p.created_at, at.cutoff)).map((p) => p.date.substring(0, 10));
  const windowEnd = game.campaign_end_date && game.campaign_end_date < at.viableThrough
    ? game.campaign_end_date
    : at.viableThrough;
  let best: ViableDate | null = null;
  for (const [date, available] of counts) {
    if (available < needed || (best && date >= best.date)) continue;
    if (game.campaign_start_date && date < game.campaign_start_date) continue;
    const eligible = isEligiblePlayDate({
      date: parseISO(date),
      playDays: game.play_days ?? [],
      extraPlayDates,
      today: parseISO(at.firstUpcoming),
      windowEnd: parseISO(windowEnd),
    });
    if (eligible) best = { date, available, needed };
  }
  return best;
}

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

// ── Activation funnel ──────────────────────────────────────

export interface FunnelCohort {
  windowEnd: string;
  signups: number;
  /** Joined someone's game or created their own. */
  joinedGame: number;
  enteredAvailability: number;
  /** In a game that had a session on or after the day they signed up. */
  gotSession: number;
}

/**
 * Activation funnel by signup cohort, on the engagement charts' rolling windows. Each step is "ever, so far" — younger
 * cohorts have had less time to convert, so the newest points read low until
 * they mature.
 */
export function buildFunnelCohorts(data: IndexedPlatform, now: Date, windows?: number): FunnelCohort[] {
  const endExclusive = startOfDay(now);

  const gamesByUser = new Map<string, Set<string>>();
  const usersWithAvailability = new Set<string>();
  const latestSessionByGame = new Map<string, string>();
  for (const rows of data.games) {
    for (const id of [rows.game.gm_id, ...rows.memberships.map((m) => m.user_id)]) {
      const set = gamesByUser.get(id);
      if (set) set.add(rows.game.id);
      else gamesByUser.set(id, new Set([rows.game.id]));
    }
    for (const a of rows.availability) usersWithAvailability.add(a.user_id);
    for (const s of rows.sessions) {
      const prev = latestSessionByGame.get(rows.game.id);
      if (!prev || s.date > prev) latestSessionByGame.set(rows.game.id, s.date);
    }
  }

  const empty = () => ({ signups: 0, joinedGame: 0, enteredAvailability: 0, gotSession: 0 });
  const tally = new Map<number, ReturnType<typeof empty>>();
  for (const u of data.users) {
    const t = tallyAt(tally, u.created_at, endExclusive, empty);
    if (!t) continue;
    t.signups++;

    const games = gamesByUser.get(u.id);
    if (games?.size) t.joinedGame++;
    if (usersWithAvailability.has(u.id)) t.enteredAvailability++;

    const signupDay = format(new Date(u.created_at), 'yyyy-MM-dd');
    if (games && [...games].some((id) => (latestSessionByGame.get(id) ?? '') >= signupDay)) {
      t.gotSession++;
    }
  }
  return rollingSeries(tally, endExclusive, windows, empty);
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
 * with a game night on the horizon never goes dormant.
 */
export function buildDormancy(data: IndexedPlatform, now: Date, windows?: number): DormancyBucket[] {
  const endExclusive = startOfDay(now);
  const yesterday = subDays(endExclusive, 1);
  const empty = () => ({ wentDormant: 0, revived: 0 });
  const tally = new Map<number, ReturnType<typeof empty>>();

  const firstCreated = data.games.reduce<string | null>(
    (min, g) => (min === null || g.game.created_at < min ? g.game.created_at : min),
    null
  );
  const start = firstCreated ? startOfDay(new Date(firstCreated)) : null;
  const days = start && start <= yesterday
    ? eachDayOfInterval({ start, end: yesterday }).map((d) => endOfDay(format(d, 'yyyy-MM-dd')))
    : [];

  for (const rows of data.games) {
    let wasDormant = false;
    for (const at of days) {
      if (!before(rows.game.created_at, at.cutoff)) continue;
      const dormant = classifyAt(rows, at).bucket === 'dormant';
      if (dormant !== wasDormant) {
        const t = tallyAt(tally, `${at.day}T00:00:00`, endExclusive, empty);
        if (t) t[dormant ? 'wentDormant' : 'revived']++;
      }
      wasDormant = dormant;
    }
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
