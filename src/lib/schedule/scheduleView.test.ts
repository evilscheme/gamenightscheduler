import { describe, it, expect } from 'vitest';
import {
  partitionByThreshold,
  formatTimeWindow,
  splitUpcomingPast,
  computeDefaultSessionTimes,
  getTopNDates,
  resolveDateState,
  showsPendingMark,
  describeDateState,
} from './scheduleView';
import type { DateSuggestion, GameSession } from '@/types';
import type { DateState } from './scheduleView';

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
  threshold: 3,
  ...overrides,
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
      { id: 'a', game_id: 'g', date: '2026-04-20', start_time: null, end_time: null, status: 'confirmed', confirmed_by: null, location: null, notes: null, created_at: '' },
      { id: 'b', game_id: 'g', date: '2026-04-23', start_time: null, end_time: null, status: 'confirmed', confirmed_by: null, location: null, notes: null, created_at: '' },
      { id: 'c', game_id: 'g', date: '2026-04-30', start_time: null, end_time: null, status: 'confirmed', confirmed_by: null, location: null, notes: null, created_at: '' },
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

describe('resolveDateState', () => {
  // 6 players, threshold 4 — the running example from the design
  const six = (o: Partial<DateSuggestion>) => mkSuggestion({ totalPlayers: 6, ...o });

  it('resolves all seven states', () => {
    expect(resolveDateState(six({ availableCount: 1, unavailableCount: 3, pendingCount: 2 }), 4))
      .toBe('not-enough');
    expect(resolveDateState(six({ availableCount: 1, pendingCount: 5 }), 4))
      .toBe('unknown');
    expect(resolveDateState(six({ availableCount: 2, maybeCount: 2, pendingCount: 2 }), 4))
      .toBe('enough-if-maybes');
    expect(resolveDateState(six({ availableCount: 3, maybeCount: 3 }), 4))
      .toBe('everyone-if-maybes');
    expect(resolveDateState(six({ availableCount: 4, unavailableCount: 2 }), 4))
      .toBe('enough');
    expect(resolveDateState(six({ availableCount: 4, maybeCount: 2 }), 4))
      .toBe('enough-maybe-everyone');
    expect(resolveDateState(six({ availableCount: 6 }), 4))
      .toBe('everyone');
  });

  it('declares a date dead only when silent players cannot save it', () => {
    // 2 no of 6, threshold 4 → optimistic ceiling 4, still alive
    expect(resolveDateState(six({ unavailableCount: 2, pendingCount: 4 }), 4)).toBe('unknown');
    // 3 no of 6 → optimistic ceiling 3 < 4, dead at only 50% response
    expect(resolveDateState(six({ unavailableCount: 3, pendingCount: 3 }), 4)).toBe('not-enough');
  });

  it('never lets pending responses support a positive claim', () => {
    // 3 yes + 3 silent could become everyone, but nothing is evidenced yet
    expect(resolveDateState(six({ availableCount: 3, pendingCount: 3 }), 4)).toBe('unknown');
  });

  it('is gray when nobody has answered, not red and not green', () => {
    expect(resolveDateState(six({ pendingCount: 6 }), 4)).toBe('unknown');
  });

  it('treats a full house as "everyone" even when the threshold is lower', () => {
    expect(resolveDateState(six({ availableCount: 6 }), 3)).toBe('everyone');
  });

  it('returns unknown for a game with no players', () => {
    expect(resolveDateState(mkSuggestion({ totalPlayers: 0 }), 0)).toBe('unknown');
  });

  it('reddens every date when the GM minimum exceeds the roster', () => {
    expect(resolveDateState(mkSuggestion({ totalPlayers: 5, availableCount: 5 }), 8))
      .toBe('not-enough');
  });
});

describe('date state invariants', () => {
  // Exhaustive sweep over every reachable response split for a 6-player game.
  const splits: DateSuggestion[] = [];
  for (let a = 0; a <= 6; a++)
    for (let m = 0; a + m <= 6; m++)
      for (let u = 0; a + m + u <= 6; u++)
        splits.push(mkSuggestion({
          totalPlayers: 6,
          availableCount: a,
          maybeCount: m,
          unavailableCount: u,
          pendingCount: 6 - a - m - u,
        }));

  it('never shows an "everyone"-flavoured state while someone is still silent', () => {
    const everyoneish: DateState[] = ['everyone', 'enough-maybe-everyone', 'everyone-if-maybes'];
    for (const s of splits) {
      if (everyoneish.includes(resolveDateState(s, 4))) {
        expect(s.pendingCount).toBe(0);
      }
    }
  });

  it('always has someone still silent when the state is unknown', () => {
    for (const s of splits) {
      if (resolveDateState(s, 4) === 'unknown') {
        expect(s.pendingCount).toBeGreaterThan(0);
      }
    }
  });

  it('never shows a badge and a pending mark on the same cell', () => {
    const badged: DateState[] = ['everyone', 'enough-maybe-everyone', 'everyone-if-maybes'];
    for (const s of splits) {
      const state = resolveDateState(s, 4);
      expect(badged.includes(state) && showsPendingMark(s, state)).toBe(false);
    }
  });

  it('marks pending only on the two states where it is actionable', () => {
    for (const s of splits) {
      const state = resolveDateState(s, 4);
      if (showsPendingMark(s, state)) {
        expect(['enough', 'enough-if-maybes']).toContain(state);
      }
    }
  });
});

describe('describeDateState', () => {
  const six = (o: Partial<DateSuggestion>) => mkSuggestion({ totalPlayers: 6, ...o });

  it('explains a roster smaller than the GM minimum', () => {
    expect(describeDateState(mkSuggestion({ totalPlayers: 5, availableCount: 5 }), 8))
      .toBe('This game needs 8 players but only 5 have joined');
  });

  it('names a full house', () => {
    expect(describeDateState(six({ availableCount: 6 }), 4))
      .toBe('All 6 players are available');
  });

  it('mentions the upside when maybes could make it everyone', () => {
    expect(describeDateState(six({ availableCount: 4, maybeCount: 2 }), 4))
      .toBe('4 of 6 available — everyone, if both maybes work out');
  });

  it('mentions who is still silent on an otherwise settled date', () => {
    expect(describeDateState(six({ availableCount: 4, pendingCount: 2 }), 4))
      .toBe('4 available, 4 needed — 2 still haven’t answered');
  });

  it('does not mention silence when everyone has answered', () => {
    expect(describeDateState(six({ availableCount: 4, unavailableCount: 2 }), 4))
      .toBe('4 available, 4 needed');
  });

  it('explains a date that would be everyone if the maybes work out', () => {
    expect(describeDateState(six({ availableCount: 3, maybeCount: 3 }), 4))
      .toBe('3 available and 3 maybes — everyone, if all maybes work out');
  });

  it('explains a date that is only viable via maybes', () => {
    expect(describeDateState(six({ availableCount: 2, maybeCount: 2, pendingCount: 2 }), 4))
      .toBe('2 available, 4 needed — enough only if both maybes work out');
  });

  it('names only the number of maybes actually needed', () => {
    // 2 available, 3 maybe, 1 pending — only 2 of the 3 maybes are required
    expect(describeDateState(six({ availableCount: 2, maybeCount: 3, pendingCount: 1 }), 4))
      .toBe('2 available, 4 needed — enough if 2 of the 3 maybes work out');
  });

  it('uses a singular verb when a single maybe would do', () => {
    // 3 available, 2 maybe, 1 unavailable — any one maybe gets there
    expect(describeDateState(six({ availableCount: 3, maybeCount: 2, unavailableCount: 1 }), 4))
      .toBe('3 available, 4 needed — enough if 1 of the 2 maybes works out');
  });

  it('still says "only if" when every maybe is required', () => {
    // 3 available, 1 maybe, 2 unavailable — that single maybe is essential
    expect(describeDateState(six({ availableCount: 3, maybeCount: 1, unavailableCount: 2 }), 4))
      .toBe('3 available, 4 needed — enough only if the maybe works out');
  });

  it('explains why a date is greyed out', () => {
    expect(describeDateState(six({ availableCount: 1, pendingCount: 5 }), 4))
      .toBe('Not enough responses yet — 5 of 6 haven’t answered');
  });

  it('explains why a date is dead', () => {
    expect(describeDateState(six({ unavailableCount: 3, pendingCount: 3 }), 4))
      .toBe('Can’t happen — 3 of 6 can’t make it, and 4 are needed');
  });

  it('uses singular wording for a single maybe', () => {
    expect(describeDateState(six({ availableCount: 4, maybeCount: 1, pendingCount: 1 }), 4))
      .toBe('4 available, 4 needed — 1 still hasn’t answered');
  });
});
