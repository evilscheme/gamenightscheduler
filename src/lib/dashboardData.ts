import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { GameSession, GameWithGM } from '@/types';
import {
  fetchUserMemberships,
  fetchUserGmGames,
  fetchGamesWithGMByIds,
  fetchUpcomingSessionsForGames,
} from '@/lib/data';
import { getUpcomingQueryFloor } from '@/lib/upcomingSessions';
import { getTodayLocalDate } from '@/lib/date';

/** Row shape returned by the games queries with the embedded membership count. */
export type GameWithGMAndCounts = GameWithGM & { game_memberships?: { count: number }[] };

export interface DashboardGame extends GameWithGM {
  member_count: number; // embedded count + 1 for the GM
  is_co_gm: boolean; // current user is co-GM of this game
}

export interface DashboardData {
  games: DashboardGame[];
  upcoming: GameSession[];
  /**
   * Clock captured when the data was fetched. Render code derives the
   * today/tomorrow highlighting from these instead of reading the clock during
   * render (react-hooks/purity); staleTime plus refetch-on-focus bound how far
   * they can drift, and a render-time read would be no fresher anyway since
   * nothing re-renders on a timer.
   */
  fetchedAtMs: number;
  fetchedToday: string;
}

/**
 * Merge the GM-owned and member games lists into deduped dashboard rows.
 *
 * Pure function (no I/O), so it's directly unit-testable. On an id collision
 * the GM-list entry wins — a deliberate change from the pre-React-Query
 * `new Map(...)` dedupe (where the later, member-list entry's content won):
 * the user's own GM row is authoritative over a stray membership row for a
 * game they host. fetchDashboardData also pre-filters overlapping ids, so
 * collisions only arise from inconsistent data.
 */
export function mergeDashboardGames({
  gmGames,
  memberGames,
  memberships,
}: {
  gmGames: GameWithGMAndCounts[];
  memberGames: GameWithGMAndCounts[];
  memberships: { game_id: string; is_co_gm: boolean }[];
}): DashboardGame[] {
  const coGmGameIds = new Set(
    memberships.filter((m) => m.is_co_gm).map((m) => m.game_id)
  );

  // GM games first: on an id collision the GM-list entry wins (both content
  // and position) since the user's own GM row is authoritative over any
  // stale/edge-case membership row for that same game.
  const merged = new Map<string, GameWithGMAndCounts>();
  for (const game of [...gmGames, ...memberGames]) {
    if (!merged.has(game.id)) merged.set(game.id, game);
  }

  return Array.from(merged.values()).map(({ game_memberships, ...game }) => ({
    ...game,
    member_count: (game_memberships?.[0]?.count ?? 0) + 1, // +1 for the GM
    is_co_gm: coGmGameIds.has(game.id),
  }));
}

/**
 * Fetch everything the dashboard needs in two parallel round trips instead of
 * a six-stage sequential waterfall with a per-game membership-count query:
 *
 *   Stage A: the user's memberships + GM-owned games (with embedded counts).
 *   Stage B: the remaining member games (resolved by id) + upcoming sessions
 *            across every game — both keyed off the ids resolved in Stage A.
 */
export async function fetchDashboardData(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<DashboardData> {
  const fetchedAtMs = Date.now();
  const fetchedToday = getTodayLocalDate();

  const [{ data: memberships }, { data: gmGames }] = await Promise.all([
    fetchUserMemberships(supabase, userId),
    fetchUserGmGames(supabase, userId),
  ]);

  const gmGameIds = new Set((gmGames ?? []).map((g) => g.id));
  const memberGameIds = (memberships ?? [])
    .map((m) => m.game_id)
    .filter((gameId) => !gmGameIds.has(gameId));
  const allGameIds = [...gmGameIds, ...memberGameIds];

  const [{ data: memberGames }, { data: upcoming, error: sessionsError }] = await Promise.all([
    memberGameIds.length
      ? fetchGamesWithGMByIds(supabase, memberGameIds)
      : Promise.resolve({ data: [], error: null }),
    fetchUpcomingSessionsForGames(supabase, allGameIds, getUpcomingQueryFloor(fetchedAtMs)),
  ]);

  if (sessionsError) {
    // Games already resolved above; surface the failure rather than showing
    // a silently-empty panel that looks like "no upcoming sessions".
    console.error('[UpcomingSessions] failed to fetch upcoming sessions:', sessionsError);
  }

  return {
    games: mergeDashboardGames({
      gmGames: (gmGames ?? []) as GameWithGMAndCounts[],
      memberGames: (memberGames ?? []) as GameWithGMAndCounts[],
      memberships: (memberships ?? []) as { game_id: string; is_co_gm: boolean }[],
    }),
    upcoming: sessionsError ? [] : ((upcoming ?? []) as GameSession[]),
    fetchedAtMs,
    fetchedToday,
  };
}
