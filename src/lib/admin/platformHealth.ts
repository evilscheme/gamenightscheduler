import { addDays, eachDayOfInterval, format, parseISO, startOfDay, subDays } from 'date-fns';
import { isEligiblePlayDate } from '@/lib/availability';
import { effectiveThreshold } from '@/lib/schedule';
import { getBucketIndex, windowEndKey } from './adminEngagement';

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

/** How far ahead a viable date (see GameState) still makes a game healthy. A
 *  booked session counts however far out it is; dates players filled in are a
 *  weaker commitment, so stale far-ahead entries shouldn't keep a game alive. */
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

/** Latest activity strictly before `cutoffMs`, or null if none. */
function lastActivityBefore(activity: number[], cutoffMs: number): number | null {
  for (let i = activity.length - 1; i >= 0; i--) {
    if (activity[i] < cutoffMs) return activity[i];
  }
  return null;
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

// ── Health states ──────────────────────────────────────────

/**
 * - healthy: has at least one player (besides the host), and either
 *     - booked: a session on an upcoming date, or
 *     - viableDate: an eligible play date within VIABLE_DATE_WEEKS where enough
 *       players (effectiveThreshold, as on the calendar) are marked available.
 *       Many groups find their date here but confirm it in Discord, never
 *       pressing "book"; those groups are playing, and look it — they keep
 *       coming back week after week, like booked groups do.
 *   However quiet the app gets in between — usage is bursty: everyone enters
 *   dates far ahead, the GM books a batch, then nobody visits until the next
 *   batch — a game with a game night on the horizon is healthy.
 * - gettingGoing: neither, but activity within GRACE_DAYS.
 * - unhealthy: neither, quiet for GRACE_DAYS up to DORMANT_AFTER_DAYS.
 * - dormant: neither, quiet for DORMANT_AFTER_DAYS or more.
 */
export type GameState = 'healthy' | 'gettingGoing' | 'unhealthy' | 'dormant';

/** What made a healthy game healthy. */
export type HealthyBy = 'booked' | 'viableDate';

/** The earliest upcoming date enough players can make. */
export interface ViableDate {
  date: string; // yyyy-MM-dd
  available: number;
  needed: number;
}

interface Classification {
  state: GameState;
  healthyBy: HealthyBy | null;
  viable: ViableDate | null;
}

/** Best first: a user's state follows the best of their games, and a booked game
 *  outranks one with only a viable date. */
function rankOf(c: Classification): number {
  if (c.state === 'healthy') return c.healthyBy === 'booked' ? 0 : 1;
  return { gettingGoing: 2, unhealthy: 3, dormant: 4 }[c.state];
}

/** The end of a day, precomputed once so per-game checks stay cheap. */
interface DayEnd {
  day: string; // yyyy-MM-dd
  /** Midnight after `day`, epoch ms: rows count if created before it. */
  cutoff: number;
  /** First date that counts as upcoming. */
  nextDay: string;
  /** Last date (inclusive) a viable date can fall on. */
  viableThrough: string;
  graceSince: number;
  dormantSince: number;
}

function dayEnd(day: string): DayEnd {
  const reference = startOfDay(addDays(parseISO(day), 1));
  return {
    day,
    cutoff: reference.getTime(),
    nextDay: format(reference, 'yyyy-MM-dd'),
    viableThrough: format(addDays(reference, VIABLE_DATE_WEEKS * 7 - 1), 'yyyy-MM-dd'),
    graceSince: subDays(reference, GRACE_DAYS).getTime(),
    dormantSince: subDays(reference, DORMANT_AFTER_DAYS).getTime(),
  };
}

const before = (ts: string, cutoffMs: number) => Date.parse(ts) < cutoffMs;

/** Host first, then members who had joined by the cutoff. */
function playersAt(rows: GameRows, cutoff: number): string[] {
  const players = [rows.game.gm_id];
  for (const m of rows.memberships) if (before(m.joined_at, cutoff)) players.push(m.user_id);
  return players;
}

/**
 * The earliest eligible play date from the day after the cutoff through
 * VIABLE_DATE_WEEKS on which at least effectiveThreshold current players are
 * marked available. Only 'available' counts — not 'maybe' — matching the
 * calendar's rule that a positive claim reads confirmed yeses alone. Status is
 * the row's current value (edits aren't versioned), so rebuilt history is
 * approximate for rows changed since.
 */
function firstViableDate(rows: GameRows, players: string[], end: DayEnd): ViableDate | null {
  const { game } = rows;
  const needed = effectiveThreshold(game.min_players_needed ?? 0, players.length);
  const playerSet = new Set(players);
  const counts = new Map<string, number>();
  for (const a of rows.availability) {
    if (a.status !== 'available' || a.date < end.nextDay || a.date > end.viableThrough) continue;
    if (!playerSet.has(a.user_id) || !before(a.created_at, end.cutoff)) continue;
    counts.set(a.date, (counts.get(a.date) ?? 0) + 1);
  }

  const extraPlayDates = rows.playDates.filter((p) => before(p.created_at, end.cutoff)).map((p) => p.date.substring(0, 10));
  const windowEnd = game.campaign_end_date && game.campaign_end_date < end.viableThrough
    ? game.campaign_end_date
    : end.viableThrough;
  let best: ViableDate | null = null;
  for (const [date, available] of counts) {
    if (available < needed || (best && date >= best.date)) continue;
    if (game.campaign_start_date && date < game.campaign_start_date) continue;
    const eligible = isEligiblePlayDate({
      date: parseISO(date),
      playDays: game.play_days ?? [],
      extraPlayDates,
      today: parseISO(end.nextDay),
      windowEnd: parseISO(windowEnd),
    });
    if (eligible) best = { date, available, needed };
  }
  return best;
}

/** A game's classification at the end of a day. The game must already exist then. */
function classifyAt(rows: GameRows, end: DayEnd): Classification {
  const players = playersAt(rows, end.cutoff);
  if (players.length > 1) {
    if (rows.sessions.some((s) => s.date >= end.nextDay && before(s.created_at, end.cutoff))) {
      return { state: 'healthy', healthyBy: 'booked', viable: null };
    }
    const viable = firstViableDate(rows, players, end);
    if (viable) return { state: 'healthy', healthyBy: 'viableDate', viable };
  }
  const last = lastActivityBefore(rows.activity, end.cutoff) ?? Date.parse(rows.game.created_at);
  const state = last >= end.graceSince ? 'gettingGoing' : last >= end.dormantSince ? 'unhealthy' : 'dormant';
  return { state, healthyBy: null, viable: null };
}

// ── Current state ──────────────────────────────────────────

/** The same check as a day's end, applied at an arbitrary moment: rows count if
 *  created before `now`, and a session today still counts as upcoming. */
function momentEnd(now: Date): DayEnd {
  const today = format(now, 'yyyy-MM-dd');
  return {
    day: today,
    cutoff: now.getTime(),
    nextDay: today,
    viableThrough: format(addDays(now, VIABLE_DATE_WEEKS * 7 - 1), 'yyyy-MM-dd'),
    graceSince: subDays(now, GRACE_DAYS).getTime(),
    dormantSince: subDays(now, DORMANT_AFTER_DAYS).getTime(),
  };
}

export interface GameStatus {
  state: GameState;
  healthyBy: HealthyBy | null;
  /** Set when healthyBy is 'viableDate'. */
  viable: ViableDate | null;
  /** Latest activity of any kind (see gameActivity), ISO. */
  lastActivity: string;
}

/**
 * Every game's state right now — for the admin games list, Overview tile and
 * distribution bars, so they classify games exactly as the trend charts do.
 */
export function currentGameStatuses(data: IndexedPlatform, now: Date): Map<string, GameStatus> {
  const end = momentEnd(now);
  const result = new Map<string, GameStatus>();
  for (const rows of data.games) {
    if (!before(rows.game.created_at, end.cutoff)) continue;
    const last = lastActivityBefore(rows.activity, end.cutoff) ?? Date.parse(rows.game.created_at);
    result.set(rows.game.id, { ...classifyAt(rows, end), lastActivity: new Date(last).toISOString() });
  }
  return result;
}

// ── Daily state ────────────────────────────────────────────

/** Counts at the end of a day. Dormant games and churned users are the
 *  remainder: total minus the three tracked states. */
export interface DailyPlatformStats {
  day: string; // yyyy-MM-dd
  totalUsers: number;
  /** Healthy users split by their best game's evidence (HealthyBy). */
  healthyBookedUsers: number;
  healthyViableUsers: number;
  gettingGoingUsers: number;
  unhealthyUsers: number;
  totalGames: number;
  healthyBookedGames: number;
  healthyViableGames: number;
  gettingGoingGames: number;
  unhealthyGames: number;
}

/**
 * The platform's state at the end of `day` (server-local day, UTC in production),
 * evaluated as if it were midnight the next morning: rows count only if they
 * existed by then, and "upcoming" means a play date after `day`.
 *
 * Games are classified by GameState. A user's state follows their best game (as
 * host or player), so a player in a healthy game is healthy whether or not
 * they've entered dates — they have a game to go to. Otherwise a user is
 *   - gettingGoing: signed up within GRACE_DAYS, or in a game that's getting going;
 *   - unhealthy: in an unhealthy game, or has no live game but signed up less
 *     than DORMANT_AFTER_DAYS ago (never joined, or their games died young);
 *   - churned (not counted): no non-dormant game, and here DORMANT_AFTER_DAYS or more.
 */
export function computeDailyStats(data: IndexedPlatform, day: string): DailyPlatformStats {
  return statsAt(data, dayEnd(day));
}

/** The same counts right now (`day` is today), for the admin Overview tiles. */
export function computeCurrentStats(data: IndexedPlatform, now: Date): DailyPlatformStats {
  return statsAt(data, momentEnd(now));
}

function statsAt(data: IndexedPlatform, end: DayEnd): DailyPlatformStats {

  // Counts per rank (see rankOf): booked, viable, gettingGoing, unhealthy, dormant.
  const games = [0, 0, 0, 0, 0];
  const bestByUser = new Map<string, number>();
  let totalGames = 0;

  for (const rows of data.games) {
    if (!before(rows.game.created_at, end.cutoff)) continue;
    totalGames++;
    const rank = rankOf(classifyAt(rows, end));
    games[rank]++;
    for (const id of playersAt(rows, end.cutoff)) {
      const prev = bestByUser.get(id);
      if (prev === undefined || rank < prev) bestByUser.set(id, rank);
    }
  }

  let totalUsers = 0;
  const users = [0, 0, 0, 0];
  for (const u of data.users) {
    const created = Date.parse(u.created_at);
    if (created >= end.cutoff) continue;
    totalUsers++;
    const best = bestByUser.get(u.id) ?? 4;
    if (best <= 1) users[best]++;
    else if (best === 2 || created >= end.graceSince) users[2]++;
    else if (best === 3 || created >= end.dormantSince) users[3]++;
  }

  return {
    day: end.day,
    totalUsers,
    healthyBookedUsers: users[0],
    healthyViableUsers: users[1],
    gettingGoingUsers: users[2],
    unhealthyUsers: users[3],
    totalGames,
    healthyBookedGames: games[0],
    healthyViableGames: games[1],
    gettingGoingGames: games[2],
    unhealthyGames: games[3],
  };
}

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
 * Activation funnel by signup cohort, on the same rolling 7-day windows as the
 * engagement charts. Each step is "ever, so far" — younger cohorts have had less
 * time to convert, so the newest points read low until they mature.
 */
export function buildFunnelCohorts(inputs: PlatformInputs, now: Date, windows?: number): FunnelCohort[] {
  const endExclusive = startOfDay(now);

  const gamesByUser = new Map<string, Set<string>>();
  const addGame = (userId: string, gameId: string) => {
    const set = gamesByUser.get(userId);
    if (set) set.add(gameId);
    else gamesByUser.set(userId, new Set([gameId]));
  };
  for (const g of inputs.games) addGame(g.gm_id, g.id);
  for (const m of inputs.memberships) addGame(m.user_id, m.game_id);

  const usersWithAvailability = new Set(inputs.availability.map((a) => a.user_id));

  const latestSessionByGame = new Map<string, string>();
  for (const s of inputs.sessions) {
    const prev = latestSessionByGame.get(s.game_id);
    if (!prev || s.date > prev) latestSessionByGame.set(s.game_id, s.date);
  }

  const tally = new Map<number, Omit<FunnelCohort, 'windowEnd'>>();
  for (const u of inputs.users) {
    const index = getBucketIndex(u.created_at, endExclusive);
    if (index === null) continue;
    let t = tally.get(index);
    if (!t) {
      t = { signups: 0, joinedGame: 0, enteredAvailability: 0, gotSession: 0 };
      tally.set(index, t);
    }
    t.signups++;

    const games = gamesByUser.get(u.id);
    if (games?.size) t.joinedGame++;
    if (usersWithAvailability.has(u.id)) t.enteredAvailability++;

    const signupDay = format(new Date(u.created_at), 'yyyy-MM-dd');
    if (games && [...games].some((id) => (latestSessionByGame.get(id) ?? '') >= signupDay)) {
      t.gotSession++;
    }
  }

  const count = windows ?? (tally.size ? Math.max(...tally.keys()) + 1 : 0);
  const result: FunnelCohort[] = [];
  for (let index = count - 1; index >= 0; index--) {
    const t = tally.get(index);
    result.push({
      windowEnd: windowEndKey(index, endExclusive),
      signups: t?.signups ?? 0,
      joinedGame: t?.joinedGame ?? 0,
      enteredAvailability: t?.enteredAvailability ?? 0,
      gotSession: t?.gotSession ?? 0,
    });
  }
  return result;
}

// ── Dormancy ───────────────────────────────────────────────

export interface DormancyBucket {
  windowEnd: string;
  /** Games that became dormant (see GameState) during the window. */
  wentDormant: number;
  /** Dormant games that saw activity again during the window. */
  revived: number;
}

/**
 * Games going dormant and coming back, per rolling 7-day window. Walks each
 * game's state day by day with the same classifyAt the daily stats use, so a
 * game this chart calls dormant is exactly one the health charts stopped
 * counting — and a quiet game with a game night on the horizon never goes dormant.
 */
export function buildDormancy(data: IndexedPlatform, now: Date, windows?: number): DormancyBucket[] {
  const endExclusive = startOfDay(now);
  const yesterday = subDays(endExclusive, 1);

  const tally = new Map<number, { wentDormant: number; revived: number }>();
  if (data.games.length > 0) {
    const firstCreated = data.games.reduce(
      (min, g) => (g.game.created_at < min ? g.game.created_at : min),
      data.games[0].game.created_at
    );
    const start = startOfDay(new Date(firstCreated));
    const ends = start <= yesterday
      ? eachDayOfInterval({ start, end: yesterday }).map((d) => dayEnd(format(d, 'yyyy-MM-dd')))
      : [];

    const bump = (day: string, key: 'wentDormant' | 'revived') => {
      const index = getBucketIndex(`${day}T00:00:00`, endExclusive);
      if (index === null) return;
      const t = tally.get(index) ?? { wentDormant: 0, revived: 0 };
      t[key]++;
      tally.set(index, t);
    };

    for (const rows of data.games) {
      let wasDormant = false;
      for (const end of ends) {
        if (!before(rows.game.created_at, end.cutoff)) continue;
        const dormant = classifyAt(rows, end).state === 'dormant';
        if (dormant !== wasDormant) bump(end.day, dormant ? 'wentDormant' : 'revived');
        wasDormant = dormant;
      }
    }
  }

  const count = windows ?? (tally.size ? Math.max(...tally.keys()) + 1 : 0);
  const result: DormancyBucket[] = [];
  for (let index = count - 1; index >= 0; index--) {
    const t = tally.get(index);
    result.push({
      windowEnd: windowEndKey(index, endExclusive),
      wentDormant: t?.wentDormant ?? 0,
      revived: t?.revived ?? 0,
    });
  }
  return result;
}

// ── Deletions ──────────────────────────────────────────────

export type DeletedEntity = 'user' | 'game' | 'session' | 'membership';

export interface DeletionBucket {
  windowEnd: string;
  user: number;
  game: number;
  session: number;
  membership: number;
}

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
  const result: DeletionBucket[] = [];
  for (let index = windows - 1; index >= 0; index--) {
    result.push({ windowEnd: windowEndKey(index, endExclusive), user: 0, game: 0, session: 0, membership: 0 });
  }
  for (const r of rows) {
    if (r.cascaded) continue;
    const index = getBucketIndex(r.deleted_at, endExclusive);
    if (index === null || index >= windows) continue;
    const bucket = result[windows - 1 - index];
    if (r.entity in bucket && r.entity !== 'windowEnd') bucket[r.entity as DeletedEntity]++;
  }
  return result;
}
