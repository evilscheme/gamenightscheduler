import { DORMANT_AFTER_DAYS, GRACE_DAYS, type DeletedEntity } from './platformHealth';

// ── What the database stores ───────────────────────────────

/** A deletion_log row as the admin routes read it. `details` is written by the
 *  log_deletion() trigger (supabase/schema.sql) and is null on records from
 *  before it carried facts. */
export interface DeletionLogRow {
  id: number;
  entity: string;
  cascaded: boolean;
  deleted_at: string;
  actor: string | null;
  xact: number | string | null;
  details: unknown;
}

// The shapes log_deletion() builds, one per entity. Dates are UTC days
// (yyyy-MM-dd): day precision is deliberate, see docs/adr/0001.
interface AccountDetails {
  created: string;
  games_hosted: number;
  games_joined: number;
  availability_entries: number;
}
interface GameDetails {
  created: string;
  players: number;
  sessions_past: number;
  sessions_upcoming: number;
  availability_entries: number;
  extra_dates: number;
  last_activity: string;
}
interface DepartureDetails {
  joined: string;
  co_gm: boolean;
  availability_entries: number;
}
interface SessionDetails {
  created: string;
  session_date: string;
  days_until: number;
}

// ── What the admin page shows ──────────────────────────────

/** Who made a deliberate deletion, as a role: the player themselves, a host or
 *  co-GM, or nobody signed in (the account-deletion flow, admin tooling). */
export type DeletionActor = 'self' | 'gm' | 'system';

/**
 * How a deleted game was doing, from the facts its record kept. Coarser than
 * HealthBucket on purpose: the record can't tell whether a date was viable, so
 * these are different words rather than buckets that would sometimes be wrong.
 * - booked: more than one player and a session still to come
 * - active / quiet / dormant: nothing booked; by how long since anything happened
 */
export type DeletedGameHealth = 'booked' | 'active' | 'quiet' | 'dormant';

export interface AccountFacts {
  ageDays: number;
  /** Games still hosted when the account went (transferred games excluded). */
  gamesHosted: number;
  gamesJoined: number;
  availabilityEntries: number;
}

export interface GameFacts {
  ageDays: number;
  /** Host included. */
  players: number;
  sessionsPast: number;
  sessionsUpcoming: number;
  availabilityEntries: number;
  extraDates: number;
  /** Days since the last activity of any kind (see gameActivity in platformHealth.ts). */
  quietDays: number;
  health: DeletedGameHealth;
}

export interface DepartureFacts {
  /** Days between joining the game and leaving it. */
  tenureDays: number;
  coGm: boolean;
  availabilityEntries: number;
}

export interface SessionFacts {
  /** Days between booking the session and deleting it. */
  onBooksDays: number;
  /** Days from the deletion to the session's date, by the game's calendar.
   *  Negative when the session's date had already passed. */
  daysUntil: number;
  /** False means a past session was removed, which is not a cancellation. */
  upcoming: boolean;
}

interface RecordBase {
  id: number;
  deletedAt: string;
  actor: DeletionActor | null;
}

/** One deliberate deletion. `facts` is null on records from before facts were kept. */
export type DeletionRecord =
  | (RecordBase & { entity: 'user'; facts: AccountFacts | null; /** Games that went with the account. */ causedGames: GameFacts[] })
  | (RecordBase & { entity: 'game'; facts: GameFacts | null })
  | (RecordBase & { entity: 'membership'; facts: DepartureFacts | null })
  | (RecordBase & { entity: 'session'; facts: SessionFacts | null });

export interface RecentDeletions {
  /** Newest first, capped. */
  records: DeletionRecord[];
  /** Deliberate deletions in the range, before the cap. */
  total: number;
}

// ── Building ───────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** The UTC day of a timestamp. UTC on purpose: the trigger stores its dates as
 *  UTC days, so both ends of a duration have to be read the same way. */
const utcDayMs = (ts: string) => Math.floor(Date.parse(ts) / DAY_MS) * DAY_MS;

/** Whole days from a stored yyyy-MM-dd to the day of the deletion. Never
 *  negative: a row's own timestamps can't postdate its deletion. */
const daysBefore = (day: string, deletedAt: string) =>
  Math.max(0, Math.round((utcDayMs(deletedAt) - Date.parse(`${day}T00:00:00Z`)) / DAY_MS));

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const ACTORS: readonly string[] = ['self', 'gm', 'system'] satisfies DeletionActor[];

export function deletedGameHealth(facts: Pick<GameFacts, 'players' | 'sessionsUpcoming' | 'quietDays'>): DeletedGameHealth {
  if (facts.players > 1 && facts.sessionsUpcoming > 0) return 'booked';
  // Same boundaries classifyAt uses for gettingGoing / unhealthy / dormant.
  if (facts.quietDays <= GRACE_DAYS) return 'active';
  return facts.quietDays <= DORMANT_AFTER_DAYS ? 'quiet' : 'dormant';
}

function accountFacts(row: DeletionLogRow): AccountFacts | null {
  if (!isObject(row.details)) return null;
  const d = row.details as unknown as AccountDetails;
  return {
    ageDays: daysBefore(d.created, row.deleted_at),
    gamesHosted: d.games_hosted,
    gamesJoined: d.games_joined,
    availabilityEntries: d.availability_entries,
  };
}

function gameFacts(row: DeletionLogRow): GameFacts | null {
  if (!isObject(row.details)) return null;
  const d = row.details as unknown as GameDetails;
  const core = {
    ageDays: daysBefore(d.created, row.deleted_at),
    players: d.players,
    sessionsPast: d.sessions_past,
    sessionsUpcoming: d.sessions_upcoming,
    availabilityEntries: d.availability_entries,
    extraDates: d.extra_dates,
    quietDays: daysBefore(d.last_activity, row.deleted_at),
  };
  return { ...core, health: deletedGameHealth(core) };
}

function departureFacts(row: DeletionLogRow): DepartureFacts | null {
  if (!isObject(row.details)) return null;
  const d = row.details as unknown as DepartureDetails;
  return {
    tenureDays: daysBefore(d.joined, row.deleted_at),
    coGm: d.co_gm,
    availabilityEntries: d.availability_entries,
  };
}

function sessionFacts(row: DeletionLogRow): SessionFacts | null {
  if (!isObject(row.details)) return null;
  const d = row.details as unknown as SessionDetails;
  return {
    onBooksDays: daysBefore(d.created, row.deleted_at),
    daysUntil: d.days_until,
    upcoming: d.days_until >= 0,
  };
}

/**
 * The deliberate deletions among `rows`, newest first, each with the facts its
 * record kept. Cascaded rows aren't listed — one act is one line — except that
 * the games an account deletion took with it ride along on the account's record,
 * matched by the transaction they were deleted in.
 */
export function buildDeletionRecords(rows: DeletionLogRow[], limit = 100): RecentDeletions {
  const gamesByXact = new Map<string, GameFacts[]>();
  for (const r of rows) {
    if (!r.cascaded || r.entity !== 'game' || r.xact === null) continue;
    const facts = gameFacts(r);
    if (!facts) continue;
    const key = String(r.xact);
    const list = gamesByXact.get(key);
    if (list) list.push(facts);
    else gamesByXact.set(key, [facts]);
  }

  const deliberate = rows
    .filter((r) => !r.cascaded)
    .sort((a, b) => Date.parse(b.deleted_at) - Date.parse(a.deleted_at) || b.id - a.id);

  const records: DeletionRecord[] = [];
  let total = 0;
  for (const r of deliberate) {
    const base: RecordBase = {
      id: r.id,
      deletedAt: r.deleted_at,
      actor: r.actor !== null && ACTORS.includes(r.actor) ? (r.actor as DeletionActor) : null,
    };
    let record: DeletionRecord;
    switch (r.entity as DeletedEntity) {
      case 'user':
        record = {
          ...base,
          entity: 'user',
          facts: accountFacts(r),
          causedGames: (r.xact !== null && gamesByXact.get(String(r.xact))) || [],
        };
        break;
      case 'game':
        record = { ...base, entity: 'game', facts: gameFacts(r) };
        break;
      case 'membership':
        record = { ...base, entity: 'membership', facts: departureFacts(r) };
        break;
      case 'session':
        record = { ...base, entity: 'session', facts: sessionFacts(r) };
        break;
      default:
        continue; // An entity this build doesn't know: skip it rather than guess.
    }
    total++;
    if (records.length < limit) records.push(record);
  }
  return { records, total };
}

// ── Wording ────────────────────────────────────────────────

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A day count as a rough span: "5 days", "3 weeks", "14 months", "2 years". */
export function formatSpan(days: number): string {
  if (days < 1) return 'under a day';
  if (days < 14) return plural(days, 'day');
  if (days < 60) return plural(Math.floor(days / 7), 'week');
  if (days < 730) return plural(Math.floor(days / 30.44), 'month');
  return plural(Math.floor(days / 365.25), 'year');
}

/** One line of the Recent Deletions list. */
export interface DeletionLine {
  what: string;
  facts: string[];
  /** Set for a game whose record kept facts. */
  health: DeletedGameHealth | null;
}

export const NO_DETAILS = 'No details recorded';

function gameFactsText(f: GameFacts): string[] {
  return [
    `${formatSpan(f.ageDays)} old`,
    plural(f.players, 'player'),
    `${plural(f.sessionsPast, 'past session')}, ${f.sessionsUpcoming} upcoming`,
    plural(f.availabilityEntries, 'availability entry', 'availability entries'),
    ...(f.extraDates > 0 ? [plural(f.extraDates, 'extra date')] : []),
    f.quietDays === 0 ? 'active that day' : `quiet for ${formatSpan(f.quietDays)}`,
  ];
}

/**
 * A record in words: the line for the deletion itself, then one line for each
 * game an account deletion took with it.
 */
export function describeDeletion(record: DeletionRecord): DeletionLine[] {
  switch (record.entity) {
    case 'user': {
      const f = record.facts;
      const own: DeletionLine = {
        what: 'Account',
        facts: f
          ? [
              `${formatSpan(f.ageDays)} old`,
              `hosted ${plural(f.gamesHosted, 'game')}`,
              `joined ${plural(f.gamesJoined, 'game')}`,
              plural(f.availabilityEntries, 'availability entry', 'availability entries'),
            ]
          : [NO_DETAILS],
        health: null,
      };
      return [
        own,
        ...record.causedGames.map((g) => ({ what: 'Game deleted with it', facts: gameFactsText(g), health: g.health })),
      ];
    }
    case 'game':
      return [
        record.facts
          ? { what: 'Game', facts: gameFactsText(record.facts), health: record.facts.health }
          : { what: 'Game', facts: [NO_DETAILS], health: null },
      ];
    case 'membership': {
      const f = record.facts;
      const what =
        record.actor === 'self' ? 'Player left' : record.actor === 'gm' ? 'Player removed' : 'Player left or removed';
      return [
        {
          what,
          facts: f
            ? [
                `in the game ${formatSpan(f.tenureDays)}`,
                ...(f.coGm ? ['was a co-GM'] : []),
                plural(f.availabilityEntries, 'availability entry', 'availability entries'),
              ]
            : [NO_DETAILS],
          health: null,
        },
      ];
    }
    case 'session': {
      const f = record.facts;
      if (!f) return [{ what: 'Session', facts: [NO_DETAILS], health: null }];
      const timing =
        f.daysUntil === 0
          ? 'on the day itself'
          : f.daysUntil > 0
            ? `${formatSpan(f.daysUntil)} before its date`
            : `${formatSpan(-f.daysUntil)} after its date`;
      return [
        {
          what: f.upcoming ? 'Session cancelled' : 'Past session removed',
          facts: [timing, `booked for ${formatSpan(f.onBooksDays)}`],
          health: null,
        },
      ];
    }
  }
}
