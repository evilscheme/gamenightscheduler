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
  it('returns "high" when >= 80% available', () => {
    expect(getCellTintTier(mkSuggestion({ availableCount: 4 }))).toBe('high');
    expect(getCellTintTier(mkSuggestion({ availableCount: 5 }))).toBe('high');
  });
  it('returns "medium" when 60-79% available', () => {
    expect(getCellTintTier(mkSuggestion({ availableCount: 3 }))).toBe('medium');
  });
  it('returns "maybe" when >= 40% available OR any maybe without majority', () => {
    expect(getCellTintTier(mkSuggestion({ availableCount: 2 }))).toBe('maybe');
    expect(getCellTintTier(mkSuggestion({ maybeCount: 3 }))).toBe('maybe');
  });
  it('returns "warning" when > 0 available but below maybe tier', () => {
    expect(getCellTintTier(mkSuggestion({ availableCount: 1 }))).toBe('warning');
  });
  it('prefers "maybe" over "warning" when availableCount low but maybeCount > 0', () => {
    expect(getCellTintTier(mkSuggestion({ availableCount: 1, maybeCount: 2 }))).toBe('maybe');
  });
  it('returns "warning" explicitly when maybeCount is 0 and 0 < availableCount < 0.4 * total', () => {
    expect(getCellTintTier(mkSuggestion({ availableCount: 1, maybeCount: 0, unavailableCount: 4 }))).toBe('warning');
  });
  it('returns "conflict" when 0 available and no maybe', () => {
    expect(getCellTintTier(mkSuggestion({ unavailableCount: 5 }))).toBe('conflict');
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
