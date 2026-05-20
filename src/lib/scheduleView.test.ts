import { describe, it, expect } from 'vitest';
import {
  getCellTintTier,
  partitionByThreshold,
  formatTimeWindow,
  splitUpcomingPast,
  computeDefaultSessionTimes,
  getTopNDates,
} from './scheduleView';
import type { DateSuggestion, GameSession } from '@/types';

const mkSuggestion = (overrides: Partial<DateSuggestion>): DateSuggestion => ({
  date: '2026-05-01',
  dayOfWeek: 4,
  availableCount: 0,
  maybeCount: 0,
  unavailableCount: 0,
  pendingCount: 0,
  totalPlayers: 5,
  availablePlayers: [],
  maybePlayers: [],
  unavailablePlayers: [],
  pendingPlayers: [],
  earliestStartTime: null,
  latestEndTime: null,
  meetsThreshold: true,
  ...overrides,
});

describe('getCellTintTier', () => {
  it('returns "high" when weighted score >= 80%', () => {
    // 4/5 available = 0.8
    expect(getCellTintTier(mkSuggestion({ availableCount: 4, unavailableCount: 1 }))).toBe('high');
    // 3 available + 2 maybe = (3 + 1)/5 = 0.8
    expect(getCellTintTier(mkSuggestion({ availableCount: 3, maybeCount: 2 }))).toBe('high');
  });

  it('returns "medium" when weighted score is 60-79%', () => {
    // 3/5 available = 0.6
    expect(getCellTintTier(mkSuggestion({ availableCount: 3, unavailableCount: 2 }))).toBe('medium');
    // 2 available + 2 maybe = (2 + 1)/5 = 0.6
    expect(getCellTintTier(mkSuggestion({ availableCount: 2, maybeCount: 2, unavailableCount: 1 }))).toBe('medium');
  });

  it('returns "maybe" when weighted score is 40-59%', () => {
    // 2/5 available = 0.4
    expect(getCellTintTier(mkSuggestion({ availableCount: 2, unavailableCount: 3 }))).toBe('maybe');
    // 4 maybe = (0 + 2)/5 = 0.4
    expect(getCellTintTier(mkSuggestion({ maybeCount: 4, unavailableCount: 1 }))).toBe('maybe');
  });

  it('treats one maybe as 0.5 of a yes (not auto-amber)', () => {
    // 5 players, 1 maybe, 4 pending → score 0.1, no majority-no → empty (gray), NOT amber
    expect(getCellTintTier(mkSuggestion({ maybeCount: 1, pendingCount: 4 }))).toBe('empty');
    // 5 players, 2 maybe, 3 pending → score 0.2 → empty (gray)
    expect(getCellTintTier(mkSuggestion({ maybeCount: 2, pendingCount: 3 }))).toBe('empty');
  });

  it('returns "warning" only when a majority said no', () => {
    // 5 players, 3 unavailable, 2 pending → unavailableRatio 0.6 → red
    expect(getCellTintTier(mkSuggestion({ unavailableCount: 3, pendingCount: 2 }))).toBe('warning');
    // All 5 said no → red
    expect(getCellTintTier(mkSuggestion({ unavailableCount: 5 }))).toBe('warning');
  });

  it('returns "empty" (gray) when responses are mostly pending', () => {
    // 5 players, all pending → gray, not red
    expect(getCellTintTier(mkSuggestion({ pendingCount: 5 }))).toBe('empty');
    // 5 players, 1 unavailable, 4 pending → unavailableRatio 0.2 → gray, not red
    expect(getCellTintTier(mkSuggestion({ unavailableCount: 1, pendingCount: 4 }))).toBe('empty');
  });

  it('returns "empty" when totalPlayers is 0', () => {
    expect(getCellTintTier(mkSuggestion({ totalPlayers: 0 }))).toBe('empty');
  });
});

describe('partitionByThreshold', () => {
  it('splits suggestions into viable and belowThreshold buckets', () => {
    const items = [
      mkSuggestion({ date: '2026-05-01', meetsThreshold: true }),
      mkSuggestion({ date: '2026-05-02', meetsThreshold: false }),
      mkSuggestion({ date: '2026-05-03', meetsThreshold: true }),
    ];
    const { viable, belowThreshold } = partitionByThreshold(items);
    expect(viable.map((s) => s.date)).toEqual(['2026-05-01', '2026-05-03']);
    expect(belowThreshold.map((s) => s.date)).toEqual(['2026-05-02']);
  });
  it('returns empty belowThreshold when threshold not set', () => {
    const items = [mkSuggestion({ meetsThreshold: true })];
    expect(partitionByThreshold(items).belowThreshold).toEqual([]);
  });
});

describe('formatTimeWindow', () => {
  it('returns null when no constraints', () => {
    expect(formatTimeWindow(null, null, false)).toBeNull();
  });
  it('formats start only', () => {
    expect(formatTimeWindow('19:30:00', null, false)).toBe('from 7:30pm');
  });
  it('formats end only', () => {
    expect(formatTimeWindow(null, '23:00:00', false)).toBe('until 11pm');
  });
  it('formats both', () => {
    expect(formatTimeWindow('19:30:00', '23:00:00', false)).toBe('7:30pm – 11pm');
  });
  it('respects 24h format', () => {
    expect(formatTimeWindow('19:30:00', '23:00:00', true)).toBe('19:30 – 23:00');
  });
});

describe('splitUpcomingPast', () => {
  it('partitions sessions relative to a reference date', () => {
    const today = new Date('2026-04-23T12:00:00');
    const sessions: GameSession[] = [
      { id: 'a', game_id: 'g', date: '2026-04-20', start_time: null, end_time: null, status: 'confirmed', confirmed_by: null, created_at: '' },
      { id: 'b', game_id: 'g', date: '2026-04-23', start_time: null, end_time: null, status: 'confirmed', confirmed_by: null, created_at: '' },
      { id: 'c', game_id: 'g', date: '2026-04-30', start_time: null, end_time: null, status: 'confirmed', confirmed_by: null, created_at: '' },
    ];
    const { upcoming, past } = splitUpcomingPast(sessions, today);
    expect(upcoming.map((s) => s.id)).toEqual(['b', 'c']);
    expect(past.map((s) => s.id)).toEqual(['a']);
  });
});

describe('computeDefaultSessionTimes', () => {
  it('falls back to game defaults when no constraints', () => {
    const out = computeDefaultSessionTimes({
      earliestStartTime: null,
      latestEndTime: null,
      gameDefaultStart: '19:00',
      gameDefaultEnd: '23:00',
    });
    expect(out).toEqual({ start: '19:00', end: '23:00' });
  });
  it('uses later of game default and player constraint for start', () => {
    const out = computeDefaultSessionTimes({
      earliestStartTime: '19:30:00',
      latestEndTime: null,
      gameDefaultStart: '19:00',
      gameDefaultEnd: '23:00',
    });
    expect(out.start).toBe('19:30');
  });
  it('uses earlier of game default and player constraint for end', () => {
    const out = computeDefaultSessionTimes({
      earliestStartTime: null,
      latestEndTime: '22:00:00',
      gameDefaultStart: '19:00',
      gameDefaultEnd: '23:00',
    });
    expect(out.end).toBe('22:00');
  });
  it('keeps game default for start when player constraint is earlier', () => {
    const out = computeDefaultSessionTimes({
      earliestStartTime: '18:00:00',
      latestEndTime: null,
      gameDefaultStart: '19:00',
      gameDefaultEnd: '23:00',
    });
    expect(out.start).toBe('19:00');
  });
  it('applies both start and end constraints simultaneously', () => {
    const out = computeDefaultSessionTimes({
      earliestStartTime: '19:30:00',
      latestEndTime: '22:00:00',
      gameDefaultStart: '19:00',
      gameDefaultEnd: '23:00',
    });
    expect(out).toEqual({ start: '19:30', end: '22:00' });
  });
});

describe('getTopNDates', () => {
  it('returns up to N date strings from viable list', () => {
    const viable = [
      mkSuggestion({ date: '2026-05-01' }),
      mkSuggestion({ date: '2026-05-02' }),
      mkSuggestion({ date: '2026-05-03' }),
    ];
    expect(getTopNDates(viable, 2)).toEqual(['2026-05-01', '2026-05-02']);
  });
});
