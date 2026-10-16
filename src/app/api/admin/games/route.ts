import { NextResponse } from 'next/server';
import { requireAdmin, paginate } from '@/lib/api/admin';
import { calculateGameFillRate } from '@/lib/availability';
import { computeCurrentStats, currentGameStatuses, indexPlatform } from '@/lib/admin';
import { fetchPlatformInputs } from '@/lib/admin/platformStatsStore';
import { serverError } from '@/lib/apiError';
import { getTodayLocalDate } from '@/lib/date';

import type { AdminGamesResponse, GameWithEngagement } from '@/types/api';

export async function GET(): Promise<Response> {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    type GmRef = { id: string; name: string | null; email: string };
    type GameRow = { id: string; name: string; gm: GmRef | GmRef[] | null };

    // Health comes from the same rows and classifier as the platform-health
    // charts (src/lib/admin/platformHealth.ts), so this list, the Overview tile
    // and the trend charts can't disagree about which games are healthy.
    // Paginated: platform-wide tables grow unbounded, so a plain select would
    // silently truncate at Supabase's 1000-row cap.
    const [names, inputs] = await Promise.all([
      paginate<GameRow>(admin, 'games', 'id, name, gm:users!games_gm_id_fkey(id, name, email)'),
      fetchPlatformInputs(admin),
    ]);
    const nameById = new Map(names.map((g) => [g.id, g]));
    const data = indexPlatform(inputs);
    const now = new Date();
    const statuses = currentGameStatuses(data, now);
    const current = computeCurrentStats(data, now);
    const todayStr = getTodayLocalDate();

    const gamesWithEngagement: GameWithEngagement[] = data.games.map((rows) => {
      const { game } = rows;
      const playerIds = [...rows.memberships.map((m) => m.user_id), game.gm_id];
      const playerSet = new Set(playerIds);

      // Fill rate: average completion percentage across all current players.
      // Each player's rate = (dates they've filled in) / (total play dates in
      // the campaign-bounded scheduling window).
      const fillRate = calculateGameFillRate({
        playerIds,
        playDays: game.play_days ?? [],
        schedulingWindowMonths: game.scheduling_window_months ?? 2,
        campaignStartDate: game.campaign_start_date ?? null,
        campaignEndDate: game.campaign_end_date ?? null,
        extraPlayDates: rows.playDates.map((p) => p.date.substring(0, 10)),
        availabilityRecords: rows.availability.filter((a) => playerSet.has(a.user_id)),
      });

      // Handle gm field which may be an object or array from Supabase
      const gmData = nameById.get(game.id)?.gm ?? null;
      const gm = Array.isArray(gmData) ? gmData[0] ?? null : gmData;
      const status = statuses.get(game.id);

      return {
        id: game.id,
        name: nameById.get(game.id)?.name ?? 'Unknown',
        created_at: game.created_at,
        gm: gm as GameWithEngagement['gm'],
        playerCount: playerIds.length,
        sessionCount: rows.sessions.length,
        futureSessionCount: rows.sessions.filter((s) => s.date >= todayStr).length,
        availabilityFillRate: fillRate,
        lastActivity: status?.lastActivity ?? game.created_at,
        // A game created after `now` was computed (a race) reads as just started.
        healthState: status?.state ?? 'gettingGoing',
        healthyBy: status?.healthyBy ?? null,
        viableDate: status?.viable ?? null,
      };
    });
    gamesWithEngagement.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

    const body: AdminGamesResponse = {
      games: gamesWithEngagement,
      users: {
        total: current.totalUsers,
        healthyBooked: current.healthyBookedUsers,
        healthyViable: current.healthyViableUsers,
        gettingGoing: current.gettingGoingUsers,
        unhealthy: current.unhealthyUsers,
      },
    };
    return NextResponse.json(body);
  } catch (error) {
    return serverError(error, { route: '/api/admin/games' });
  }
}
