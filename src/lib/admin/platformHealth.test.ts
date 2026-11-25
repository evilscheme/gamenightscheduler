import { describe, it, expect } from 'vitest';
import {
  FUNNEL_POOL_WEEKS,
  FUNNEL_WINDOW_DAYS,
  buildBucketTimeline,
  buildDeletions,
  buildDormancy,
  buildFunnelCohorts,
  buildGameNights,
  computeCurrentStats,
  computeDailyStats,
  currentGameStatuses,
  indexPlatform,
  liveCount,
  type PlatformInputs,
  type StateCounts,
} from './platformHealth';

// Timestamps use local values (no trailing Z) so day boundaries are stable across
// the runner's timezone — matching the local-day bucketing the app does.
const NOW = new Date('2025-01-15T12:00:00');
// Rolling windows (see adminEngagement.test.ts): bucket 0 ends 01-14, 1 ends 01-07.
const BUCKET0 = '2025-01-14';
const BUCKET1 = '2025-01-07';

const EMPTY: PlatformInputs = {
  users: [],
  games: [],
  memberships: [],
  sessions: [],
  availability: [],
  playDates: [],
};

function game(id: string, gm_id: string, created_at: string): PlatformInputs['games'][number] {
  return {
    id,
    gm_id,
    created_at,
    play_days: [5], // Fridays
    scheduling_window_months: 1,
    campaign_start_date: null,
    campaign_end_date: null,
    min_players_needed: 0,
  };
}

describe('computeDailyStats', () => {
  // gm hosts g1 with player p; a session on 01-20 was booked on 01-05.
  const base: PlatformInputs = {
    ...EMPTY,
    users: [
      { id: 'gm', created_at: '2024-12-01T10:00:00' },
      { id: 'p', created_at: '2024-12-02T10:00:00' },
      { id: 'idle', created_at: '2024-12-03T10:00:00' }, // never joins anything
    ],
    games: [game('g1', 'gm', '2024-12-01T11:00:00')],
    memberships: [{ game_id: 'g1', user_id: 'p', joined_at: '2024-12-02T11:00:00' }],
    sessions: [{ game_id: 'g1', date: '2025-01-20', created_at: '2025-01-05T09:00:00', status: 'confirmed' }],
  };

  const tracked = (c: StateCounts) => ({
    healthy: c.healthyBooked + c.healthyViable,
    gettingGoing: c.gettingGoing,
    unhealthy: c.unhealthy,
  });
  const gameState = (s: ReturnType<typeof computeDailyStats>) => ({ ...tracked(s.games), dormant: s.games.total - liveCount(s.games) });
  const userState = (s: ReturnType<typeof computeDailyStats>) => ({ ...tracked(s.users), churned: s.users.total - liveCount(s.users) });

  it('ignores rows that did not exist yet on the day', () => {
    const data = indexPlatform(base);
    expect(computeDailyStats(data, '2024-11-30')).toMatchObject({ users: { total: 0 }, games: { total: 0 } });
    expect(computeDailyStats(data, '2024-12-02')).toMatchObject({ users: { total: 2 }, games: { total: 1 } });
  });

  it('moves a game through getting going, unhealthy, healthy, unhealthy, dormant', () => {
    const data = indexPlatform(base);
    const at = (day: string) => gameState(computeDailyStats(data, day));
    const only = (state: string) => ({ healthy: 0, gettingGoing: 0, unhealthy: 0, dormant: 0, [state]: 1 });
    expect(at('2024-12-02')).toEqual(only('gettingGoing')); // p just joined
    expect(at('2024-12-10')).toEqual(only('unhealthy')); // nothing booked, quiet 8 days
    expect(at('2025-01-05')).toEqual(only('healthy')); // session booked, has a player
    expect(at('2025-01-19')).toEqual(only('healthy')); // quiet for two weeks, but still booked
    expect(at('2025-01-20')).toEqual(only('unhealthy')); // play date no longer upcoming
    expect(at('2025-03-05')).toEqual(only('unhealthy')); // last activity 01-05 09:00, < 60 days
    expect(at('2025-03-06')).toEqual(only('dormant'));
  });

  it('keeps a quiet game healthy for as long as a session is on the books', () => {
    const data = indexPlatform({
      ...base,
      sessions: [{ game_id: 'g1', date: '2025-06-01', created_at: '2025-01-05T09:00:00', status: 'confirmed' }],
    });
    // Nearly five months without anyone opening the app.
    expect(computeDailyStats(data, '2025-05-31').games.healthyBooked).toBe(1);
  });

  it('needs a player besides the host for a booked game to be healthy', () => {
    const data = indexPlatform({ ...base, memberships: [] });
    expect(gameState(computeDailyStats(data, '2025-01-05'))).toMatchObject({ healthy: 0, gettingGoing: 1 });
  });

  it('counts everyone in a healthy game as healthy, dates entered or not', () => {
    // Neither gm nor p has entered availability: they still have a game to go to.
    expect(userState(computeDailyStats(indexPlatform(base), '2025-01-05'))).toMatchObject({ healthy: 2 });
  });

  it("follows a user's best game", () => {
    // p also hosts a game nobody joined; being in the healthy g1 wins.
    const data = indexPlatform({ ...base, games: [...base.games, game('g2', 'p', '2024-12-02T12:00:00')] });
    expect(userState(computeDailyStats(data, '2025-01-05'))).toMatchObject({ healthy: 2 });
  });

  it('gives a new user a week before counting them unhealthy, and drops them at 60 days', () => {
    // Tracks 'idle' (no game); gm and p follow g1, which is unhealthy from 12-10 on.
    const data = indexPlatform(base);
    const at = (day: string) => userState(computeDailyStats(data, day));
    expect(at('2024-12-05')).toMatchObject({ gettingGoing: 3 }); // all three within a week
    expect(at('2024-12-10')).toMatchObject({ unhealthy: 3 }); // idle past the week's grace
    expect(at('2025-01-30')).toMatchObject({ unhealthy: 3, churned: 0 }); // idle: 58 days
    expect(at('2025-02-01')).toMatchObject({ unhealthy: 2, churned: 1 }); // idle: 60+ days, no game
  });

  it('churns the players of a dormant game', () => {
    expect(userState(computeDailyStats(indexPlatform(base), '2025-03-06'))).toEqual({
      healthy: 0,
      gettingGoing: 0,
      unhealthy: 0,
      churned: 3,
    });
  });
});

describe('viable dates', () => {
  // gm hosts g1 (plays Fridays) with player p; nothing is booked. With 2 players
  // the threshold is 2, so a date is viable when both are available.
  const users = [
    { id: 'gm', created_at: '2024-12-01T10:00:00' },
    { id: 'p', created_at: '2024-12-02T10:00:00' },
  ];
  const avail = (user_id: string, date: string, status = 'available') => ({
    game_id: 'g1', user_id, date, status, created_at: '2025-01-05T10:00:00', updated_at: '2025-01-05T10:00:00',
  });
  const withDates = (availability: PlatformInputs['availability'], extra: Partial<PlatformInputs> = {}) =>
    indexPlatform({
      ...EMPTY,
      users,
      games: [game('g1', 'gm', '2024-12-01T11:00:00')],
      memberships: [{ game_id: 'g1', user_id: 'p', joined_at: '2024-12-02T11:00:00' }],
      availability,
      ...extra,
    });

  it('counts a game as healthy when enough players can make an upcoming date', () => {
    const data = withDates([avail('gm', '2025-01-17'), avail('p', '2025-01-17')]); // a Friday
    expect(computeDailyStats(data, '2025-01-10')).toMatchObject({
      games: { healthyBooked: 0, healthyViable: 1 },
      users: { healthyViable: 2 },
    });
  });

  it('does not count maybes toward the threshold', () => {
    const data = withDates([avail('gm', '2025-01-17'), avail('p', '2025-01-17', 'maybe')]);
    expect(computeDailyStats(data, '2025-01-10').games.healthyViable).toBe(0);
  });

  it('honors an explicit GM minimum the roster cannot reach', () => {
    const g = { ...game('g1', 'gm', '2024-12-01T11:00:00'), min_players_needed: 3 };
    const data = withDates([avail('gm', '2025-01-17'), avail('p', '2025-01-17')], { games: [g] });
    expect(computeDailyStats(data, '2025-01-10').games.healthyViable).toBe(0);
  });

  it('only looks six weeks ahead', () => {
    const data = withDates([avail('gm', '2025-03-14'), avail('p', '2025-03-14')]); // a Friday
    expect(computeDailyStats(data, '2025-01-10').games.healthyViable).toBe(0); // 9 weeks out
    expect(computeDailyStats(data, '2025-02-01').games.healthyViable).toBe(1); // 6 weeks out
  });

  it('only counts eligible play dates, including extra dates', () => {
    const saturday = [avail('gm', '2025-01-18'), avail('p', '2025-01-18')];
    expect(computeDailyStats(withDates(saturday), '2025-01-10').games.healthyViable).toBe(0);
    const extra = { playDates: [{ game_id: 'g1', date: '2025-01-18', created_at: '2025-01-04T10:00:00' }] };
    expect(computeDailyStats(withDates(saturday, extra), '2025-01-10').games.healthyViable).toBe(1);
  });

  it("only counts dates on the game's calendar, within its scheduling window", () => {
    // A 1-month window seen from 01-31 ends 02-28; a date entered earlier for 03-07
    // (inside six weeks) is no longer on the calendar after the window was shortened.
    const data = withDates([avail('gm', '2025-03-07'), avail('p', '2025-03-07')]);
    expect(computeDailyStats(data, '2025-01-30').games.healthyViable).toBe(0);
    // Once the window reaches March, the same date counts.
    expect(computeDailyStats(data, '2025-02-01').games.healthyViable).toBe(1);
  });

  it('prefers booked over viable when a game has both', () => {
    const data = withDates([avail('gm', '2025-01-17'), avail('p', '2025-01-17')], {
      sessions: [{ game_id: 'g1', date: '2025-01-24', created_at: '2025-01-06T10:00:00', status: 'confirmed' }],
    });
    expect(computeDailyStats(data, '2025-01-10')).toMatchObject({ games: { healthyBooked: 1, healthyViable: 0 } });
  });

  it('needs a player besides the host', () => {
    const data = withDates([avail('gm', '2025-01-17')], { memberships: [] });
    expect(computeDailyStats(data, '2025-01-10').games.healthyViable).toBe(0);
  });

  it('reports the earliest viable date right now', () => {
    const data = withDates([
      avail('gm', '2025-01-24'), avail('p', '2025-01-24'),
      avail('gm', '2025-01-17'), avail('p', '2025-01-17'),
    ]);
    expect(currentGameStatuses(data, NOW).get('g1')).toMatchObject({
      bucket: 'healthyViable',
      viableDate: { date: '2025-01-17', available: 2, needed: 2 },
    });
  });

  it('keeps a quiet game with viable dates ahead from going dormant', () => {
    // Every Friday from October to March entered in one burst on 10-02, then silence.
    const fridays: string[] = [];
    for (let d = new Date('2024-10-04T00:00:00'); d < new Date('2025-03-29T00:00:00'); d.setDate(d.getDate() + 7)) {
      fridays.push(d.toLocaleDateString('sv-SE'));
    }
    const burst = fridays.flatMap((date) =>
      ['gm', 'p'].map((user_id) => ({ ...avail(user_id, date), created_at: '2024-10-02T10:00:00', updated_at: '2024-10-02T10:00:00' }))
    );
    const data = indexPlatform({
      ...EMPTY,
      users,
      games: [game('g1', 'gm', '2024-10-01T11:00:00')],
      memberships: [{ game_id: 'g1', user_id: 'p', joined_at: '2024-10-01T12:00:00' }],
      availability: burst,
    });
    expect(buildDormancy(data, NOW, 16).every((b) => b.wentDormant === 0)).toBe(true);
    expect(computeDailyStats(data, '2025-01-14').games.healthyViable).toBe(1); // 104 days quiet
  });
});

describe('currentGameStatuses', () => {
  const inputs: PlatformInputs = {
    ...EMPTY,
    games: [game('g1', 'gm', '2024-12-01T11:00:00'), game('g2', 'gm', '2024-10-01T11:00:00')],
    memberships: [{ game_id: 'g1', user_id: 'p', joined_at: '2024-12-02T11:00:00' }],
    // NOW is 01-15 at noon: a session tonight is still upcoming.
    sessions: [{ game_id: 'g1', date: '2025-01-15', created_at: '2024-12-20T09:00:00', status: 'confirmed' }],
  };

  it('classifies each game right now, counting a session today as upcoming', () => {
    const statuses = currentGameStatuses(indexPlatform(inputs), NOW);
    expect(statuses.get('g1')).toEqual({
      bucket: 'healthyBooked',
      viableDate: null,
      lastActivity: new Date('2024-12-20T09:00:00').getTime(),
    });
    expect(statuses.get('g2')?.bucket).toBe('dormant');
  });

  it('counts users right now by the same rules', () => {
    const data = indexPlatform({
      ...inputs,
      users: [
        { id: 'gm', created_at: '2024-11-01T10:00:00' },
        { id: 'p', created_at: '2024-11-02T10:00:00' },
        { id: 'new', created_at: '2025-01-14T10:00:00' }, // yesterday, no game yet
        { id: 'gone', created_at: '2024-09-01T10:00:00' }, // never joined
      ],
    });
    expect(computeCurrentStats(data, NOW)).toMatchObject({
      day: '2025-01-15',
      // gm and p: g1 has a session tonight. 'new' is in their first week; 'gone' churned.
      users: { total: 4, healthyBooked: 2, gettingGoing: 1, unhealthy: 0 },
    });
  });

  it('agrees with the end-of-day classification', () => {
    // Yesterday's end-of-day stats and a "now" just after midnight see the same state.
    const data = indexPlatform(inputs);
    const daily = computeDailyStats(data, '2025-01-14');
    const now = currentGameStatuses(data, new Date('2025-01-15T00:00:01'));
    expect(daily.games.healthyBooked).toBe([...now.values()].filter((g) => g.bucket === 'healthyBooked').length);
  });
});

describe('buildFunnelCohorts', () => {
  const avail = (game_id: string, user_id: string, date: string, created_at: string, status = 'available') => ({
    game_id, user_id, date, status, created_at, updated_at: created_at,
  });

  it('tracks each pooled cohort through join, availability, and game night', () => {
    const result = buildFunnelCohorts(
      indexPlatform({
        ...EMPTY,
        users: [
          { id: 'gm', created_at: '2025-01-02T10:00:00' }, // bucket 1, hosts g1
          { id: 'p', created_at: '2025-01-10T10:00:00' }, // bucket 0, joined + entered dates
          { id: 'lurker', created_at: '2025-01-11T10:00:00' }, // bucket 0, nothing
          { id: 'today', created_at: '2025-01-15T09:00:00' }, // today -> excluded
        ],
        games: [game('g1', 'gm', '2025-01-02T11:00:00')],
        memberships: [{ game_id: 'g1', user_id: 'p', joined_at: '2025-01-10T11:00:00' }],
        // Booked 01-11 with two players: healthyBooked from the end of that day.
        sessions: [{ game_id: 'g1', date: '2025-01-24', created_at: '2025-01-11T10:00:00', status: 'confirmed' }],
        availability: [avail('g1', 'p', '2025-01-17', '2025-01-10T12:00:00')],
      }),
      NOW,
      2
    );
    expect(result).toEqual([
      { windowEnd: BUCKET1, signups: 1, joinedGame: 1, enteredAvailability: 0, foundGameNight: 1, bookedGameNight: 1, mature: false },
      // Pools buckets 0–3, so gm's week is in it too.
      { windowEnd: BUCKET0, signups: 3, joinedGame: 2, enteredAvailability: 1, foundGameNight: 2, bookedGameNight: 2, mature: false },
    ]);
  });

  it('does not credit a session held before the player joined that game', () => {
    // Signed up 01-01, joined 01-10; the game was booked for 01-05 (q made it
    // healthy) and nothing is booked after p came in.
    const data = indexPlatform({
      ...EMPTY,
      users: [
        { id: 'gm', created_at: '2024-12-01T10:00:00' },
        { id: 'p', created_at: '2025-01-01T10:00:00' },
      ],
      games: [game('g1', 'gm', '2024-12-01T11:00:00')],
      memberships: [
        { game_id: 'g1', user_id: 'q', joined_at: '2024-12-02T11:00:00' },
        { game_id: 'g1', user_id: 'p', joined_at: '2025-01-10T11:00:00' },
      ],
      sessions: [{ game_id: 'g1', date: '2025-01-05', created_at: '2024-12-20T10:00:00', status: 'confirmed' }],
    });
    // One point pools buckets 0–3: p only (gm signed up in bucket 6).
    expect(buildFunnelCohorts(data, NOW, 1)).toEqual([
      { windowEnd: BUCKET0, signups: 1, joinedGame: 1, enteredAvailability: 0, foundGameNight: 0, bookedGameNight: 0, mature: false },
    ]);
  });

  it('credits a session played while they were in the game, even one no end-of-day bucket shows', () => {
    // Neither session is ever "upcoming" at a day's end: ga's is booked and played
    // on 01-10, gb's is played on 01-10, the day b joins. gc's was played the day
    // before c joined, so it does not count.
    const data = indexPlatform({
      ...EMPTY,
      users: [
        { id: 'gm', created_at: '2024-09-01T10:00:00' }, // outside the range
        { id: 'a', created_at: '2025-01-08T10:00:00' },
        { id: 'b', created_at: '2025-01-08T11:00:00' },
        { id: 'c', created_at: '2025-01-08T12:00:00' },
      ],
      games: [
        game('ga', 'gm', '2024-09-01T11:00:00'),
        game('gb', 'gm', '2024-09-01T12:00:00'),
        game('gc', 'gm', '2024-09-01T13:00:00'),
      ],
      memberships: [
        { game_id: 'ga', user_id: 'a', joined_at: '2025-01-08T13:00:00' },
        { game_id: 'gb', user_id: 'q', joined_at: '2024-09-02T10:00:00' },
        { game_id: 'gb', user_id: 'b', joined_at: '2025-01-10T09:00:00' },
        { game_id: 'gc', user_id: 'q', joined_at: '2024-09-02T10:00:00' },
        { game_id: 'gc', user_id: 'c', joined_at: '2025-01-10T09:00:00' },
      ],
      sessions: [
        { game_id: 'ga', date: '2025-01-10', created_at: '2025-01-10T08:00:00', status: 'confirmed' },
        { game_id: 'gb', date: '2025-01-10', created_at: '2025-01-03T08:00:00', status: 'confirmed' },
        { game_id: 'gc', date: '2025-01-09', created_at: '2025-01-03T08:00:00', status: 'confirmed' },
      ],
    });
    expect(buildFunnelCohorts(data, NOW, 1)).toEqual([
      { windowEnd: BUCKET0, signups: 3, joinedGame: 3, enteredAvailability: 0, foundGameNight: 2, bookedGameNight: 2, mature: false },
    ]);
  });

  it(`counts a step reached on day ${FUNNEL_WINDOW_DAYS} after signup, not day ${FUNNEL_WINDOW_DAYS + 1}`, () => {
    // a and b sign up 12-01: day 21 is 12-22, day 22 is 12-23. Each joins a game
    // the host books just before they come in, and enters a date right after.
    const data = indexPlatform({
      ...EMPTY,
      users: [
        { id: 'gm', created_at: '2024-09-01T10:00:00' }, // outside the range
        { id: 'a', created_at: '2024-12-01T10:00:00' },
        { id: 'b', created_at: '2024-12-01T11:00:00' },
      ],
      games: [game('ga', 'gm', '2024-09-01T11:00:00'), game('gb', 'gm', '2024-09-01T12:00:00')],
      memberships: [
        { game_id: 'ga', user_id: 'a', joined_at: '2024-12-22T23:00:00' },
        { game_id: 'gb', user_id: 'b', joined_at: '2024-12-23T00:30:00' },
      ],
      sessions: [
        { game_id: 'ga', date: '2025-01-31', created_at: '2024-12-22T22:00:00', status: 'confirmed' },
        { game_id: 'gb', date: '2025-01-31', created_at: '2024-12-23T00:00:00', status: 'confirmed' },
      ],
      availability: [
        avail('ga', 'a', '2025-01-03', '2024-12-22T23:30:00'),
        avail('gb', 'b', '2025-01-03', '2024-12-23T01:00:00'),
      ],
    });
    // The oldest of 7 points is bucket 6 (11-27 to 12-03), pooling buckets 6–9.
    expect(buildFunnelCohorts(data, NOW, 7)[0]).toEqual({
      windowEnd: '2024-12-03',
      signups: 2,
      joinedGame: 1,
      enteredAvailability: 1,
      foundGameNight: 1,
      bookedGameNight: 1,
      mature: true,
    });
  });

  it('credits a date found as a game night, but not as booked', () => {
    // Both players can make Friday 01-17, entered 01-03; nothing is booked.
    const data = indexPlatform({
      ...EMPTY,
      users: [
        { id: 'gm', created_at: '2025-01-01T10:00:00' },
        { id: 'p', created_at: '2025-01-02T10:00:00' },
      ],
      games: [game('g1', 'gm', '2025-01-02T11:00:00')],
      memberships: [{ game_id: 'g1', user_id: 'p', joined_at: '2025-01-02T12:00:00' }],
      availability: [avail('g1', 'gm', '2025-01-17', '2025-01-03T10:00:00'), avail('g1', 'p', '2025-01-17', '2025-01-03T10:00:00')],
    });
    expect(buildFunnelCohorts(data, NOW, 1)).toEqual([
      { windowEnd: BUCKET0, signups: 2, joinedGame: 2, enteredAvailability: 2, foundGameNight: 2, bookedGameNight: 0, mature: false },
    ]);
  });

  it(`pools ${FUNNEL_POOL_WEEKS} weeks per point, fully even for the first point of a range`, () => {
    // Bucket k (k = 0..5) gets k + 1 signups, each on the window's last day.
    const users = [0, 1, 2, 3, 4, 5].flatMap((k) =>
      Array.from({ length: k + 1 }, (_, n) => ({
        id: `u${k}-${n}`,
        created_at: `${new Date(2025, 0, 14 - 7 * k).toLocaleDateString('sv-SE')}T10:00:00`,
      }))
    );
    const data = indexPlatform({ ...EMPTY, users });
    const signups = (cohorts: ReturnType<typeof buildFunnelCohorts>) => cohorts.map((c) => c.signups);
    // Bucket 1 pools 1–4 (2+3+4+5), bucket 0 pools 0–3 (1+2+3+4).
    expect(signups(buildFunnelCohorts(data, NOW, 2))).toEqual([14, 10]);
    // All time: the earliest points pool whatever exists before them.
    expect(signups(buildFunnelCohorts(data, NOW))).toEqual([6, 11, 15, 18, 14, 10]);
  });

  it(`turns mature once windowEnd + ${FUNNEL_WINDOW_DAYS} days is over`, () => {
    // Yesterday is 01-14: 12-24 + 21 days is 01-14 exactly, 12-31 + 21 is 01-21.
    expect(buildFunnelCohorts(indexPlatform(EMPTY), NOW, 5).map((c) => [c.windowEnd, c.mature])).toEqual([
      ['2024-12-17', true],
      ['2024-12-24', true],
      ['2024-12-31', false],
      ['2025-01-07', false],
      [BUCKET0, false],
    ]);
  });
});

describe('buildGameNights', () => {
  const avail = (game_id: string, user_id: string, date: string, status = 'available') => ({
    game_id, user_id, date, status, created_at: '2025-01-05T10:00:00', updated_at: '2025-01-05T10:00:00',
  });
  const session = (game_id: string, date: string) => ({ game_id, date, created_at: '2024-12-20T10:00:00', status: 'confirmed' });
  // g1: gm1 hosts p. g2: gm2 hosts p. Both play Fridays (01-10 is a Friday).
  const base: PlatformInputs = {
    ...EMPTY,
    games: [game('g1', 'gm1', '2024-12-01T11:00:00'), game('g2', 'gm2', '2024-12-01T11:00:00')],
    memberships: [
      { game_id: 'g1', user_id: 'p', joined_at: '2024-12-02T11:00:00' },
      { game_id: 'g2', user_id: 'p', joined_at: '2024-12-02T11:00:00' },
    ],
  };
  const nights = (extra: Partial<PlatformInputs>, windows = 2) =>
    buildGameNights(indexPlatform({ ...base, ...extra }), NOW, windows).map(({ windowEnd, booked, dateFound }) => [windowEnd, booked, dateFound]);

  it("counts a session's roster as of its play date", () => {
    const result = nights({
      memberships: [...base.memberships, { game_id: 'g1', user_id: 'late', joined_at: '2025-01-06T10:00:00' }],
      sessions: [session('g1', '2025-01-05'), session('g1', '2025-01-10')],
    });
    // 'late' joined after the 01-05 session, but was in for 01-10.
    expect(result).toEqual([[BUCKET1, 2, 0], [BUCKET0, 3, 0]]);
  });

  it('counts someone booked in one game and with a date found in another once, as booked', () => {
    const result = nights({
      sessions: [session('g1', '2025-01-10')],
      availability: [avail('g2', 'gm2', '2025-01-10'), avail('g2', 'p', '2025-01-10')],
    });
    // Booked: gm1 and p. Date found: gm2 (p is already booked).
    expect(result).toEqual([[BUCKET1, 0, 0], [BUCKET0, 2, 1]]);
  });

  it('counts a player who joined after the week\'s session for a later workable date', () => {
    // g1 plays Wednesday 01-08 with gm1 and p. 'late' joins on 01-09, and all
    // three can make Friday 01-10.
    const result = nights({
      memberships: [...base.memberships, { game_id: 'g1', user_id: 'late', joined_at: '2025-01-09T10:00:00' }],
      sessions: [session('g1', '2025-01-08')],
      availability: [
        avail('g1', 'gm1', '2025-01-10'),
        avail('g1', 'p', '2025-01-10'),
        { ...avail('g1', 'late', '2025-01-10'), created_at: '2025-01-09T12:00:00', updated_at: '2025-01-09T12:00:00' },
      ],
    });
    // Booked: gm1 and p. Date found: late only, the other two are already booked.
    expect(result).toEqual([[BUCKET1, 0, 0], [BUCKET0, 2, 1]]);
  });

  it('does not count maybes toward the threshold', () => {
    const result = nights({ availability: [avail('g2', 'gm2', '2025-01-10'), avail('g2', 'p', '2025-01-10', 'maybe')] });
    expect(result).toEqual([[BUCKET1, 0, 0], [BUCKET0, 0, 0]]);
  });

  it('counts nobody in a game with only its host', () => {
    const result = nights({
      games: [game('solo', 'gm', '2024-12-01T11:00:00')],
      memberships: [],
      sessions: [session('solo', '2025-01-10')],
      availability: [avail('solo', 'gm', '2025-01-10')],
    });
    expect(result).toEqual([[BUCKET1, 0, 0], [BUCKET0, 0, 0]]);
  });

  it('counts an extra date but not another non-play day', () => {
    const saturday = [avail('g2', 'gm2', '2025-01-11'), avail('g2', 'p', '2025-01-11')];
    expect(nights({ availability: saturday })).toEqual([[BUCKET1, 0, 0], [BUCKET0, 0, 0]]);
    const extra = [{ game_id: 'g2', date: '2025-01-11', created_at: '2025-01-04T10:00:00' }];
    expect(nights({ availability: saturday, playDates: extra })).toEqual([[BUCKET1, 0, 0], [BUCKET0, 0, 2]]);
  });

  it('leaves out a session today', () => {
    expect(nights({ sessions: [session('g1', '2025-01-15')] }, 1)).toEqual([[BUCKET0, 0, 0]]);
    expect(nights({ sessions: [session('g1', '2025-01-14')] }, 1)).toEqual([[BUCKET0, 2, 0]]);
  });
});

describe('buildDormancy', () => {
  it('gives the same buckets for a bounded range as the full history does', () => {
    // Games created and going dormant/reviving at assorted times before and inside the range.
    const data = indexPlatform({
      ...EMPTY,
      games: [
        game('old', 'gm', '2024-06-01T12:00:00'),
        game('mid', 'gm', '2024-10-20T12:00:00'),
        game('new', 'gm', '2024-11-25T12:00:00'),
      ],
      sessions: [
        { game_id: 'old', date: '2025-03-01', created_at: '2024-12-05T12:00:00', status: 'confirmed' }, // revives 'old'
        { game_id: 'mid', date: '2024-12-01', created_at: '2024-11-01T12:00:00', status: 'confirmed' },
      ],
    });
    const full = buildDormancy(data, NOW);
    expect(buildDormancy(data, NOW, 4)).toEqual(full.slice(-4));
    expect(full.slice(-4).some((b) => b.wentDormant || b.revived)).toBe(true); // the range isn't trivially empty
  });

  it('gives the same buckets from a shared timeline as from its own', () => {
    const data = indexPlatform({
      ...EMPTY,
      games: [game('old', 'gm', '2024-06-01T12:00:00'), game('mid', 'gm', '2024-10-20T12:00:00')],
      sessions: [
        { game_id: 'old', date: '2025-03-01', created_at: '2024-12-05T12:00:00', status: 'confirmed' },
        { game_id: 'mid', date: '2024-12-01', created_at: '2024-11-01T12:00:00', status: 'confirmed' },
      ],
    });
    const own = buildDormancy(data, NOW, 4);
    expect(own.some((b) => b.wentDormant || b.revived)).toBe(true);
    // The range's own timeline (what the route shares with the funnel), or all of history.
    expect(buildDormancy(data, NOW, 4, buildBucketTimeline(data, NOW, 4))).toEqual(own);
    expect(buildDormancy(data, NOW, 4, buildBucketTimeline(data, NOW))).toEqual(own);
    expect(buildDormancy(data, NOW, undefined, buildBucketTimeline(data, NOW))).toEqual(buildDormancy(data, NOW));
  });

  it('emits went-dormant 60 days after the last activity, and revived when it resumes', () => {
    const result = buildDormancy(
      indexPlatform({
        ...EMPTY,
        // Created 2024-11-03 -> dormant 2025-01-02 (bucket 1) -> revived 2025-01-10 (bucket 0).
        games: [game('g1', 'gm', '2024-11-03T12:00:00'), game('g2', 'gm', '2025-01-01T12:00:00')],
        sessions: [{ game_id: 'g1', date: '2025-02-01', created_at: '2025-01-10T12:00:00', status: 'confirmed' }],
      }),
      NOW,
      2
    );
    expect(result).toEqual([
      { windowEnd: BUCKET1, wentDormant: 1, revived: 0 },
      { windowEnd: BUCKET0, wentDormant: 0, revived: 1 },
    ]);
  });

  it('counts a game that is still idle today as dormant once it crosses 60 days', () => {
    const result = buildDormancy(
      indexPlatform({ ...EMPTY, games: [game('g1', 'gm', '2024-11-10T12:00:00')] }), // + 60d = 01-09
      NOW,
      1
    );
    expect(result).toEqual([{ windowEnd: BUCKET0, wentDormant: 1, revived: 0 }]);
  });

  it('never marks a quiet game dormant while a session is on the books', () => {
    const result = buildDormancy(
      indexPlatform({
        ...EMPTY,
        games: [game('g1', 'gm', '2024-10-01T12:00:00')],
        memberships: [{ game_id: 'g1', user_id: 'p', joined_at: '2024-10-01T13:00:00' }],
        // Booked once in October for March; nothing since.
        sessions: [{ game_id: 'g1', date: '2025-03-01', created_at: '2024-10-02T12:00:00', status: 'confirmed' }],
      }),
      NOW,
      16
    );
    expect(result.every((b) => b.wentDormant === 0 && b.revived === 0)).toBe(true);
  });

  it('goes dormant the day its last booked session passes, if already quiet 60 days', () => {
    const result = buildDormancy(
      indexPlatform({
        ...EMPTY,
        games: [game('g1', 'gm', '2024-10-01T12:00:00')],
        memberships: [{ game_id: 'g1', user_id: 'p', joined_at: '2024-10-01T13:00:00' }],
        sessions: [{ game_id: 'g1', date: '2024-12-01', created_at: '2024-10-02T12:00:00', status: 'confirmed' }],
      }),
      NOW,
      7
    );
    // Oldest bucket (index 6) ends 12-03 and holds 12-01.
    expect(result[0]).toEqual({ windowEnd: '2024-12-03', wentDormant: 1, revived: 0 });
    expect(result.slice(1).every((b) => b.wentDormant === 0)).toBe(true);
  });

  it('treats any kind of activity as keeping a game alive', () => {
    const result = buildDormancy(
      indexPlatform({
        ...EMPTY,
        games: [game('g1', 'gm', '2024-10-01T12:00:00')],
        memberships: [{ game_id: 'g1', user_id: 'p', joined_at: '2024-11-15T12:00:00' }],
        availability: [
          { game_id: 'g1', user_id: 'p', date: '2025-01-03', status: 'available', created_at: '2024-11-20T12:00:00', updated_at: '2024-12-30T12:00:00' },
        ],
      }),
      NOW,
      4
    );
    expect(result.every((b) => b.wentDormant === 0 && b.revived === 0)).toBe(true);
  });
});

describe('buildDeletions', () => {
  it('counts deliberate deletes by type and drops cascades', () => {
    const result = buildDeletions(
      [
        { entity: 'game', cascaded: false, deleted_at: '2025-01-10T10:00:00' },
        { entity: 'session', cascaded: true, deleted_at: '2025-01-10T10:00:00' }, // came with the game
        { entity: 'session', cascaded: false, deleted_at: '2025-01-03T10:00:00' },
        { entity: 'membership', cascaded: false, deleted_at: '2025-01-15T08:00:00' }, // today
      ],
      NOW,
      2
    );
    expect(result).toEqual([
      { windowEnd: BUCKET1, user: 0, game: 0, session: 1, membership: 0 },
      { windowEnd: BUCKET0, user: 0, game: 1, session: 0, membership: 0 },
    ]);
  });
});
