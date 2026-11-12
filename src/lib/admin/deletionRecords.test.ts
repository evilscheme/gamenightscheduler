import { describe, it, expect } from 'vitest';
import {
  buildDeletionRecords,
  deletedGameHealth,
  describeDeletion,
  formatSpan,
  NO_DETAILS,
  type DeletionLogRow,
} from './deletionRecords';
import { DORMANT_AFTER_DAYS, GRACE_DAYS } from './platformHealth';

const DELETED_AT = '2026-11-11T18:30:00+00:00';

let nextId = 1;
function row(overrides: Partial<DeletionLogRow> & Pick<DeletionLogRow, 'entity'>): DeletionLogRow {
  return { id: nextId++, cascaded: false, deleted_at: DELETED_AT, actor: 'gm', xact: 100, details: null, ...overrides };
}

const GAME_DETAILS = {
  created: '2025-09-11',
  players: 6,
  sessions_past: 12,
  sessions_upcoming: 2,
  availability_entries: 340,
  extra_dates: 3,
  last_activity: '2026-11-08',
};

describe('deletedGameHealth', () => {
  it('is booked only with a session to come and someone besides the host', () => {
    expect(deletedGameHealth({ players: 2, sessionsUpcoming: 1, quietDays: 200 })).toBe('booked');
    // A host alone with a session booked isn't a game anyone is going to.
    expect(deletedGameHealth({ players: 1, sessionsUpcoming: 1, quietDays: 0 })).toBe('active');
  });

  it('falls back to how long the game had been quiet, on the health charts’ boundaries', () => {
    const quiet = (quietDays: number) => deletedGameHealth({ players: 4, sessionsUpcoming: 0, quietDays });
    expect(quiet(GRACE_DAYS)).toBe('active');
    expect(quiet(GRACE_DAYS + 1)).toBe('quiet');
    expect(quiet(DORMANT_AFTER_DAYS)).toBe('quiet');
    expect(quiet(DORMANT_AFTER_DAYS + 1)).toBe('dormant');
  });
});

describe('buildDeletionRecords', () => {
  it('turns a game record into ages, counts and a health label', () => {
    const { records } = buildDeletionRecords([row({ entity: 'game', details: GAME_DETAILS })]);
    expect(records).toEqual([
      {
        id: expect.any(Number),
        entity: 'game',
        deletedAt: DELETED_AT,
        actor: 'gm',
        facts: {
          ageDays: 426,
          players: 6,
          sessionsPast: 12,
          sessionsUpcoming: 2,
          availabilityEntries: 340,
          extraDates: 3,
          quietDays: 3,
          health: 'booked',
        },
      },
    ]);
  });

  it('reads an account record, with the games that went with it', () => {
    const { records, total } = buildDeletionRecords([
      row({
        entity: 'user',
        actor: 'system',
        xact: 7,
        details: { created: '2026-08-03', games_hosted: 1, games_joined: 2, availability_entries: 40 },
      }),
      row({ entity: 'game', cascaded: true, actor: 'system', xact: 7, details: { ...GAME_DETAILS, sessions_upcoming: 0 } }),
      row({ entity: 'session', cascaded: true, actor: 'system', xact: 7, details: null }),
      // Same instant, different transaction: not this account's game.
      row({ entity: 'game', cascaded: true, actor: 'system', xact: 8, details: GAME_DETAILS }),
    ]);

    expect(total).toBe(1);
    expect(records).toHaveLength(1);
    const [account] = records;
    expect(account).toMatchObject({
      entity: 'user',
      actor: 'system',
      facts: { ageDays: 100, gamesHosted: 1, gamesJoined: 2, availabilityEntries: 40 },
    });
    if (account.entity !== 'user') throw new Error('expected an account record');
    expect(account.causedGames).toHaveLength(1);
    expect(account.causedGames[0]).toMatchObject({ players: 6, health: 'active' });
  });

  it('tells a player who left from one who was removed', () => {
    const details = { joined: '2026-10-12', co_gm: true, availability_entries: 9 };
    const { records } = buildDeletionRecords([
      row({ entity: 'membership', actor: 'self', details }),
      row({ entity: 'membership', actor: 'gm', details }),
    ]);
    expect(records.map((r) => r.actor).sort()).toEqual(['gm', 'self']);
    expect(records[0].facts).toEqual({ tenureDays: 30, coGm: true, availabilityEntries: 9 });
  });

  it('tells a cancellation from a past session being removed', () => {
    const { records } = buildDeletionRecords([
      row({ id: 2, entity: 'session', details: { created: '2026-11-01', session_date: '2026-11-14', days_until: 3 } }),
      row({ id: 1, entity: 'session', details: { created: '2026-10-01', session_date: '2026-10-20', days_until: -22 } }),
    ]);
    expect(records.map((r) => r.facts)).toEqual([
      { onBooksDays: 10, daysUntil: 3, upcoming: true },
      { onBooksDays: 41, daysUntil: -22, upcoming: false },
    ]);
  });

  it('counts a session cancelled on its own day as upcoming', () => {
    const { records } = buildDeletionRecords([
      row({ entity: 'session', details: { created: '2026-11-11', session_date: '2026-11-11', days_until: 0 } }),
    ]);
    expect(records[0].facts).toEqual({ onBooksDays: 0, daysUntil: 0, upcoming: true });
  });

  it('keeps records from before facts were recorded, with no facts', () => {
    const { records } = buildDeletionRecords([
      { id: 1, entity: 'game', cascaded: false, deleted_at: DELETED_AT, actor: null, xact: null, details: null },
      { id: 2, entity: 'user', cascaded: false, deleted_at: DELETED_AT, actor: null, xact: null, details: null },
    ]);
    expect(records).toEqual([
      { id: 2, entity: 'user', deletedAt: DELETED_AT, actor: null, facts: null, causedGames: [] },
      { id: 1, entity: 'game', deletedAt: DELETED_AT, actor: null, facts: null },
    ]);
  });

  it('lists newest first and reports the total past the cap', () => {
    const rows = [
      row({ id: 10, entity: 'session', deleted_at: '2026-11-01T10:00:00+00:00' }),
      row({ id: 11, entity: 'session', deleted_at: '2026-11-09T10:00:00+00:00' }),
      row({ id: 12, entity: 'session', deleted_at: '2026-11-05T10:00:00+00:00' }),
    ];
    const { records, total } = buildDeletionRecords(rows, 2);
    expect(records.map((r) => r.id)).toEqual([11, 12]);
    expect(total).toBe(3);
  });

  it('skips an entity or actor it does not recognise instead of guessing', () => {
    const { records, total } = buildDeletionRecords([
      row({ entity: 'play_date' }),
      row({ entity: 'session', actor: 'robot' }),
    ]);
    expect(total).toBe(1);
    expect(records[0].actor).toBeNull();
  });
});

describe('formatSpan', () => {
  it('picks the unit a person would say', () => {
    expect(formatSpan(0)).toBe('under a day');
    expect(formatSpan(1)).toBe('1 day');
    expect(formatSpan(13)).toBe('13 days');
    expect(formatSpan(14)).toBe('2 weeks');
    expect(formatSpan(59)).toBe('8 weeks');
    expect(formatSpan(60)).toBe('1 month');
    expect(formatSpan(426)).toBe('13 months');
    expect(formatSpan(730)).toBe('1 year');
    expect(formatSpan(1100)).toBe('3 years');
  });
});

describe('describeDeletion', () => {
  const describeRows = (...rows: DeletionLogRow[]) => buildDeletionRecords(rows).records.flatMap(describeDeletion);

  it('describes a deleted game and how it was doing', () => {
    expect(describeRows(row({ entity: 'game', details: GAME_DETAILS }))).toEqual([
      {
        what: 'Game',
        facts: ['13 months old', '6 players', '12 past sessions, 2 upcoming', '340 availability entries', '3 extra dates', 'quiet for 3 days'],
        health: 'booked',
      },
    ]);
  });

  it('lists the games an account deletion took with it under the account', () => {
    const lines = describeRows(
      row({ entity: 'user', xact: 7, details: { created: '2026-11-11', games_hosted: 1, games_joined: 0, availability_entries: 1 } }),
      row({ entity: 'game', cascaded: true, xact: 7, details: { ...GAME_DETAILS, players: 1, extra_dates: 0, last_activity: '2026-11-11' } })
    );
    expect(lines.map((l) => l.what)).toEqual(['Account', 'Game deleted with it']);
    expect(lines[0].facts).toEqual(['under a day old', 'hosted 1 game', 'joined 0 games', '1 availability entry']);
    expect(lines[1].facts).toEqual(['13 months old', '1 player', '12 past sessions, 2 upcoming', '340 availability entries', 'active that day']);
  });

  it('names a departure by who chose it', () => {
    const details = { joined: '2026-10-12', co_gm: true, availability_entries: 9 };
    const whats = (actor: string | null) => describeRows(row({ entity: 'membership', actor, details }))[0];
    expect(whats('self').what).toBe('Player left');
    expect(whats('gm').what).toBe('Player removed');
    expect(whats('system').what).toBe('Player left or removed');
    expect(whats('self').facts).toEqual(['in the game 4 weeks', 'was a co-GM', '9 availability entries']);
  });

  it('calls only an upcoming session a cancellation', () => {
    const session = (days_until: number) =>
      describeRows(row({ entity: 'session', details: { created: '2026-11-01', session_date: '2026-11-14', days_until } }))[0];
    expect(session(3)).toMatchObject({ what: 'Session cancelled', facts: ['3 days before its date', 'booked for 10 days'] });
    expect(session(0)).toMatchObject({ what: 'Session cancelled', facts: ['on the day itself', 'booked for 10 days'] });
    expect(session(-22)).toMatchObject({ what: 'Past session removed', facts: ['3 weeks after its date', 'booked for 10 days'] });
  });

  it('says so when a record kept no facts', () => {
    const lines = describeRows(
      row({ entity: 'user' }),
      row({ entity: 'game' }),
      row({ entity: 'membership', actor: null }),
      row({ entity: 'session' })
    );
    expect(lines.map((l) => l.what).sort()).toEqual(['Account', 'Game', 'Player left or removed', 'Session']);
    expect(lines.every((l) => l.facts.length === 1 && l.facts[0] === NO_DETAILS)).toBe(true);
  });
});
