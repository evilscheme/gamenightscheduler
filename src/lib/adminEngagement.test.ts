import { describe, it, expect } from 'vitest';
import {
  buildRollingEngagement,
  getRollingBucketKey,
  type EngagementInputs,
} from './adminEngagement';
import { startOfDay } from 'date-fns';

const EMPTY: EngagementInputs = { users: [], games: [], sessions: [], availability: [] };

// Reference "now": Wed 2025-01-15, midday-local. Timestamps use local values (no
// trailing Z) so day bucketing is stable across the runner's timezone — matching
// the local-day bucketing the app itself does.
const NOW = new Date('2025-01-15T12:00:00');
const END_EXCLUSIVE = startOfDay(NOW); // 2025-01-15T00:00 local

// Rolling windows anchored on 2025-01-15, labeled by their END day:
//   bucket 0 = Jan 8–14 (last 7 complete days) -> windowEnd '2025-01-14' (yesterday)
//   bucket 1 = Jan 1–7                          -> windowEnd '2025-01-07'
//   bucket 2 = Dec 25–31                        -> windowEnd '2024-12-31'
const BUCKET0 = '2025-01-14';
const BUCKET1 = '2025-01-07';
const BUCKET2 = '2024-12-31';

const TODAY = '2025-01-15T09:00:00'; // incomplete -> excluded
const YESTERDAY = '2025-01-14T18:00:00'; // most recent complete day -> bucket 0
const IN_BUCKET0 = '2025-01-10T12:00:00';
const IN_BUCKET1 = '2025-01-03T12:00:00';
const IN_BUCKET2 = '2024-12-28T12:00:00';

describe('getRollingBucketKey', () => {
  it('maps yesterday and the last 7 days into the most recent window', () => {
    expect(getRollingBucketKey(YESTERDAY, END_EXCLUSIVE)).toBe(BUCKET0);
    expect(getRollingBucketKey('2025-01-08T00:00:00', END_EXCLUSIVE)).toBe(BUCKET0); // 7 days ago -> still bucket 0
  });

  it('steps back a full 7 days for the previous window', () => {
    expect(getRollingBucketKey('2025-01-07T23:00:00', END_EXCLUSIVE)).toBe(BUCKET1);
    expect(getRollingBucketKey(IN_BUCKET2, END_EXCLUSIVE)).toBe(BUCKET2);
  });

  it('returns null for today and future dates (incomplete)', () => {
    expect(getRollingBucketKey(TODAY, END_EXCLUSIVE)).toBeNull();
    expect(getRollingBucketKey('2025-01-20T12:00:00', END_EXCLUSIVE)).toBeNull();
  });

  it('accepts a Date as well as a string', () => {
    expect(getRollingBucketKey(new Date(YESTERDAY), END_EXCLUSIVE)).toBe(BUCKET0);
  });
});

describe('buildRollingEngagement', () => {
  it('returns an empty array with no data', () => {
    expect(buildRollingEngagement(EMPTY, NOW)).toEqual([]);
  });

  it('includes yesterday in the most recent window — no multi-day lag', () => {
    const result = buildRollingEngagement({ ...EMPTY, users: [{ created_at: YESTERDAY }] }, NOW);
    expect(result.map((b) => b.windowEnd)).toEqual([BUCKET0]);
    expect(result[0].newUsers).toBe(1);
  });

  it('excludes the current (incomplete) day', () => {
    const result = buildRollingEngagement(
      {
        ...EMPTY,
        users: [{ created_at: TODAY }, { created_at: IN_BUCKET0 }],
      },
      NOW
    );
    expect(result.map((b) => b.windowEnd)).toEqual([BUCKET0]);
    expect(result[0].newUsers).toBe(1);
  });

  it('drops future-dated rows too', () => {
    const result = buildRollingEngagement(
      {
        ...EMPTY,
        games: [{ created_at: '2025-02-01T12:00:00' }, { created_at: IN_BUCKET0 }],
      },
      NOW
    );
    expect(result.map((b) => b.windowEnd)).toEqual([BUCKET0]);
  });

  it('buckets each metric into the correct rolling window and sorts chronologically', () => {
    const result = buildRollingEngagement(
      {
        users: [{ created_at: IN_BUCKET0 }, { created_at: IN_BUCKET1 }],
        games: [{ created_at: IN_BUCKET0 }],
        sessions: [
          { created_at: IN_BUCKET0, status: 'confirmed' },
          { created_at: IN_BUCKET0, status: 'pending' }, // ignored
        ],
        availability: [],
      },
      NOW
    );
    expect(result.map((b) => b.windowEnd)).toEqual([BUCKET1, BUCKET0]);
    expect(result.find((b) => b.windowEnd === BUCKET0)!).toMatchObject({
      newUsers: 1,
      newGames: 1,
      sessionsConfirmed: 1,
    });
    expect(result.find((b) => b.windowEnd === BUCKET1)!.newUsers).toBe(1);
  });

  it('counts distinct active users per window', () => {
    const result = buildRollingEngagement(
      {
        ...EMPTY,
        availability: [
          { user_id: 'a', updated_at: IN_BUCKET0 },
          { user_id: 'a', updated_at: YESTERDAY }, // same user, same window
          { user_id: 'b', updated_at: IN_BUCKET0 },
          { user_id: 'a', updated_at: TODAY }, // today -> dropped
        ],
      },
      NOW
    );
    expect(result.map((b) => b.windowEnd)).toEqual([BUCKET0]);
    expect(result[0].activeUsers).toBe(2);
  });

  it('zero-fills gaps between data windows (all time)', () => {
    // Data in bucket 0 and bucket 2, nothing in bucket 1 -> continuous, gap = 0.
    const result = buildRollingEngagement(
      {
        ...EMPTY,
        users: [{ created_at: IN_BUCKET0 }, { created_at: IN_BUCKET2 }],
      },
      NOW
    );
    expect(result.map((b) => b.windowEnd)).toEqual([BUCKET2, BUCKET1, BUCKET0]);
    expect(result.find((b) => b.windowEnd === BUCKET1)).toMatchObject({
      newUsers: 0,
      newGames: 0,
      sessionsConfirmed: 0,
      activeUsers: 0,
    });
  });

  it('emits exactly `windows` windows, zero-filling empties (bounded range)', () => {
    const result = buildRollingEngagement(
      { ...EMPTY, users: [{ created_at: IN_BUCKET0 }] },
      NOW,
      3
    );
    expect(result.map((b) => b.windowEnd)).toEqual([BUCKET2, BUCKET1, BUCKET0]);
    expect(result[0]).toMatchObject({ windowEnd: BUCKET2, newUsers: 0 });
    expect(result[1]).toMatchObject({ windowEnd: BUCKET1, newUsers: 0 });
    expect(result[2]).toMatchObject({ windowEnd: BUCKET0, newUsers: 1 });
  });

  it('emits all-zero windows when the bounded range has no data at all', () => {
    const result = buildRollingEngagement(EMPTY, NOW, 2);
    expect(result.map((b) => b.windowEnd)).toEqual([BUCKET1, BUCKET0]);
    expect(result.every((b) => b.newUsers === 0 && b.activeUsers === 0)).toBe(true);
  });
});
