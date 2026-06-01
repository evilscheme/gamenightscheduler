import { describe, it, expect } from 'vitest';
import {
  buildUpcomingSessionRows,
  toLocalDateString,
} from './upcomingSessions';
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

const names = new Map<string, string>([
  ['g1', 'Curse of Strahd'],
  ['g2', 'Heist Crew'],
]);

describe('toLocalDateString', () => {
  it('formats a Date as YYYY-MM-DD in local time', () => {
    // Month is 0-indexed: 5 => June
    expect(toLocalDateString(new Date(2026, 5, 3))).toBe('2026-06-03');
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
      '2026-06-01'
    );
    expect(rows.map((r) => r.session.id)).toEqual(['b', 'a']);
    expect(rows[0].gameName).toBe('Curse of Strahd');
    expect(rows[1].gameName).toBe('Heist Crew');
  });

  it('falls back to "Unknown game" when a name is missing', () => {
    const rows = buildUpcomingSessionRows(
      [mkSession({ game_id: 'gX', date: '2026-06-10' })],
      names,
      '2026-06-01'
    );
    expect(rows[0].gameName).toBe('Unknown game');
  });

  it('tags today and tomorrow, leaving other dates null', () => {
    const rows = buildUpcomingSessionRows(
      [
        mkSession({ id: 'today', date: '2026-06-10' }),
        mkSession({ id: 'tom', date: '2026-06-11' }),
        mkSession({ id: 'later', date: '2026-06-12' }),
      ],
      names,
      '2026-06-10'
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
      '2026-12-31'
    );
    expect(rows[0].dayHighlight).toBe('tomorrow');
  });

  it('breaks date ties by start_time (nulls last) then game name', () => {
    const rows = buildUpcomingSessionRows(
      [
        mkSession({ id: 'noTime', game_id: 'g1', date: '2026-06-10', start_time: null }),
        mkSession({ id: 'late', game_id: 'g2', date: '2026-06-10', start_time: '20:00:00' }),
        mkSession({ id: 'early', game_id: 'g1', date: '2026-06-10', start_time: '18:00:00' }),
      ],
      names,
      '2026-06-01'
    );
    expect(rows.map((r) => r.session.id)).toEqual(['early', 'late', 'noTime']);
  });
});
