// Leaderboard aggregation for the admin "Top Users" tab.
// Pure functions over raw table rows so the ranking logic is unit-testable
// independently of Supabase.

export interface TopUserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface TopGmEntry {
  user: TopUserProfile;
  gamesOwned: number;
  sessionsBooked: number;
  upcomingSessions: number;
  playersHosted: number;
}

export interface TopPlayerEntry {
  user: TopUserProfile;
  gamesJoined: number;
  sessionsScheduled: number;
  datesMarked: number;
}

export interface TopUsersInput {
  users: TopUserProfile[];
  games: Array<{ id: string; gm_id: string }>;
  memberships: Array<{ game_id: string; user_id: string }>;
  sessions: Array<{ game_id: string; date: string }>;
  availability: Array<{ user_id: string }>;
}

export interface TopUsersResult {
  topGms: TopGmEntry[];
  topPlayers: TopPlayerEntry[];
}

export const TOP_USERS_LIMIT = 10;

export function computeTopUsers(
  input: TopUsersInput,
  opts: { limit?: number; today?: string } = {}
): TopUsersResult {
  const limit = opts.limit ?? TOP_USERS_LIMIT;
  const today = opts.today ?? new Date().toISOString().split('T')[0];

  const usersById = new Map(input.users.map((u) => [u.id, u]));
  const gameOwner = new Map(input.games.map((g) => [g.id, g.gm_id]));

  const sessionsByGame = new Map<string, { total: number; upcoming: number }>();
  for (const s of input.sessions) {
    const stats = sessionsByGame.get(s.game_id) ?? { total: 0, upcoming: 0 };
    stats.total++;
    if (s.date >= today) stats.upcoming++;
    sessionsByGame.set(s.game_id, stats);
  }

  const membersByGame = new Map<string, Set<string>>();
  for (const m of input.memberships) {
    if (!membersByGame.has(m.game_id)) membersByGame.set(m.game_id, new Set());
    membersByGame.get(m.game_id)!.add(m.user_id);
  }

  // GM aggregates
  const gmStats = new Map<string, { gamesOwned: number; sessionsBooked: number; upcomingSessions: number; playersHosted: Set<string> }>();
  for (const game of input.games) {
    if (!usersById.has(game.gm_id)) continue;
    if (!gmStats.has(game.gm_id)) {
      gmStats.set(game.gm_id, { gamesOwned: 0, sessionsBooked: 0, upcomingSessions: 0, playersHosted: new Set() });
    }
    const stats = gmStats.get(game.gm_id)!;
    stats.gamesOwned++;
    const sessions = sessionsByGame.get(game.id);
    if (sessions) {
      stats.sessionsBooked += sessions.total;
      stats.upcomingSessions += sessions.upcoming;
    }
    for (const memberId of membersByGame.get(game.id) ?? []) {
      stats.playersHosted.add(memberId);
    }
  }

  // Player aggregates (membership-based; owning a game doesn't count here)
  const playerStats = new Map<string, { gamesJoined: number; sessionsScheduled: number }>();
  for (const m of input.memberships) {
    if (!usersById.has(m.user_id) || !gameOwner.has(m.game_id)) continue;
    if (!playerStats.has(m.user_id)) {
      playerStats.set(m.user_id, { gamesJoined: 0, sessionsScheduled: 0 });
    }
    const stats = playerStats.get(m.user_id)!;
    stats.gamesJoined++;
    stats.sessionsScheduled += sessionsByGame.get(m.game_id)?.total ?? 0;
  }

  const datesMarkedByUser = new Map<string, number>();
  for (const a of input.availability) {
    datesMarkedByUser.set(a.user_id, (datesMarkedByUser.get(a.user_id) ?? 0) + 1);
  }

  const topGms: TopGmEntry[] = [...gmStats.entries()]
    .map(([userId, stats]) => ({
      user: usersById.get(userId)!,
      gamesOwned: stats.gamesOwned,
      sessionsBooked: stats.sessionsBooked,
      upcomingSessions: stats.upcomingSessions,
      playersHosted: stats.playersHosted.size,
    }))
    .sort(
      (a, b) =>
        b.sessionsBooked - a.sessionsBooked ||
        b.gamesOwned - a.gamesOwned ||
        b.playersHosted - a.playersHosted ||
        a.user.name.localeCompare(b.user.name)
    )
    .slice(0, limit);

  const topPlayers: TopPlayerEntry[] = [...playerStats.entries()]
    .map(([userId, stats]) => ({
      user: usersById.get(userId)!,
      gamesJoined: stats.gamesJoined,
      sessionsScheduled: stats.sessionsScheduled,
      datesMarked: datesMarkedByUser.get(userId) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.sessionsScheduled - a.sessionsScheduled ||
        b.gamesJoined - a.gamesJoined ||
        b.datesMarked - a.datesMarked ||
        a.user.name.localeCompare(b.user.name)
    )
    .slice(0, limit);

  return { topGms, topPlayers };
}
