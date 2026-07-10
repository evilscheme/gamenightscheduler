import { describe, it, expect } from 'vitest';
import {
  buildUpcomingSessionRows,
  getUpcomingQueryFloor,
} from './upcomingSessions';
import { toLocalDateString } from '../date';
import type { GameSession } from '@/types';

const mkSession = (overrides: Partial<GameSession>): GameSession => ({
  id: `s-${overrides.date}-${overrides.game_id ?? 'g'}`,
  game_id: 'g1',
  date: '2026-06-10',
  start_time: '19:00:00',
  end_time: '22:00:00',
  status: 'confirmed',
  confirmed_by: 'u1',
  location: null,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const names = new Map<string, { name: string; timezone: string | null }>([
  ['g1', { name: 'Curse of Strahd', timezone: 'America/Los_Angeles' }],
  ['g2', { name: 'Heist Crew', timezone: 'America/New_York' }],
  ['g3', { name: 'Avalon', timezone: 'America/Los_Angeles' }],
]);

// A "now" of noon UTC on the given date keeps US-timezone "today" equal to that
// date, so the upcoming-cutoff filter doesn't drop the test's sessions.
const noonUtc = (dateStr: string): number => Date.parse(`${dateStr}T12:00:00Z`);

describe('toLocalDateString', () => {
  it('formats a Date as YYYY-MM-DD in local time', () => {
    // Month is 0-indexed: 5 => June
    expect(toLocalDateString(new Date(2026, 5, 3))).toBe('2026-06-03');
  });
});

describe('getUpcomingQueryFloor', () => {
  it('returns a date two calendar days before the viewer-local date', () => {
    // Two days covers the widest timezone span (UTC-12..UTC+14 = 26h), which can
    // put a game's local date up to two calendar days behind the viewer's.
    const now = Date.UTC(2026, 5, 3, 12, 0, 0);
    const today = toLocalDateString(new Date(now));
    const floor = getUpcomingQueryFloor(now);
    // Parsed as UTC midnight on both sides, so the diff is exact and tz-independent.
    const diffDays = (Date.parse(today) - Date.parse(floor)) / 86_400_000;
    expect(diffDays).toBe(2);
  });
});

describe('buildUpcomingSessionRows', () => {
  it('joins game names and sorts by date ascending', () => {
    const rows = buildUpcomingSessionRows(
      [
        mkSession({ id: 'a', game_id: 'g2', date: '2026-06-12' }),
        mkSession({ id: 'b', game_id: 'g1', date: '2026-06-10' }),
      ],
      names,
      '2026-06-01',
      noonUtc('2026-06-01')
    );
    expect(rows.map((r) => r.session.id)).toEqual(['b', 'a']);
    expect(rows[0].gameName).toBe('Curse of Strahd');
    expect(rows[1].gameName).toBe('Heist Crew');
  });

  it('falls back to "Unknown game" with null timezone when the game is missing', () => {
    const rows = buildUpcomingSessionRows(
      [mkSession({ game_id: 'gX', date: '2026-06-10' })],
      names,
      '2026-06-01',
      noonUtc('2026-06-01')
    );
    expect(rows[0].gameName).toBe('Unknown game');
    expect(rows[0].gameTimezone).toBeNull();
  });

  it('carries the game timezone onto each row', () => {
    const rows = buildUpcomingSessionRows(
      [
        mkSession({ id: 'a', game_id: 'g1', date: '2026-06-10' }),
        mkSession({ id: 'b', game_id: 'g2', date: '2026-06-11' }),
      ],
      names,
      '2026-06-01',
      noonUtc('2026-06-01')
    );
    expect(rows[0].gameTimezone).toBe('America/Los_Angeles');
    expect(rows[1].gameTimezone).toBe('America/New_York');
  });

  it('tags today and tomorrow, leaving other dates null', () => {
    const rows = buildUpcomingSessionRows(
      [
        mkSession({ id: 'today', date: '2026-06-10' }),
        mkSession({ id: 'tom', date: '2026-06-11' }),
        mkSession({ id: 'later', date: '2026-06-12' }),
      ],
      names,
      '2026-06-10',
      noonUtc('2026-06-10')
    );
    const byId = Object.fromEntries(rows.map((r) => [r.session.id, r.dayHighlight]));
    expect(byId.today).toBe('today');
    expect(byId.tom).toBe('tomorrow');
    expect(byId.later).toBeNull();
  });

  it('computes tomorrow across a month/year boundary', () => {
    const rows = buildUpcomingSessionRows(
      [mkSession({ id: 'ny', date: '2027-01-01' })],
      names,
      '2026-12-31',
      noonUtc('2026-12-31')
    );
    expect(rows[0].dayHighlight).toBe('tomorrow');
  });

  it('orders sessions by their true instant across timezones, not raw local time', () => {
    // Same calendar date. NY 20:00 EDT (00:00 UTC) precedes LA 19:00 PDT (02:00 UTC),
    // even though "19:00" < "20:00" as strings.
    const rows = buildUpcomingSessionRows(
      [
        mkSession({ id: 'la', game_id: 'g1', date: '2026-06-10', start_time: '19:00:00' }),
        mkSession({ id: 'ny', game_id: 'g2', date: '2026-06-10', start_time: '20:00:00' }),
      ],
      names,
      '2026-06-01',
      noonUtc('2026-06-01')
    );
    expect(rows.map((r) => r.session.id)).toEqual(['ny', 'la']);
  });

  it('places start-less sessions after timed ones on the same date', () => {
    const rows = buildUpcomingSessionRows(
      [
        mkSession({ id: 'noTime', game_id: 'g1', date: '2026-06-10', start_time: null }),
        mkSession({ id: 'timed', game_id: 'g1', date: '2026-06-10', start_time: '18:00:00' }),
      ],
      names,
      '2026-06-01',
      noonUtc('2026-06-01')
    );
    expect(rows.map((r) => r.session.id)).toEqual(['timed', 'noTime']);
  });

  it('breaks exact-instant ties by game name', () => {
    // Same timezone, date, and start time → identical instant → name decides.
    const rows = buildUpcomingSessionRows(
      [
        mkSession({ id: 'curse', game_id: 'g1', date: '2026-06-10', start_time: '19:00:00' }),
        mkSession({ id: 'avalon', game_id: 'g3', date: '2026-06-10', start_time: '19:00:00' }),
      ],
      names,
      '2026-06-01',
      noonUtc('2026-06-01')
    );
    expect(rows.map((r) => r.session.id)).toEqual(['avalon', 'curse']);
  });

  it("keeps a session still upcoming in the game's timezone after the viewer's date rolls over", () => {
    // Viewer is on 2026-06-02, but in Los Angeles it is still 2026-06-01 20:00.
    // An LA session dated 2026-06-01 is still upcoming and must not be dropped.
    const nowMs = Date.UTC(2026, 5, 2, 3, 0, 0);
    const rows = buildUpcomingSessionRows(
      [mkSession({ id: 'laEvening', game_id: 'g1', date: '2026-06-01' })],
      names,
      '2026-06-02',
      nowMs
    );
    expect(rows.map((r) => r.session.id)).toEqual(['laEvening']);
  });

  it("drops sessions already past in the game's own timezone", () => {
    const nowMs = Date.UTC(2026, 5, 2, 3, 0, 0); // LA: 2026-06-01 20:00
    const rows = buildUpcomingSessionRows(
      [mkSession({ id: 'old', game_id: 'g1', date: '2026-05-31' })],
      names,
      '2026-06-02',
      nowMs
    );
    expect(rows).toHaveLength(0);
  });
});
